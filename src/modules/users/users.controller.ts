import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { usersService } from "./users.service";

export const usersController = {
  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.me(req.user!.id);
    return sendSuccess(res, user, "Profile loaded");
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.updateMe(req.user!.id, req.body);
    return sendSuccess(res, user, "Profile updated");
  }),

  colleagues: asyncHandler(async (req: Request, res: Response) => {
    const items = await usersService.colleagues(
      req.user!.id,
      req.query.search as string | undefined,
      Number(req.query.limit ?? 20)
    );
    return sendSuccess(res, items, "Colleagues loaded");
  }),
};
