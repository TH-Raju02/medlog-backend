import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { Role } from "../constants/permissions";

interface AccessPayload {
  sub: string;
  role: Role;
  email: string;
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required", { code: "UNAUTHORIZED" }));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token", { code: "UNAUTHORIZED" }));
  }
};
