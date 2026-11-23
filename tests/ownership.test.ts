import request from "supertest";
import { createApp } from "../src/app";
import { createAdmission, registerAndLogin } from "./helpers";

const app = createApp();
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Private patient data, duplicate admissions and handovers", () => {
  it("shows each clinician only their own patients and admissions", async () => {
    const admin = await registerAndLogin(app, "a@example.com");
    const clinician = await registerAndLogin(app, "c@example.com");
    const admission = await createAdmission(app, admin.token);

    const theirAdmissions = await request(app).get("/api/v1/admissions").set(bearer(clinician.token));
    expect(theirAdmissions.body.data).toHaveLength(0);
    const theirPatients = await request(app).get("/api/v1/patients").set(bearer(clinician.token));
    expect(theirPatients.body.data).toHaveLength(0);
    const metrics = await request(app).get("/api/v1/dashboard/metrics").set(bearer(clinician.token));
    expect(metrics.body.data.currentAdmissions).toHaveLength(0);

    const direct = await request(app).get(`/api/v1/admissions/${admission._id}`).set(bearer(clinician.token));
    expect(direct.status).toBe(404);
    const patient = await request(app).get(`/api/v1/patients/${admission.patient._id}`).set(bearer(clinician.token));
    expect(patient.status).toBe(404);
    const meds = await request(app)
      .get("/api/v1/medications")
      .query({ admissionId: admission._id })
      .set(bearer(clinician.token));
    expect(meds.status).toBe(404);
    const write = await request(app)
      .post("/api/v1/clinical-parameters")
      .set(bearer(clinician.token))
      .send({ admissionId: admission._id, parameter: "BP" });
    expect(write.status).toBe(404);

    const mine = await request(app).get("/api/v1/admissions").set(bearer(admin.token));
    expect(mine.body.data).toHaveLength(1);
  });

  it("refuses a second active admission for the same Civil ID and reuses the profile after discharge", async () => {
    const doc = await registerAndLogin(app);
    const first = await createAdmission(app, doc.token);

    const lookup = await request(app)
      .get("/api/v1/patients/lookup")
      .query({ civilId: "295010100001" })
      .set(bearer(doc.token));
    expect(lookup.body.data.activeAdmission._id).toBe(first._id);

    const again = await request(app)
      .post("/api/v1/admissions")
      .set(bearer(doc.token))
      .send({ patient: { firstName: "Dana", lastName: "Fahad", nationalId: "295010100001" }, chiefComplaint: "x" });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("PATIENT_ALREADY_ADMITTED");

    const byId = await request(app)
      .post("/api/v1/admissions")
      .set(bearer(doc.token))
      .send({ patientId: first.patient._id, chiefComplaint: "x" });
    expect(byId.status).toBe(409);

    const discharge = await request(app)
      .post(`/api/v1/admissions/${first._id}/discharge`)
      .set(bearer(doc.token))
      .send({ summary: "Stable", medicalHistory: "Hypertension, CKD stage 3" });
    expect(discharge.status).toBe(200);
    expect(discharge.body.data.medicalHistory).toBe("Hypertension, CKD stage 3");

    const readmit = await request(app)
      .post("/api/v1/admissions")
      .set(bearer(doc.token))
      .send({ patient: { firstName: "Dana", lastName: "Fahad", nationalId: "295010100001" }, chiefComplaint: "y" });
    expect(readmit.status).toBe(201);
    expect(readmit.body.data.patient._id).toBe(first.patient._id);

    const patients = await request(app).get("/api/v1/patients").set(bearer(doc.token));
    expect(patients.body.data).toHaveLength(1);
  });

  it("moves the patient file to the receiver once a handover is accepted", async () => {
    const sender = await registerAndLogin(app, "sender@example.com");
    const receiver = await registerAndLogin(app, "receiver@example.com");
    const old = await createAdmission(app, sender.token);
    await request(app).post(`/api/v1/admissions/${old._id}/discharge`).set(bearer(sender.token)).send({ summary: "ok" });
    const current = await createAdmission(app, sender.token);

    const handover = await request(app)
      .post(`/api/v1/admissions/${current._id}/handover`)
      .set(bearer(sender.token))
      .send({ toUserId: receiver.userId });
    expect(handover.status).toBe(201);

    // Not visible to the receiver until accepted.
    const before = await request(app).get("/api/v1/admissions").set(bearer(receiver.token));
    expect(before.body.data).toHaveLength(0);

    await request(app)
      .patch(`/api/v1/transfers/${handover.body.data._id}/status`)
      .set(bearer(receiver.token))
      .send({ status: "accepted" });

    const theirs = await request(app).get("/api/v1/admissions").set(bearer(receiver.token));
    expect(theirs.body.data.map((a: { _id: string }) => a._id).sort()).toEqual([old._id, current._id].sort());
    const theirPatients = await request(app).get("/api/v1/patients").set(bearer(receiver.token));
    expect(theirPatients.body.data).toHaveLength(1);

    const senderNow = await request(app).get("/api/v1/admissions").set(bearer(sender.token));
    expect(senderNow.body.data).toHaveLength(0);
  });

  it("moves reference files between folders and serves them from the database", async () => {
    const { token } = await registerAndLogin(app);
    const auth = bearer(token);
    const a = await request(app).post("/api/v1/references/folders").set(auth).send({ name: "Antibiotics" });
    const b = await request(app)
      .post("/api/v1/references/folders")
      .set(auth)
      .send({ name: "Renal", parentId: a.body.data._id });
    const file = await request(app)
      .post("/api/v1/references/files")
      .set(auth)
      .attach("file", pdf, { filename: "Dosing.pdf", contentType: "application/pdf" });

    const folders = await request(app).get("/api/v1/references/folders").set(auth);
    expect(folders.body.data.map((f: { path: string }) => f.path)).toEqual(["Antibiotics", "Antibiotics / Renal"]);

    const moved = await request(app)
      .patch(`/api/v1/references/${file.body.data._id}/move`)
      .set(auth)
      .send({ parentId: b.body.data._id });
    expect(moved.status).toBe(200);
    const inside = await request(app).get("/api/v1/references").query({ parentId: b.body.data._id }).set(auth);
    expect(inside.body.data.items).toHaveLength(1);

    const cycle = await request(app)
      .patch(`/api/v1/references/${a.body.data._id}/move`)
      .set(auth)
      .send({ parentId: b.body.data._id });
    expect(cycle.status).toBe(400);

    const link = await request(app).get(`/api/v1/references/${file.body.data._id}/link`).set(auth);
    const url = new URL(link.body.data.viewUrl);
    const served = await request(app).get(url.pathname);
    expect(served.status).toBe(200);
    expect(served.headers["content-disposition"]).toContain("inline");
    expect(Buffer.from(served.body).toString()).toContain("%PDF");
  });
});
