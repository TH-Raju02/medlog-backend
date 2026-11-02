import request from "supertest";
import nodemailer from "nodemailer";
import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { User } from "../src/modules/auth/auth.model";

jest.mock("nodemailer");

const app = createApp();
const original = { ...env };
const smtpSend = jest.fn();
(nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: smtpSend });
const fetchMock = jest.fn();
const realFetch = global.fetch;

const configure = (overrides: Partial<typeof env>) => Object.assign(env, overrides);
const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body as string);

const register = (email: string) =>
  request(app).post("/api/v1/auth/register").send({
    firstName: "Mail",
    lastName: "Test",
    email,
    password: "Password123!",
    acceptTerms: true,
  });

beforeEach(() => {
  fetchMock.mockReset();
  smtpSend.mockReset();
  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: smtpSend });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  Object.assign(env, original);
  global.fetch = realFetch;
});

describe("Email delivery of verification and reset codes", () => {
  it("emails a random code through Brevo in production and verifies with it", async () => {
    configure({
      NODE_ENV: "production",
      EMAIL_PROVIDER: "brevo",
      EMAIL_API_KEY: "test-key",
      EMAIL_FROM: "no-reply@medlog.test",
    });
    fetchMock.mockResolvedValue(new Response("{}", { status: 201 }));

    const res = await register("prod@example.com");
    expect(res.status).toBe(201);
    expect(res.body.data.otpHint).toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("test-key");
    const body = sentBody();
    expect(body.to).toEqual([{ email: "prod@example.com" }]);
    const code = /\b(\d{4})\b/.exec(body.textContent)![1];

    const verify = await request(app)
      .post("/api/v1/auth/verify-otp")
      .send({ email: "prod@example.com", code });
    expect(verify.status).toBe(200);
    expect(verify.body.data.tokens.accessToken).toBeTruthy();
  });

  it("sends through Gmail SMTP with the app password", async () => {
    configure({
      NODE_ENV: "production",
      EMAIL_PROVIDER: "smtp",
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: 465,
      SMTP_USER: "sender@gmail.com",
      SMTP_PASS: "apppassword",
      SMTP_FROM: "<sender@gmail.com>",
    });
    smtpSend.mockResolvedValue({ messageId: "1" });

    const res = await register("smtp@example.com");
    expect(res.status).toBe(201);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: "sender@gmail.com", pass: "apppassword" },
      })
    );
    const message = smtpSend.mock.calls[0][0];
    expect(message.to).toBe("smtp@example.com");
    expect(message.from).toEqual({ name: "MedLog", address: "sender@gmail.com" });
    expect(message.text).toMatch(/\b\d{4}\b/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an SMTP failure as EMAIL_SEND_FAILED", async () => {
    configure({ EMAIL_PROVIDER: "smtp", SMTP_USER: "sender@gmail.com", SMTP_PASS: "wrong" });
    smtpSend.mockRejectedValue(Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 }));

    const res = await register("smtpfail@example.com");
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("EMAIL_SEND_FAILED");
  });

  it("uses the Resend API when selected", async () => {
    configure({ EMAIL_PROVIDER: "resend", EMAIL_API_KEY: "re_key", EMAIL_FROM: "codes@medlog.test" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const res = await register("resend@example.com");
    expect(res.status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_key");
    expect(sentBody().to).toEqual(["resend@example.com"]);
    expect(sentBody().text).toContain("1234");
  });

  it("removes the new account when the code can't be sent, so the user can retry", async () => {
    configure({ EMAIL_PROVIDER: "brevo", EMAIL_API_KEY: "bad", EMAIL_FROM: "no-reply@medlog.test" });
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));

    const res = await register("fail@example.com");
    expect(res.status).toBe(502);
    expect(res.body.code).toBe("EMAIL_SEND_FAILED");
    expect(await User.countDocuments({ email: "fail@example.com" })).toBe(0);
  });

  it("refuses sign-up in production when email isn't configured", async () => {
    configure({ NODE_ENV: "production" });

    const res = await register("nomail@example.com");
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("EMAIL_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers forgot-password the same way even if the email fails", async () => {
    await register("forgot@example.com");
    await request(app).post("/api/v1/auth/verify-otp").send({ email: "forgot@example.com", code: "1234" });
    configure({ EMAIL_PROVIDER: "brevo", EMAIL_API_KEY: "k", EMAIL_FROM: "no-reply@medlog.test" });
    fetchMock.mockRejectedValue(new Error("network down"));

    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "forgot@example.com" });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
