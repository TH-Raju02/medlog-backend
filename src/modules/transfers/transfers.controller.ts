import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { transfersService } from "./transfers.service";

export const transfersController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await transfersService.list(req.user!.id, {
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
      status: req.query.status as string | undefined,
      admissionId: req.query.admissionId as string | undefined,
      box: req.query.box as "all" | "sent" | "received" | "completed" | undefined,
    });
    return sendSuccess(res, result.items, "Transfers loaded", 200, result.meta);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const item = await transfersService.getById(req.params.id);
    return sendSuccess(res, item, "Transfer loaded");
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const item = await transfersService.create(req.body, req.user!.id);
    return sendSuccess(res, item, "Transfer requested", 201);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const item = await transfersService.updateStatus(
      req.params.id,
      req.body.status,
      req.user!.id,
      req.user!.role === "admin"
    );
    return sendSuccess(res, item, "Transfer status updated");
  }),
};
