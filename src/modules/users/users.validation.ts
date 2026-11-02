import { z } from "zod";
import { JOB_TITLES } from "../auth/auth.model";

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().min(1).max(80).optional(),
    phone: z.string().max(40).optional(),
    jobTitle: z.enum(JOB_TITLES).optional(),
    country: z.string().optional(),
    countryCode: z.string().length(2).optional(),
    specialty: z.string().max(120).optional(),
    preferences: z
      .object({
        notificationsEnabled: z.boolean().optional(),
        handoverNotifications: z.boolean().optional(),
        reminderTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm")
          .optional(),
        language: z.string().max(10).optional(),
      })
      .optional(),
  }),
});

export const listColleaguesSchema = z.object({
  query: z.object({
    search: z.string().max(80).optional(),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});
