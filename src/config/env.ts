import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
  OTP_TTL_MINUTES: z.coerce.number().default(10),
  DEFAULT_OTP: z.string().default("1234"),
  OTP_MODE: z.enum(["fixed", "email"]).default("fixed"),
  LOG_LEVEL: z.string().default("info"),
  UPLOAD_DIR: z.string().default("uploads"),
  PUBLIC_API_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CURRENCY: z.string().default("usd"),
  PAYMENT_RETURN_URL_PREFIXES: z
    .string()
    .default("medlog://,exp://,http://10.10.28.37,https://10.10.28.37"),
  EMAIL_PROVIDER: z.enum(["smtp", "brevo", "resend"]).optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().default("MedLog"),
  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/medlog",
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me-32",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me-32",
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  OTP_TTL_MINUTES: process.env.OTP_TTL_MINUTES,
  DEFAULT_OTP: process.env.DEFAULT_OTP,
  OTP_MODE: process.env.OTP_MODE || undefined,
  LOG_LEVEL: process.env.LOG_LEVEL,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  PUBLIC_API_URL: process.env.PUBLIC_API_URL || undefined,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || undefined,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || undefined,
  STRIPE_CURRENCY: process.env.STRIPE_CURRENCY,
  PAYMENT_RETURN_URL_PREFIXES: process.env.PAYMENT_RETURN_URL_PREFIXES,
  EMAIL_PROVIDER:
    process.env.EMAIL_PROVIDER ||
    (process.env.SMTP_USER && process.env.SMTP_PASS ? "smtp" : undefined),
  EMAIL_API_KEY: process.env.EMAIL_API_KEY || undefined,
  EMAIL_FROM: process.env.EMAIL_FROM || undefined,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || undefined,
  SMTP_HOST: process.env.SMTP_HOST || undefined,
  SMTP_PORT: process.env.SMTP_PORT || undefined,
  SMTP_USER: process.env.SMTP_USER || undefined,
  // Gmail shows app passwords in groups of four ("abcd efgh ..."); the spaces aren't part of it.
  SMTP_PASS: process.env.SMTP_PASS?.replace(/\s+/g, "") || undefined,
  SMTP_FROM: process.env.SMTP_FROM || undefined,
});

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten());
  process.exit(1);
}

export const env = parsed.data;
