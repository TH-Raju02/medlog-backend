import { createApp } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./database/mongo";
import { logger } from "./utils/logger";

const start = async () => {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`MedLog API listening on port ${env.PORT}`);
    if (env.OTP_MODE === "fixed") {
      logger.warn(
        "OTP_MODE=fixed: verification and reset codes are fixed and not emailed. Set OTP_MODE=email for real users."
      );
    }
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
};

start().catch((error) => {
  logger.error("Failed to start server", { error });
  process.exit(1);
});
