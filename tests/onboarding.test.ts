import request from "supertest";
import { createApp } from "../src/app";
import { registerAndLogin } from "./helpers";

const app = createApp();

describe("Onboarding: registration, password reset and subscriptions", () => {
  it("registers with job title, specialty and terms, using a 4-digit code", async () => {
    const register = await request(app).post("/api/v1/auth/register").send({
      firstName: "Sarah",
      lastName: "Khalid",
      email: "sarah@example.com",
      password: "Password123!",
      jobTitle: "Pharmacist",
      specialty: "Internal Medicine",
      acceptTerms: true,
    });
    expect(register.status).toBe(201);
    expect(register.body.data.user.jobTitle).toBe("Pharmacist");
    expect(register.body.data.user.specialty).toBe("Internal Medicine");
    expect(register.body.data.otpHint).toHaveLength(4);
    expect(register.body.data.user.subscription.status).toBe("none");

    const invalid = await request(app).post("/api/v1/auth/register").send({
      firstName: "X",
      lastName: "Y",
      email: "xy@example.com",
      password: "Password123!",
      jobTitle: "Astronaut",
    });
    expect(invalid.status).toBe(400);
  });

  it("resets a forgotten password with a verification code", async () => {
    await registerAndLogin(app, "reset@example.com");

    const unknown = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "nobody@example.com" });
    expect(unknown.status).toBe(200);
    expect(unknown.body.data.otpHint).toBeUndefined();

    const forgot = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "reset@example.com" });
    expect(forgot.status).toBe(200);
    const code = forgot.body.data.otpHint as string;

    const wrong = await request(app)
      .post("/api/v1/auth/verify-reset-code")
      .send({ email: "reset@example.com", code: "9999" });
    expect(wrong.status).toBe(400);

    const verified = await request(app)
      .post("/api/v1/auth/verify-reset-code")
      .send({ email: "reset@example.com", code });
    expect(verified.status).toBe(200);
    const resetToken = verified.body.data.resetToken as string;

    const reset = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ email: "reset@example.com", resetToken, password: "NewPassword123!" });
    expect(reset.status).toBe(200);

    const reused = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ email: "reset@example.com", resetToken, password: "Another123!" });
    expect(reused.status).toBe(400);

    const oldLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "reset@example.com", password: "Password123!" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "reset@example.com", password: "NewPassword123!" });
    expect(newLogin.status).toBe(200);
  });

  it("lists plans and reports when Stripe is not configured", async () => {
    const noToken = await request(app).get("/api/v1/subscriptions/plans");
    expect(noToken.status).toBe(401);

    const { token } = await registerAndLogin(app);
    const plans = await request(app)
      .get("/api/v1/subscriptions/plans")
      .set("Authorization", `Bearer ${token}`);
    expect(plans.status).toBe(200);
    expect(plans.body.data.paymentsEnabled).toBe(false);
    expect(plans.body.data.plans.map((p: { id: string }) => p.id)).toEqual([
      "monthly",
      "six_months",
      "annual",
    ]);

    const badPlan = await request(app)
      .post("/api/v1/subscriptions/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "weekly", returnUrl: "medlog://payment-result" });
    expect(badPlan.status).toBe(400);

    const badReturn = await request(app)
      .post("/api/v1/subscriptions/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "monthly", returnUrl: "https://evil.example.com/" });
    expect(badReturn.status).toBe(400);
    expect(badReturn.body.code).toBe("INVALID_RETURN_URL");

    const checkout = await request(app)
      .post("/api/v1/subscriptions/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "monthly", returnUrl: "medlog://payment-result" });
    expect(checkout.status).toBe(503);
    expect(checkout.body.code).toBe("PAYMENTS_NOT_CONFIGURED");
  });

  it("updates profile phone, job title and reminder time", async () => {
    const { token } = await registerAndLogin(app);
    const update = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ phone: "+965 5555 1234", jobTitle: "Doctor", preferences: { reminderTime: "08:30" } });
    expect(update.status).toBe(200);
    expect(update.body.data.phone).toBe("+965 5555 1234");
    expect(update.body.data.jobTitle).toBe("Doctor");
    expect(update.body.data.preferences.reminderTime).toBe("08:30");

    const invalid = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ preferences: { reminderTime: "25:00" } });
    expect(invalid.status).toBe(400);
  });
});
