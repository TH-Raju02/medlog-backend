import os from "os";
import path from "path";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

// Set before the app (and config/env.ts) is imported so a local .env can't leak into tests.
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-change-me-32";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-change-me-32";
process.env.ACCESS_TOKEN_TTL = "15m";
process.env.REFRESH_TOKEN_TTL = "7d";
process.env.DEFAULT_OTP = "1234";
process.env.OTP_MODE = "";
process.env.OTP_TTL_MINUTES = "10";
process.env.CORS_ORIGIN = "*";
process.env.LOG_LEVEL = "error";
process.env.STRIPE_SECRET_KEY = "";
process.env.STRIPE_WEBHOOK_SECRET = "";
process.env.UPLOAD_DIR = path.join(os.tmpdir(), "medlog-test-uploads");
process.env.EMAIL_PROVIDER = "";
process.env.EMAIL_API_KEY = "";
process.env.EMAIL_FROM = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
process.env.SMTP_FROM = "";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
}, 120000);

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
