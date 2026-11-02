import { z } from "zod";

export const listRemindersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(50),
    status: z.enum(["open", "all"]).optional().default("all"),
  }),
});

export const createReminderSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300),
    dueAt: z.coerce.date(),
  }),
});

export const updateReminderSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title: z.string().min(1).max(300).optional(),
    dueAt: z.coerce.date().optional(),
    completed: z.boolean().optional(),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
