import { PipelineStage, Types } from "mongoose";
import { escapeRegex } from "../../utils/escapeRegex";
import { findOwnedPatient, ownedAdmissionFilter, ownedPatientFilter } from "../../utils/ownership";
import { Admission } from "../admissions/admissions.model";
import { Patient } from "./patients.model";

const generateMrn = () => {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `MRN-${stamp}${rand}`;
};

type ListSort = "recent" | "name" | "admission";

export class PatientsService {
  async create(data: Record<string, unknown>, userId: string) {
    const me = new Types.ObjectId(userId);
    return Patient.create({
      ...data,
      mrn: generateMrn(),
      owner: me,
      createdBy: me,
    });
  }

  /** The user's patients with their most recent admission, for the Patients tab (status + admission date). */
  async list(userId: string, page: number, limit: number, search?: string, sort: ListSort = "recent") {
    const match: Record<string, unknown> = { ...ownedPatientFilter(userId) };
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      match.$and = [
        {
          $or: [
            { firstName: pattern },
            { lastName: pattern },
            { mrn: pattern },
            { nationalId: pattern },
            { fileNumber: pattern },
          ],
        },
      ];
    }

    const sortStage: Record<string, 1 | -1> =
      sort === "name"
        ? { firstName: 1, lastName: 1 }
        : sort === "admission"
          ? { "latestAdmission.admissionDate": -1, createdAt: -1 }
          : { createdAt: -1 };

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: "admissions",
          let: { pid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$patient", "$$pid"] } } },
            { $sort: { admissionDate: -1, createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                admissionDate: 1,
                status: 1,
                lastReviewedAt: 1,
                dischargedAt: 1,
                specialty: 1,
                code: 1,
              },
            },
          ],
          as: "latestAdmission",
        },
      },
      { $unwind: { path: "$latestAdmission", preserveNullAndEmptyArrays: true } },
      { $sort: sortStage },
      {
        $facet: {
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const [result] = await Patient.aggregate(pipeline);
    const total = result?.total?.[0]?.count ?? 0;

    return {
      items: result?.items ?? [],
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /** Finds the user's patient by Civil ID, with the active admission when the patient is still admitted. */
  async lookupByCivilId(civilId: string, userId: string): Promise<Record<string, unknown> | null> {
    const patient = await Patient.findOne({ nationalId: civilId.trim(), ...ownedPatientFilter(userId) }).sort({
      createdAt: -1,
    });
    if (!patient) return null;
    const active = await this.activeAdmission(patient._id as Types.ObjectId, userId);
    return {
      ...(patient.toJSON() as Record<string, unknown>),
      activeAdmission: active ? { _id: active._id, code: active.code, admissionDate: active.admissionDate } : null,
    };
  }

  async activeAdmission(patientId: Types.ObjectId, userId: string) {
    return Admission.findOne({ patient: patientId, status: "active", ...ownedAdmissionFilter(userId) }).sort({
      admissionDate: -1,
    });
  }

  async getById(id: string, userId: string) {
    return findOwnedPatient(id, userId);
  }

  async update(id: string, data: Record<string, unknown>, userId: string) {
    const patient = await findOwnedPatient(id, userId);
    patient.set(data);
    await patient.save();
    return patient;
  }

  async remove(id: string, userId: string) {
    const patient = await findOwnedPatient(id, userId);
    await patient.deleteOne();
    return patient;
  }
}

export const patientsService = new PatientsService();
