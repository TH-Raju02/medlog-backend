import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

async function authToken() {
  await request(app).post("/api/v1/auth/register").send({
    firstName: "Doc",
    lastName: "Test",
    email: "doc@example.com",
    password: "Password123!",
  });
  const verify = await request(app).post("/api/v1/auth/verify-otp").send({
    email: "doc@example.com",
    code: "1234",
  });
  return verify.body.data.tokens.accessToken as string;
}

describe("Admissions & clinical validation", () => {
  it("creates admission without ward/room/bed and sorts newest first", async () => {
    const token = await authToken();

    const first = await request(app)
      .post("/api/v1/admissions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        patient: { firstName: "Older", lastName: "Patient" },
        chiefComplaint: "Fever",
        entryMode: "manual",
      });
    expect(first.status).toBe(201);
    expect(first.body.data.ward).toBeUndefined();

    await new Promise((r) => setTimeout(r, 20));

    const second = await request(app)
      .post("/api/v1/admissions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        patient: { firstName: "Newer", lastName: "Patient" },
        chiefComplaint: "Cough",
        ward: "A1",
        room: "12",
        bed: "B",
      });
    expect(second.status).toBe(201);

    const list = await request(app)
      .get("/api/v1/admissions")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data[0].patient.firstName).toBe("Newer");
  });

  it("requires only parameter for clinical entries", async () => {
    const token = await authToken();
    const admission = await request(app)
      .post("/api/v1/admissions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        patient: { firstName: "Clin", lastName: "Case" },
        chiefComplaint: "Sepsis workup",
      });

    const missing = await request(app)
      .post("/api/v1/clinical-parameters")
      .set("Authorization", `Bearer ${token}`)
      .send({
        admissionId: admission.body.data._id,
        valueGoal: "90",
      });
    expect(missing.status).toBe(400);

    const created = await request(app)
      .post("/api/v1/clinical-parameters")
      .set("Authorization", `Bearer ${token}`)
      .send({
        admissionId: admission.body.data._id,
        parameter: "MAP",
      });
    expect(created.status).toBe(201);
    expect(created.body.data.parameter).toBe("MAP");
  });
});
