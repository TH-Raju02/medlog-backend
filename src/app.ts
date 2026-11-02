import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import { env } from "./config/env";
import { requestLogger } from "./middlewares/requestLogger";
import { generalLimiter, paymentLimiter } from "./middlewares/rateLimiter";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { subscriptionsController } from "./modules/subscriptions/subscriptions.controller";
import routes from "./routes";

export const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
      credentials: true,
    })
  );
  // Stripe signs the raw payload, so the webhook must be registered before the JSON parser.
  app.post(
    "/api/v1/subscriptions/webhook",
    paymentLimiter,
    express.raw({ type: "application/json", limit: "1mb" }),
    subscriptionsController.webhook
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(mongoSanitize());
  app.use(requestLogger);
  app.use(generalLimiter);

  app.use("/api/v1", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
