import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("Auth & authorization", () => {
  it("registers, rejects unverified login, verifies OTP, and returns tokens", async () => {
    const register = await request(app).post("/api/v1/auth/register").send({
      firstName: "Ali",
      lastName: "Hassan",
      email: "ali@example.com",
      password: "Password123!",
    });

    expect(register.status).toBe(201);
    expect(register.body.data.user.country).toBe("Kuwait");
    expect(register.body.data.user.countryCode).toBe("KW");

    const unverifiedLogin = await request(app).post("/api/v1/auth/login").send({
      email: "ali@example.com",
      password: "Password123!",
    });
    expect(unverifiedLogin.status).toBe(403);

    const verify = await request(app).post("/api/v1/auth/verify-otp").send({
      email: "ali@example.com",
      code: "1234",
    });
    expect(verify.status).toBe(200);
    expect(verify.body.data.tokens.accessToken).toBeDefined();

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${verify.body.data.tokens.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("ali@example.com");
  });

  it("returns 401 without token and 403 for forbidden manage permission", async () => {
    const register = await request(app).post("/api/v1/auth/register").send({
      firstName: "Noor",
      lastName: "Saleh",
      email: "noor@example.com",
      password: "Password123!",
    });
    expect(register.status).toBe(201);

    await request(app).post("/api/v1/auth/verify-otp").send({
      email: "noor@example.com",
      code: "1234",
    });

    const login = await request(app).post("/api/v1/auth/login").send({
      email: "noor@example.com",
      password: "Password123!",
    });

    const unauthorized = await request(app).get("/api/v1/patients");
    expect(unauthorized.status).toBe(401);

    const forbidden = await request(app)
      .post("/api/v1/specialties")
      .set("Authorization", `Bearer ${login.body.data.tokens.accessToken}`)
      .send({ name: "Forbidden Specialty" });
    expect(forbidden.status).toBe(403);
  });
});
