import { Request, Response } from "express";
import { sendError } from "../utils/ApiResponse";

export const notFound = (_req: Request, res: Response) => {
  return sendError(res, "Route not found", 404, undefined, "NOT_FOUND");
};
