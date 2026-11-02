import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { ClinicalParameter } from "./clinicalParameters.model";
import { Admission } from "../admissions/admissions.model";

const createSchema = z.object({
  body: z.object({
    admissionId: z.string().min(1),
    parameter: z.string().min(1).max(200),
    valueGoal: z.string().max(500).optional(),
    planRecommendation: z.string().max(1000).optional(),
    recordedAt: z.coerce.date().optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    parameter: z.string().min(1).max(200).optional(),
    valueGoal: z.string().max(500).optional(),
    planRecommendation: z.string().max(1000).optional(),
    recordedAt: z.coerce.date().optional(),
  }),
});

const listSchema = z.object({
  query: z.object({
    admissionId: z.string().optional(),
    patientId: z.string().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(50),
  }),
});

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("clinical:read"),
  validateRequest(listSchema),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const filter: Record<string, unknown> = {};
    if (req.query.admissionId) filter.admission = req.query.admissionId;
    if (req.query.patientId) filter.patient = req.query.patientId;

    const [items, total] = await Promise.all([
      ClinicalParameter.find(filter)
        .sort({ recordedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ClinicalParameter.countDocuments(filter),
    ]);

    return sendSuccess(res, items, "Clinical parameters loaded", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  })
);

router.post(
  "/",
  authorize("clinical:create"),
  validateRequest(createSchema),
  asyncHandler(async (req, res) => {
    const admission = await Admission.findById(req.body.admissionId);
    if (!admission) throw new ApiError(404, "Admission not found");

    const item = await ClinicalParameter.create({
      admission: admission._id,
      patient: admission.patient,
      parameter: req.body.parameter,
      valueGoal: req.body.valueGoal,
      planRecommendation: req.body.planRecommendation,
      recordedAt: req.body.recordedAt ?? new Date(),
      createdBy: new Types.ObjectId(req.user!.id),
    });

    return sendSuccess(res, item, "Clinical parameter created", 201);
  })
);

router.patch(
  "/:id",
  authorize("clinical:update"),
  validateRequest(updateSchema),
  asyncHandler(async (req, res) => {
    const item = await ClinicalParameter.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!item) throw new ApiError(404, "Clinical parameter not found");
    return sendSuccess(res, item, "Clinical parameter updated");
  })
);

router.delete(
  "/:id",
  authorize("clinical:delete"),
  asyncHandler(async (req, res) => {
    const item = await ClinicalParameter.findByIdAndDelete(req.params.id);
    if (!item) throw new ApiError(404, "Clinical parameter not found");
    return sendSuccess(res, null, "Clinical parameter deleted");
  })
);

export default router;
