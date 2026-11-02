import { z } from "zod";
import { MARITAL_STATUSES } from "./patients.model";

export const patientFields = {
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  nationalId: z.string().max(40).optional(),
  fileNumber: z.string().max(40).optional(),
  phone: z.string().max(40).optional(),
  nationality: z.string().max(80).optional(),
  maritalStatus: z.enum(MARITAL_STATUSES).optional(),
  weightKg: z.coerce.number().min(0).max(700).optional(),
  heightCm: z.coerce.number().min(0).max(300).optional(),
  bloodType: z.string().max(10).optional(),
  hasAllergies: z.boolean().optional(),
  allergies: z.string().max(500).optional(),
  smoker: z.boolean().optional(),
  alcohol: z.boolean().optional(),
  caffeine: z.boolean().optional(),
  recreationalDrugs: z.boolean().optional(),
  catheter: z.boolean().optional(),
  ngt: z.boolean().optional(),
  pegTube: z.boolean().optional(),
  country: z.string().max(80).optional(),
  countryCode: z.string().length(2).optional(),
  notes: z.string().max(2000).optional(),
};

export const patientCreateBody = z.object({
  ...patientFields,
  country: patientFields.country.default("Kuwait"),
  countryCode: patientFields.countryCode.default("KW"),
});

export const createPatientSchema = z.object({
  body: patientCreateBody,
});

export const updatePatientSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    ...patientFields,
    firstName: patientFields.firstName.optional(),
    lastName: patientFields.lastName.optional(),
  }),
});

export const listPatientsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().max(80).optional(),
    sort: z.enum(["recent", "name", "admission"]).optional().default("recent"),
  }),
});

export const lookupPatientSchema = z.object({
  query: z.object({
    civilId: z.string().min(1).max(40),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
