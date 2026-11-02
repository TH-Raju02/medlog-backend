import { z } from "zod";
import { SUBSCRIPTION_PLANS } from "../auth/auth.model";

export const checkoutSchema = z.object({
  body: z.object({
    plan: z.enum(SUBSCRIPTION_PLANS),
    returnUrl: z.string().min(3).max(500),
  }),
});

export const confirmSchema = z.object({
  body: z.object({
    sessionId: z.string().min(10).max(200),
  }),
});

export const returnSchema = z.object({
  query: z.object({
    status: z.enum(["success", "cancel"]),
    to: z.string().min(3).max(500),
    session_id: z.string().max(200).optional(),
  }),
});
