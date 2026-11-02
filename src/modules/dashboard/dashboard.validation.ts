import { z } from "zod";

export const metricsSchema = z.object({
  query: z.object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM")
      .optional(),
  }),
});
