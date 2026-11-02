import request from "supertest";
import { Express } from "express";

export async function registerAndLogin(
  app: Express,
  email = "doc@example.com",
  extra: Record<string, unknown> = {}
) {
  await request(app)
    .post("/api/v1/auth/register")
    .send({ firstName: "Doc", lastName: "Test", email, password: "Password123!", ...extra });
  const verify = await request(app).post("/api/v1/auth/verify-otp").send({ email, code: "1234" });
  return {
    token: verify.body.data.tokens.accessToken as string,
    userId: verify.body.data.user.id as string,
  };
}

export async function createAdmission(app: Express, token: string, body: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/v1/admissions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      patient: { firstName: "Dana", lastName: "Fahad", nationalId: "295010100001", gender: "female" },
      chiefComplaint: "Acute kidney injury",
      diagnosis: "AKI",
      medicalHistory: "Hypertension",
      specialty: "Internal Medicine",
      ...body,
    });
  return res.body.data as { _id: string; code: string; patient: { _id: string } };
}
