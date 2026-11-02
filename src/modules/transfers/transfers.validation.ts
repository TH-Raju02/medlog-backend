import { z } from "zod";
import { TRANSFER_STATUSES, TRANSFER_TYPES } from "./transfers.model";

export const createTransferSchema = z.object({
  body: z.object({
    admissionId: z.string().min(1),
    fromWard: z.string().max(80).optional(),
    toWard: z.string().max(80).optional(),
    fromHospital: z.string().max(160).optional(),
    toHospital: z.string().max(160).optional(),
    transferType: z.enum(TRANSFER_TYPES).optional(),
    toUserId: z.string().optional(),
    reason: z.string().max(1000).optional(),
    notes: z.string().max(2000).optional(),
  }),
});

export const listTransfersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    status: z.enum(TRANSFER_STATUSES).optional(),
    admissionId: z.string().optional(),
    box: z.enum(["all", "sent", "received", "completed"]).optional(),
  }),
});

export const updateStatusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    status: z.enum(TRANSFER_STATUSES),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
