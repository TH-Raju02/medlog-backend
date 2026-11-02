import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { admissionsService } from "./admissions.service";

export const admissionsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const admission = await admissionsService.create(req.body, req.user!.id);
    return sendSuccess(res, admission, "Admission created", 201);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await admissionsService.list({
      page: Number(req.query.page ?? 1),
      limit: Number(req.query.limit ?? 20),
      status: req.query.status as string | undefined,
      specialty: req.query.specialty as string | undefined,
      patientId: req.query.patientId as string | undefined,
      search: req.query.search as string | undefined,
    });
    return sendSuccess(res, result.items, "Admissions loaded", 200, result.meta);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const admission = await admissionsService.getById(req.params.id);
    return sendSuccess(res, admission, "Admission loaded");
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const admission = await admissionsService.update(req.params.id, req.body);
    return sendSuccess(res, admission, "Admission updated");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await admissionsService.remove(req.params.id);
    return sendSuccess(res, null, "Admission deleted");
  }),

  review: asyncHandler(async (req: Request, res: Response) => {
    const admission = await admissionsService.markReviewed(req.params.id, req.user!.id);
    return sendSuccess(res, admission, "Marked as reviewed");
  }),

  undoReview: asyncHandler(async (req: Request, res: Response) => {
    const admission = await admissionsService.undoReview(req.params.id);
    return sendSuccess(res, admission, "Review undone");
  }),

  discharge: asyncHandler(async (req: Request, res: Response) => {
    const admission = await admissionsService.discharge(req.params.id, req.body ?? {}, req.user!.id);
    return sendSuccess(res, admission, "Patient discharged");
  }),

  handover: asyncHandler(async (req: Request, res: Response) => {
    const transfer = await admissionsService.handover(
      req.params.id,
      req.body.toUserId,
      req.user!.id,
      req.body.notes
    );
    return sendSuccess(res, transfer, "Handover requested", 201);
  }),
};
