import { Types } from "mongoose";
import { ApiError } from "./ApiError";
import { Admission } from "../modules/admissions/admissions.model";
import { Patient } from "../modules/patients/patients.model";

/**
 * Clinical data is private to the clinician responsible for it.
 * An admission belongs to `assignedTo` (set by an accepted handover) or, when unassigned, to its creator.
 * A patient belongs to `owner` (moved by an accepted handover) or, when unset, to its creator.
 */
export const ownedAdmissionFilter = (userId: string) => {
  const me = new Types.ObjectId(userId);
  return { $or: [{ assignedTo: me }, { assignedTo: null, createdBy: me }] };
};

export const ownedPatientFilter = (userId: string) => {
  const me = new Types.ObjectId(userId);
  return { $or: [{ owner: me }, { owner: null, createdBy: me }] };
};

const assertId = (id: string, label: string) => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, `Invalid ${label} id`);
};

/** Loads an admission the user may see; anything else is reported as not found. */
export const findOwnedAdmission = async (id: string, userId: string) => {
  assertId(id, "admission");
  const admission = await Admission.findOne({ _id: id, ...ownedAdmissionFilter(userId) });
  if (!admission) throw new ApiError(404, "Admission not found");
  return admission;
};

export const findOwnedPatient = async (id: string, userId: string) => {
  assertId(id, "patient");
  const patient = await Patient.findOne({ _id: id, ...ownedPatientFilter(userId) });
  if (!patient) throw new ApiError(404, "Patient not found");
  return patient;
};

/** Admission ids the user owns, for scoping list queries that filter by patient. */
export const ownedAdmissionIds = async (userId: string) =>
  (await Admission.find(ownedAdmissionFilter(userId)).select("_id")).map((a) => a._id);

/**
 * List filter for records that hang off an admission (medications, labs, plans, ...):
 * restricted to admissions the user owns, optionally narrowed to one admission or patient.
 */
export const scopedRecordFilter = async (
  userId: string,
  query: { admissionId?: string; patientId?: string }
) => {
  const filter: Record<string, unknown> = {};
  if (query.admissionId) {
    const admission = await findOwnedAdmission(query.admissionId, userId);
    filter.admission = admission._id;
  } else {
    filter.admission = { $in: await ownedAdmissionIds(userId) };
  }
  if (query.patientId) {
    assertId(query.patientId, "patient");
    filter.patient = new Types.ObjectId(query.patientId);
  }
  return filter;
};
