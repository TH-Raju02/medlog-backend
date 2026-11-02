import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { dashboardService } from "./dashboard.service";

export const dashboardController = {
  metrics: asyncHandler(async (req: Request, res: Response) => {
    const data = await dashboardService.metrics(req.query.month as string | undefined);
    return sendSuccess(res, data, "Dashboard metrics loaded");
  }),
};
