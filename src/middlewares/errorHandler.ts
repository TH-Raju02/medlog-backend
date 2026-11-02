import fs from "fs";
import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { MulterError } from "multer";
import { Error as MongooseError } from "mongoose";
import { ApiError } from "../utils/ApiError";
import { sendError } from "../utils/ApiResponse";
import { logger } from "../utils/logger";
import { env } from "../config/env";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // A disk upload that never reached a saved record must not be left behind.
  if (req.file?.path) {
    fs.promises.unlink(req.file.path).catch(() => undefined);
  }

  if (err instanceof ApiError) {
    return sendError(res, err.message, err.statusCode, err.errors, err.code);
  }

  if (err instanceof ZodError) {
    return sendError(
      res,
      "Validation failed",
      400,
      err.flatten(),
      "VALIDATION_ERROR"
    );
  }

  if (err instanceof MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message;
    return sendError(res, message, 400, undefined, "UPLOAD_ERROR");
  }

  if (err instanceof MongooseError.CastError) {
    return sendError(res, `Invalid ${err.path}`, 400, undefined, "VALIDATION_ERROR");
  }

  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  ) {
    return sendError(res, "Duplicate record", 409, undefined, "DUPLICATE");
  }

  logger.error("Unhandled error", {
    error: err instanceof Error ? err.message : err,
    stack: err instanceof Error ? err.stack : undefined,
  });

  return sendError(
    res,
    env.NODE_ENV === "production" ? "Internal server error" : String(err),
    500,
    undefined,
    "INTERNAL_ERROR"
  );
};
