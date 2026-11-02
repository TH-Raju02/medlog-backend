import { PipelineStage, Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { escapeRegex } from "../../utils/escapeRegex";
import { Patient } from "./patients.model";

const generateMrn = () => {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `MRN-${stamp}${rand}`;
};

type ListSort = "recent" | "name" | "admission";

export class PatientsService {
  async create(data: Record<string, unknown>, userId: string) {
    return Patient.create({
      ...data,
      mrn: generateMrn(),
      createdBy: new Types.ObjectId(userId),
    });
  }

  /** Patients with their most recent admission, for the Patients tab (status + admission date). */
  async list(page: number, limit: number, search?: string, sort: ListSort = "recent") {
    const match: Record<string, unknown> = {};
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      match.$or = [
        { firstName: pattern },
        { lastName: pattern },
        { mrn: pattern },
        { nationalId: pattern },
        { fileNumber: pattern },
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

  async lookupByCivilId(civilId: string) {
    return Patient.findOne({ nationalId: civilId.trim() }).sort({ createdAt: -1 });
  }

  async getById(id: string) {
    const patient = await Patient.findById(id);
    if (!patient) throw new ApiError(404, "Patient not found");
    return patient;
  }

  async update(id: string, data: Record<string, unknown>) {
    const patient = await Patient.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!patient) throw new ApiError(404, "Patient not found");
    return patient;
  }

  async remove(id: string) {
    const patient = await Patient.findByIdAndDelete(id);
    if (!patient) throw new ApiError(404, "Patient not found");
    return patient;
  }
}

export const patientsService = new PatientsService();
