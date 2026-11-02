import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { ApiError } from "./ApiError";
import { logger } from "./logger";

export type CodePurpose = "verify" | "reset";

interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const SEND_TIMEOUT_MS = 10_000;

const sendFailed = () =>
  new ApiError(502, "Could not send email. Please try again.", { code: "EMAIL_SEND_FAILED" });

export const isMailConfigured = () => {
  if (env.EMAIL_PROVIDER === "smtp") return Boolean(env.SMTP_USER && env.SMTP_PASS);
  return Boolean(env.EMAIL_PROVIDER && env.EMAIL_API_KEY && env.EMAIL_FROM);
};

let transporter: Transporter | undefined;
let transporterKey = "";

const smtpTransport = () => {
  const key = `${env.SMTP_HOST}:${env.SMTP_PORT}:${env.SMTP_USER}:${env.SMTP_PASS}`;
  if (!transporter || transporterKey !== key) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: SEND_TIMEOUT_MS,
      greetingTimeout: SEND_TIMEOUT_MS,
      socketTimeout: SEND_TIMEOUT_MS,
    });
    transporterKey = key;
  }
  return transporter;
};

// Accepts "a@b.com", "<a@b.com>" or "Name <a@b.com>"; Gmail only sends as the signed-in account anyway.
const smtpFromAddress = () => {
  const raw = (env.SMTP_FROM || env.SMTP_USER || "").trim();
  const match = /<([^>]+)>/.exec(raw);
  return (match ? match[1] : raw).trim();
};

// Many free hosts (Render included) block outbound SMTP ports, so the HTTPS APIs remain available.
const sendViaSmtp = async (mail: Mail) => {
  try {
    await smtpTransport().sendMail({
      from: { name: env.EMAIL_FROM_NAME, address: smtpFromAddress() },
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch (error) {
    const err = error as { code?: string; responseCode?: number; message?: string };
    logger.error("SMTP send failed", {
      host: env.SMTP_HOST,
      code: err.code,
      responseCode: err.responseCode,
      error: err.message,
    });
    throw sendFailed();
  }
};

const requestFor = (mail: Mail): { url: string; headers: Record<string, string>; body: unknown } => {
  if (env.EMAIL_PROVIDER === "brevo") {
    return {
      url: "https://api.brevo.com/v3/smtp/email",
      headers: { "api-key": env.EMAIL_API_KEY! },
      body: {
        sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM },
        to: [{ email: mail.to }],
        subject: mail.subject,
        textContent: mail.text,
        htmlContent: mail.html,
      },
    };
  }
  return {
    url: "https://api.resend.com/emails",
    headers: { Authorization: `Bearer ${env.EMAIL_API_KEY}` },
    body: {
      from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    },
  };
};

export const sendMail = async (mail: Mail) => {
  if (!isMailConfigured()) {
    throw new ApiError(503, "Email delivery is not configured", { code: "EMAIL_NOT_CONFIGURED" });
  }
  if (env.EMAIL_PROVIDER === "smtp") return sendViaSmtp(mail);
  const { url, headers, body } = requestFor(mail);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch (error) {
    logger.error("Email request failed", {
      provider: env.EMAIL_PROVIDER,
      error: error instanceof Error ? error.message : String(error),
    });
    throw sendFailed();
  }
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    logger.error("Email provider rejected the message", {
      provider: env.EMAIL_PROVIDER,
      status: response.status,
      detail,
    });
    throw sendFailed();
  }
};

const COPY: Record<CodePurpose, { subject: string; intro: string }> = {
  verify: {
    subject: "Your MedLog verification code",
    intro: "Use this code to verify your MedLog account:",
  },
  reset: {
    subject: "Your MedLog password reset code",
    intro: "Use this code to reset your MedLog password:",
  },
};

export const sendCodeEmail = (to: string, code: string, purpose: CodePurpose) => {
  const { subject, intro } = COPY[purpose];
  const footer = `The code expires in ${env.OTP_TTL_MINUTES} minutes. If you didn't request it, you can ignore this email.`;
  return sendMail({
    to,
    subject,
    text: `${intro}\n\n${code}\n\n${footer}`,
    html: `<div style="font-family:Arial,sans-serif;color:#1F3B4D">
<p>${intro}</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px;color:#2E7A96">${code}</p>
<p style="color:#6B7C86;font-size:13px">${footer}</p>
</div>`,
  });
};
