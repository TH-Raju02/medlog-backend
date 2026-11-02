import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { remindersService } from "./reminders.service";

export const remindersController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await remindersService.list(
      req.user!.id,
      Number(req.query.page ?? 1),
      Number(req.query.limit ?? 50),
      (req.query.status as "open" | "all" | undefined) ?? "all"
    );
    return sendSuccess(res, result.items, "Reminders loaded", 200, result.meta);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const reminder = await remindersService.create(req.user!.id, req.body);
    return sendSuccess(res, reminder, "Reminder created", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const reminder = await remindersService.update(req.user!.id, req.params.id, req.body);
    return sendSuccess(res, reminder, "Reminder updated");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await remindersService.remove(req.user!.id, req.params.id);
    return sendSuccess(res, null, "Reminder deleted");
  }),
};
