import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { escapeRegex } from "../../utils/escapeRegex";
import {
  findOwnedAdmission,
  findOwnedPatient,
  ownedAdmissionFilter,
  ownedPatientFilter,
} from "../../utils/ownership";
import { nextSequence } from "../../database/counter";
import { patientsService } from "../patients/patients.service";
import { Patient } from "../patients/patients.model";
import { HospitalMedication } from "../medications/medications.model";
import { transfersService } from "../transfers/transfers.service";
import { Admission } from "./admissions.model";

const populatePatient = [
  { path: "patient" },
  { path: "createdBy", select: "firstName lastName email" },
  { path: "assignedTo", select: "firstName lastName email jobTitle specialty" },
];

const formatCode = (seq: number) => `ADM-${String(seq).padStart(3, "0")}`;

export class AdmissionsService {
  async create(
    data: {
      patientId?: string;
      patient?: Record<string, unknown>;
      admissionDate?: Date;
      chiefComplaint?: string;
      diagnosis?: string;
      medicalHistory?: string;
      specialty?: string;
      ward?: string;
      room?: string;
      bed?: string;
      hospital?: string;
      status?: "active" | "discharged" | "transferred";
      entryMode?: "manual" | "ai";
      notes?: string;
    },
    userId: string
  ) {
    let patientId: Types.ObjectId | undefined;

    if (data.patientId) {
      patientId = (await findOwnedPatient(data.patientId, userId))._id as Types.ObjectId;
    } else if (data.patient) {
      // The same Civil ID is the same person: reuse the profile instead of creating a duplicate.
      const civilId = typeof data.patient.nationalId === "string" ? data.patient.nationalId.trim() : "";
      const existing = civilId
        ? await Patient.findOne({ nationalId: civilId, ...ownedPatientFilter(userId) }).sort({ createdAt: -1 })
        : null;
      if (existing) {
        await this.assertNotAdmitted(existing._id as Types.ObjectId, userId);
        existing.set(data.patient);
        await existing.save();
        patientId = existing._id as Types.ObjectId;
      } else {
        const patient = await patientsService.create(data.patient, userId);
        patientId = patient._id as Types.ObjectId;
      }
    }

    if (!patientId) {
      throw new ApiError(400, "Patient is required");
    }
    await this.assertNotAdmitted(patientId, userId);

    const admission = await Admission.create({
      code: formatCode(await nextSequence("admission")),
      patient: patientId,
      admissionDate: data.admissionDate ?? new Date(),
      chiefComplaint: data.chiefComplaint,
      diagnosis: data.diagnosis,
      medicalHistory: data.medicalHistory,
      specialty: data.specialty,
      ward: data.ward,
      room: data.room,
      bed: data.bed,
      hospital: data.hospital,
      status: data.status ?? "active",
      entryMode: data.entryMode ?? "manual",
      notes: data.notes,
      createdBy: new Types.ObjectId(userId),
    });

    return admission.populate(populatePatient);
  }

  async list(
    userId: string,
    query: {
      page: number;
      limit: number;
      status?: string;
      specialty?: string;
      patientId?: string;
      search?: string;
    }
  ) {
    const filter: Record<string, unknown> = { ...ownedAdmissionFilter(userId) };
    if (query.status) filter.status = query.status;
    if (query.specialty) filter.specialty = query.specialty;
    if (query.patientId) {
      if (!Types.ObjectId.isValid(query.patientId)) throw new ApiError(400, "Invalid patient id");
      filter.patient = new Types.ObjectId(query.patientId);
    }

    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), "i");
      const patients = await Patient.find({
        $or: [{ firstName: pattern }, { lastName: pattern }, { mrn: pattern }, { nationalId: pattern }],
      }).select("_id");
      const ids = patients.map((p) => p._id);
      filter.patient = query.patientId
        ? { $in: ids.filter((id) => String(id) === query.patientId) }
        : { $in: ids };
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      Admission.find(filter)
        .populate(populatePatient)
        .sort({ admissionDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(query.limit),
      Admission.countDocuments(filter),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getById(id: string, userId: string) {
    const admission = await findOwnedAdmission(id, userId);
    return admission.populate(populatePatient);
  }

  async update(id: string, data: Record<string, unknown>, userId: string) {
    await this.assertActive(id, userId);
    const admission = await Admission.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    ).populate(populatePatient);
    if (!admission) throw new ApiError(404, "Admission not found");
    return admission;
  }

  async remove(id: string, userId: string) {
    const admission = await findOwnedAdmission(id, userId);
    await admission.deleteOne();
    return admission;
  }

  async markReviewed(id: string, userId: string) {
    await this.assertActive(id, userId);
    const admission = await Admission.findByIdAndUpdate(
      id,
      { $set: { lastReviewedAt: new Date(), lastReviewedBy: new Types.ObjectId(userId) } },
      { new: true }
    ).populate(populatePatient);
    if (!admission) throw new ApiError(404, "Admission not found");
    return admission;
  }

  async undoReview(id: string, userId: string) {
    await this.assertActive(id, userId);
    const admission = await Admission.findByIdAndUpdate(
      id,
      { $unset: { lastReviewedAt: 1, lastReviewedBy: 1 } },
      { new: true }
    ).populate(populatePatient);
    if (!admission) throw new ApiError(404, "Admission not found");
    return admission;
  }

  async discharge(
    id: string,
    data: {
      summary?: string;
      notes?: string;
      medicalHistory?: string;
      counselingCompleted?: boolean;
      dischargedAt?: Date;
      medications?: Array<{
        name: string;
        dose?: string;
        route?: string;
        frequency?: string;
        notes?: string;
        startDate?: Date;
        endDate?: Date;
      }>;
    },
    userId: string
  ) {
    const existing = await this.assertActive(id, userId);

    if (data.medications?.length) {
      await HospitalMedication.insertMany(
        data.medications.map((m) => ({
          ...m,
          category: "discharge",
          admission: existing._id,
          patient: existing.patient,
          createdBy: new Types.ObjectId(userId),
        }))
      );
    }

    const admission = await Admission.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "discharged",
          dischargedAt: data.dischargedAt ?? new Date(),
          dischargeCounseling: Boolean(data.counselingCompleted),
          ...(data.summary ? { dischargeSummary: data.summary } : {}),
          ...(data.notes ? { notes: data.notes } : {}),
          ...(data.medicalHistory !== undefined ? { medicalHistory: data.medicalHistory } : {}),
        },
      },
      { new: true, runValidators: true }
    ).populate(populatePatient);
    if (!admission) throw new ApiError(404, "Admission not found");
    return admission;
  }

  async handover(id: string, toUserId: string, userId: string, notes?: string) {
    await findOwnedAdmission(id, userId);
    return transfersService.create(
      { admissionId: id, transferType: "handoff", toUserId, notes },
      userId
    );
  }

  private async assertNotAdmitted(patientId: Types.ObjectId, userId: string) {
    const active = await patientsService.activeAdmission(patientId, userId);
    if (active) {
      throw new ApiError(409, "This patient is already admitted. Open the current admission instead.", {
        code: "PATIENT_ALREADY_ADMITTED",
        errors: { admissionId: String(active._id) },
      });
    }
  }

  private async assertActive(id: string, userId: string) {
    const admission = await findOwnedAdmission(id, userId);
    if (admission.status === "discharged") {
      throw new ApiError(409, "This admission is discharged and can no longer be edited", {
        code: "ADMISSION_DISCHARGED",
      });
    }
    return admission;
  }
}

export const admissionsService = new AdmissionsService();
