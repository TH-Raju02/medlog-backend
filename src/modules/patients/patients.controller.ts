import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { patientsService } from "./patients.service";

export const patientsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientsService.create(req.body, req.user!.id);
    return sendSuccess(res, patient, "Patient created", 201);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const search = req.query.search as string | undefined;
    const sort = (req.query.sort as "recent" | "name" | "admission" | undefined) ?? "recent";
    const result = await patientsService.list(page, limit, search, sort);
    return sendSuccess(res, result.items, "Patients loaded", 200, result.meta);
  }),

  lookup: asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientsService.lookupByCivilId(String(req.query.civilId));
    return sendSuccess(res, patient, patient ? "Patient found" : "No patient profile found");
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientsService.getById(req.params.id);
    return sendSuccess(res, patient, "Patient loaded");
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const patient = await patientsService.update(req.params.id, req.body);
    return sendSuccess(res, patient, "Patient updated");
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await patientsService.remove(req.params.id);
    return sendSuccess(res, null, "Patient deleted");
  }),
};
