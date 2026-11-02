import { z } from "zod";
import { JOB_TITLES } from "./auth.model";

const code = z.string().regex(/^\d{4,8}$/, "Code must be numeric");
const password = z.string().min(8).max(128);

export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(80),
    lastName: z.string().min(1).max(80),
    email: z.string().email(),
    password,
    jobTitle: z.enum(JOB_TITLES).optional(),
    specialty: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
    acceptTerms: z.boolean().optional(),
    country: z.string().min(2).max(80).optional().default("Kuwait"),
    countryCode: z.string().length(2).optional().default("KW"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code,
  }),
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const verifyResetCodeSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    resetToken: z.string().min(32).max(128),
    password,
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10).optional(),
  }),
});
