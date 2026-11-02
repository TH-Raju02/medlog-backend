import { NextFunction, Request, Response } from "express";
import { hasPermission, Permission } from "../constants/permissions";
import { ApiError } from "../utils/ApiError";

export const authorize =
  (...permissions: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required", { code: "UNAUTHORIZED" }));
    }

    const allowed = permissions.every((permission) =>
      hasPermission(req.user!.role, permission)
    );

    if (!allowed) {
      return next(new ApiError(403, "Forbidden", { code: "FORBIDDEN" }));
    }

    next();
  };
