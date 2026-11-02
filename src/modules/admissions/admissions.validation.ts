import { z } from "zod";
import { patientCreateBody } from "../patients/patients.validation";

const locationFields = {
  ward: z.string().max(80).optional(),
  room: z.string().max(80).optional(),
  bed: z.string().max(80).optional(),
};

const medicationRow = z.object({
  name: z.string().min(1).max(200),
  dose: z.string().max(120).optional(),
  route: z.string().max(80).optional(),
  frequency: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const createAdmissionSchema = z.object({
  body: z
    .object({
      patientId: z.string().optional(),
      patient: patientCreateBody.partial().extend({
        firstName: z.string().min(1).max(80),
        lastName: z.string().min(1).max(80),
      }).optional(),
      admissionDate: z.coerce.date().optional(),
      chiefComplaint: z.string().max(1000).optional(),
      diagnosis: z.string().max(1000).optional(),
      medicalHistory: z.string().max(4000).optional(),
      specialty: z.string().max(120).optional(),
      hospital: z.string().max(160).optional(),
      status: z.enum(["active", "discharged", "transferred"]).optional(),
      entryMode: z.enum(["manual", "ai", "ai_extract"]).optional(),
      notes: z.string().max(2000).optional(),
      location: z.object(locationFields).optional(),
      ...locationFields,
    })
    .transform((data) => {
      const entryMode =
        data.entryMode === "ai_extract" ? "ai" : data.entryMode;
      return {
        ...data,
        entryMode,
        ward: data.ward ?? data.location?.ward,
        room: data.room ?? data.location?.room,
        bed: data.bed ?? data.location?.bed,
      };
    })
    .refine((data) => data.patientId || data.patient, {
      message: "Either patientId or patient is required",
      path: ["patientId"],
    }),
});

export const updateAdmissionSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    admissionDate: z.coerce.date().optional(),
    chiefComplaint: z.string().max(1000).optional(),
    diagnosis: z.string().max(1000).optional(),
    medicalHistory: z.string().max(4000).optional(),
    specialty: z.string().max(120).optional(),
    hospital: z.string().max(160).optional(),
    status: z.enum(["active", "discharged", "transferred"]).optional(),
    entryMode: z.enum(["manual", "ai"]).optional(),
    notes: z.string().max(2000).optional(),
    ...locationFields,
  }),
});

export const listAdmissionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    status: z.enum(["active", "discharged", "transferred"]).optional(),
    specialty: z.string().optional(),
    patientId: z.string().optional(),
    search: z.string().max(80).optional(),
  }),
});

export const dischargeSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      summary: z.string().max(4000).optional(),
      notes: z.string().max(2000).optional(),
      counselingCompleted: z.boolean().optional(),
      dischargedAt: z.coerce.date().optional(),
      medications: z.array(medicationRow).max(50).optional(),
    })
    .default({}),
});

export const handoverSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    toUserId: z.string().min(1),
    notes: z.string().max(1000).optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
