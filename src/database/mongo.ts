import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";

export const connectDatabase = async (): Promise<void> => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  logger.info("MongoDB connected");
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected");
};
