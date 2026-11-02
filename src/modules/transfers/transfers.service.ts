import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { Admission } from "../admissions/admissions.model";
import { User } from "../auth/auth.model";
import { Transfer, TransferStatus } from "./transfers.model";

type Box = "all" | "sent" | "received" | "completed";

const populateAll = [
  { path: "admission" },
  { path: "patient" },
  { path: "requestedBy", select: "firstName lastName email jobTitle specialty" },
  { path: "toUser", select: "firstName lastName email jobTitle specialty" },
];

export class TransfersService {
  async list(
    userId: string,
    query: { page: number; limit: number; status?: string; admissionId?: string; box?: Box }
  ) {
    const me = new Types.ObjectId(userId);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.admissionId) filter.admission = query.admissionId;

    switch (query.box) {
      case "sent":
        filter.requestedBy = me;
        break;
      case "received":
        filter.toUser = me;
        break;
      case "completed":
        filter.status = "completed";
        filter.$or = [{ requestedBy: me }, { toUser: me }];
        break;
      case "all":
        filter.$or = [{ requestedBy: me }, { toUser: me }];
        break;
      default:
        break;
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total, pendingReceived] = await Promise.all([
      Transfer.find(filter).populate(populateAll).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      Transfer.countDocuments(filter),
      Transfer.countDocuments({ toUser: me, status: "pending" }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
        pendingReceived,
      },
    };
  }

  async getById(id: string) {
    const item = await Transfer.findById(id).populate(populateAll);
    if (!item) throw new ApiError(404, "Transfer not found");
    return item;
  }

  async create(
    data: {
      admissionId: string;
      fromWard?: string;
      toWard?: string;
      fromHospital?: string;
      toHospital?: string;
      transferType?: "inter_ward" | "inter_hospital" | "handoff";
      toUserId?: string;
      reason?: string;
      notes?: string;
    },
    userId: string
  ) {
    const admission = await Admission.findById(data.admissionId);
    if (!admission) throw new ApiError(404, "Admission not found");
    if (admission.status !== "active") {
      throw new ApiError(409, "Only active admissions can be transferred", { code: "NOT_ACTIVE" });
    }

    let toUser;
    if (data.toUserId) {
      if (data.toUserId === userId) {
        throw new ApiError(400, "You cannot hand over a patient to yourself");
      }
      toUser = await User.findById(data.toUserId);
      if (!toUser) throw new ApiError(404, "Receiver not found");
    }
    const transferType = toUser ? "handoff" : data.transferType ?? "inter_ward";

    if (transferType === "handoff") {
      const open = await Transfer.findOne({
        admission: admission._id,
        transferType: "handoff",
        status: "pending",
      });
      if (open) {
        throw new ApiError(409, "A handover is already pending for this patient", {
          code: "HANDOVER_PENDING",
        });
      }
    }

    const item = await Transfer.create({
      admission: admission._id,
      patient: admission.patient,
      fromWard: data.fromWard ?? admission.ward,
      toWard: data.toWard,
      fromHospital: data.fromHospital ?? admission.hospital,
      toHospital: data.toHospital,
      transferType,
      toUser: toUser?._id,
      toSpecialty: toUser?.specialty,
      reason: data.reason,
      notes: data.notes,
      requestedBy: new Types.ObjectId(userId),
    });

    return item.populate(populateAll);
  }

  async updateStatus(id: string, status: TransferStatus, userId: string, isAdmin: boolean) {
    const item = await Transfer.findById(id);
    if (!item) throw new ApiError(404, "Transfer not found");

    const isHandoff = item.transferType === "handoff";
    if (isHandoff && !isAdmin) {
      const isReceiver = item.toUser?.toString() === userId;
      const isSender = item.requestedBy.toString() === userId;
      const allowed =
        (isReceiver && ["accepted", "completed", "cancelled"].includes(status)) ||
        (isSender && status === "cancelled");
      if (!allowed) {
        throw new ApiError(403, "Only the receiver can accept this handover", { code: "FORBIDDEN" });
      }
    }

    // Accepting a handover completes it: responsibility moves straight to the receiver.
    const finalStatus: TransferStatus = isHandoff && status === "accepted" ? "completed" : status;
    item.status = finalStatus;
    item.respondedAt = new Date();
    if (finalStatus === "accepted" || finalStatus === "completed") {
      item.acceptedBy = new Types.ObjectId(userId);
    }
    await item.save();

    if (finalStatus === "completed") {
      if (isHandoff) {
        await Admission.findByIdAndUpdate(item.admission, {
          $set: { assignedTo: item.toUser, ...(item.toSpecialty ? { specialty: item.toSpecialty } : {}) },
        });
      } else {
        await Admission.findByIdAndUpdate(item.admission, {
          $set: {
            status: "transferred",
            ...(item.toWard ? { ward: item.toWard } : {}),
            ...(item.toHospital ? { hospital: item.toHospital } : {}),
          },
        });
      }
    }

    return item.populate(populateAll);
  }
}

export const transfersService = new TransfersService();
