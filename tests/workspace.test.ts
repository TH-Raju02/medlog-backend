import request from "supertest";
import { createApp } from "../src/app";
import { createAdmission, registerAndLogin } from "./helpers";

const app = createApp();

describe("Clinical workspace", () => {
  it("assigns admission codes and supports daily review and undo", async () => {
    const { token } = await registerAndLogin(app);
    const first = await createAdmission(app, token);
    const second = await createAdmission(app, token, {
      patient: { firstName: "Ahmad", lastName: "Fahad" },
    });
    expect(first.code).toBe("ADM-001");
    expect(second.code).toBe("ADM-002");

    const reviewed = await request(app)
      .post(`/api/v1/admissions/${first._id}/review`)
      .set("Authorization", `Bearer ${token}`);
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.lastReviewedAt).toBeDefined();

    const undone = await request(app)
      .delete(`/api/v1/admissions/${first._id}/review`)
      .set("Authorization", `Bearer ${token}`);
    expect(undone.status).toBe(200);
    expect(undone.body.data.lastReviewedAt).toBeUndefined();
  });

  it("finds a patient by civil ID and lists patients with their latest admission", async () => {
    const { token } = await registerAndLogin(app);
    await createAdmission(app, token);

    const found = await request(app)
      .get("/api/v1/patients/lookup")
      .query({ civilId: "295010100001" })
      .set("Authorization", `Bearer ${token}`);
    expect(found.status).toBe(200);
    expect(found.body.data.firstName).toBe("Dana");

    const missing = await request(app)
      .get("/api/v1/patients/lookup")
      .query({ civilId: "000" })
      .set("Authorization", `Bearer ${token}`);
    expect(missing.status).toBe(200);
    expect(missing.body.data).toBeNull();

    const list = await request(app)
      .get("/api/v1/patients")
      .query({ sort: "name" })
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data[0].latestAdmission.status).toBe("active");
  });

  it("saves plans, reconciliation and lab tables, then discharges with medications", async () => {
    const { token } = await registerAndLogin(app);
    const admission = await createAdmission(app, token);
    const auth = { Authorization: `Bearer ${token}` };

    const plans = await request(app)
      .post("/api/v1/recommendations/bulk")
      .set(auth)
      .send({
        admissionId: admission._id,
        items: [
          { text: "Initial calcium infusion", dtp: "effectiveness" },
          { text: "Initial chloride administration" },
        ],
      });
    expect(plans.status).toBe(201);
    expect(plans.body.data).toHaveLength(2);

    const badDtp = await request(app)
      .post("/api/v1/recommendations")
      .set(auth)
      .send({ admissionId: admission._id, text: "X", dtp: "cost" });
    expect(badDtp.status).toBe(400);

    const rec = await request(app)
      .post("/api/v1/medication-reconciliations")
      .set(auth)
      .send({ admissionId: admission._id, drug: "Metformin", dose: "500 mg", route: "PO", frequency: "BID", discrepancy: "None" });
    expect(rec.status).toBe(201);

    const labs = await request(app)
      .put("/api/v1/lab-results/replace")
      .set(auth)
      .send({
        admissionId: admission._id,
        items: [
          { testName: "Creatinine", date: "2026-10-12", reference: "0.6–1.2 mg/dL", value: "1.4 mg/dL" },
          { testName: "Potassium", date: "2026-10-12", reference: "3.5–5.1 mmol/L", value: "4.3" },
        ],
      });
    expect(labs.status).toBe(200);
    expect(labs.body.data).toHaveLength(2);

    const keep = labs.body.data.find((l: { testName: string }) => l.testName === "Creatinine");
    const synced = await request(app)
      .put("/api/v1/lab-results/replace")
      .set(auth)
      .send({ admissionId: admission._id, items: [{ ...keep, value: "1.5 mg/dL" }] });
    expect(synced.body.data).toHaveLength(1);
    expect(synced.body.data[0].value).toBe("1.5 mg/dL");

    const discharge = await request(app)
      .post(`/api/v1/admissions/${admission._id}/discharge`)
      .set(auth)
      .send({
        summary: "Patient is hemodynamically stable.",
        counselingCompleted: true,
        medications: [{ name: "Paracetamol", dose: "1 g", route: "PO", frequency: "TID" }],
      });
    expect(discharge.status).toBe(200);
    expect(discharge.body.data.status).toBe("discharged");
    expect(discharge.body.data.dischargeCounseling).toBe(true);

    const meds = await request(app)
      .get("/api/v1/medications")
      .query({ patientId: admission.patient._id, category: "discharge" })
      .set(auth);
    expect(meds.body.data).toHaveLength(1);

    const locked = await request(app)
      .post("/api/v1/recommendations")
      .set(auth)
      .send({ admissionId: admission._id, text: "Too late" });
    expect(locked.status).toBe(409);

    const metrics = await request(app)
      .get("/api/v1/dashboard/metrics")
      .set(auth);
    expect(metrics.status).toBe(200);
    expect(metrics.body.data.casesThisMonth).toBe(1);
    expect(metrics.body.data.drugTherapyProblems).toBe(1);
    expect(metrics.body.data.medicationReconciliation).toBe(1);
    expect(metrics.body.data.dischargeCounseling).toBe(1);

    const badMonth = await request(app)
      .get("/api/v1/dashboard/metrics")
      .query({ month: "2026-13" })
      .set(auth);
    expect(badMonth.status).toBe(400);
  });

  it("hands a patient over to a colleague who accepts it", async () => {
    const sender = await registerAndLogin(app, "sender@example.com");
    const receiver = await registerAndLogin(app, "receiver@example.com", { specialty: "Cardiology" });
    const admission = await createAdmission(app, sender.token);

    const colleagues = await request(app)
      .get("/api/v1/users/colleagues")
      .set("Authorization", `Bearer ${sender.token}`);
    expect(colleagues.body.data.map((u: { email: string }) => u.email)).toEqual([
      "receiver@example.com",
    ]);

    const handover = await request(app)
      .post(`/api/v1/admissions/${admission._id}/handover`)
      .set("Authorization", `Bearer ${sender.token}`)
      .send({ toUserId: receiver.userId });
    expect(handover.status).toBe(201);
    expect(handover.body.data.transferType).toBe("handoff");

    const received = await request(app)
      .get("/api/v1/transfers")
      .query({ box: "received" })
      .set("Authorization", `Bearer ${receiver.token}`);
    expect(received.body.data).toHaveLength(1);
    expect(received.body.meta.pendingReceived).toBe(1);

    const senderAccept = await request(app)
      .patch(`/api/v1/transfers/${handover.body.data._id}/status`)
      .set("Authorization", `Bearer ${sender.token}`)
      .send({ status: "accepted" });
    expect(senderAccept.status).toBe(403);

    const accept = await request(app)
      .patch(`/api/v1/transfers/${handover.body.data._id}/status`)
      .set("Authorization", `Bearer ${receiver.token}`)
      .send({ status: "accepted" });
    expect(accept.status).toBe(200);
    expect(accept.body.data.status).toBe("completed");

    const updated = await request(app)
      .get(`/api/v1/admissions/${admission._id}`)
      .set("Authorization", `Bearer ${receiver.token}`);
    expect(updated.body.data.assignedTo.email).toBe("receiver@example.com");
    expect(updated.body.data.specialty).toBe("Cardiology");
  });
});
