import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { logger } from "../utils/logger";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);

  const start = Date.now();
  res.on("finish", () => {
    logger.info("HTTP request", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
};
