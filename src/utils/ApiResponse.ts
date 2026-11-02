import { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
  meta?: PaginationMeta
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown,
  code?: string
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(errors ? { errors } : {}),
  });
};
