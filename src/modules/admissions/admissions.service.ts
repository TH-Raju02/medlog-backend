import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { escapeRegex } from "../../utils/escapeRegex";
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
    let patientId = data.patientId;

    if (!patientId && data.patient) {
      const patient = await patientsService.create(data.patient, userId);
      patientId = patient.id;
    }

    if (!patientId) {
      throw new ApiError(400, "Patient is required");
    }

    const admission = await Admission.create({
      code: formatCode(await nextSequence("admission")),
      patient: new Types.ObjectId(patientId),
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

  async list(query: {
    page: number;
    limit: number;
    status?: string;
    specialty?: string;
    patientId?: string;
    search?: string;
  }) {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.specialty) filter.specialty = query.specialty;
    if (query.patientId) filter.patient = query.patientId;

    if (query.search) {
      const pattern = new RegExp(escapeRegex(query.search), "i");
      const patients = await Patient.find({
        $or: [
          { firstName: pattern },
          { lastName: pattern },
          { mrn: pattern },
          { nationalId: pattern },
        ],
      }).select("_id");
      filter.patient = { $in: patients.map((p) => p._id) };
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

  async getById(id: string) {
    const admission = await Admission.findById(id).populate(populatePatient);
    if (!admission) throw new ApiError(404, "Admission not found");
    return admission;
  }

  async update(id: string, data: Record<string, unknown>) {
    await this.assertActive(id);
    const admission = await Admission.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    ).populate(populatePatient);
    if (!admission) throw new ApiError(404, "Admission not found");
    return admission;
  }

  async remove(id: string) {
    const admission = await Admission.findByIdAndDelete(id);
    if (!admission) throw new ApiError(404, "Admission not found");
    return admission;
  }

  async markReviewed(id: string, userId: string) {
    await this.assertActive(id);
    const admission = await Admission.findByIdAndUpdate(
      id,
      { $set: { lastReviewedAt: new Date(), lastReviewedBy: new Types.ObjectId(userId) } },
      { new: true }
    ).populate(populatePatient);
    if (!admission) throw new ApiError(404, "Admission not found");
    return admission;
  }

  async undoReview(id: string) {
    await this.assertActive(id);
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
    const existing = await this.assertActive(id);

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
        },
      },
      { new: true, runValidators: true }
    ).populate(populatePatient);
    if (!admission) throw new ApiError(404, "Admission not found");
    return admission;
  }

  async handover(id: string, toUserId: string, userId: string, notes?: string) {
    return transfersService.create(
      { admissionId: id, transferType: "handoff", toUserId, notes },
      userId
    );
  }

  private async assertActive(id: string) {
    const admission = await Admission.findById(id);
    if (!admission) throw new ApiError(404, "Admission not found");
    if (admission.status === "discharged") {
      throw new ApiError(409, "This admission is discharged and can no longer be edited", {
        code: "ADMISSION_DISCHARGED",
      });
    }
    return admission;
  }
}

export const admissionsService = new AdmissionsService();
