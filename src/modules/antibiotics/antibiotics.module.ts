import { Router } from "express";
import { z } from "zod";
import { Schema, model, Types } from "mongoose";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { Admission } from "../admissions/admissions.model";

/** Previous Antibiotics (not "Previous cultures") */
const antibioticSchema = new Schema(
  {
    admission: { type: Schema.Types.ObjectId, ref: "Admission", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    condition: { type: String },
    name: { type: String, required: true, trim: true },
    dose: { type: String },
    route: { type: String },
    frequency: { type: String },
    duration: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    indication: { type: String },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
antibioticSchema.index({ createdAt: -1 });
antibioticSchema.index({ startDate: -1 });

const PreviousAntibiotic = model("PreviousAntibiotic", antibioticSchema);

const fields = {
  condition: z.string().max(300).optional(),
  name: z.string().min(1).max(200),
  dose: z.string().max(120).optional(),
  route: z.string().max(80).optional(),
  frequency: z.string().max(120).optional(),
  duration: z.string().max(120).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  indication: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
};

const createSchema = z.object({
  body: z.object({ admissionId: z.string().min(1), ...fields }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ ...fields, name: fields.name.optional() }),
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
  authorize("antibiotics:read"),
  validateRequest(listSchema),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const filter: Record<string, unknown> = {};
    if (req.query.admissionId) filter.admission = req.query.admissionId;
    if (req.query.patientId) filter.patient = req.query.patientId;

    const [items, total] = await Promise.all([
      PreviousAntibiotic.find(filter)
        .sort({ startDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PreviousAntibiotic.countDocuments(filter),
    ]);

    return sendSuccess(res, items, "Previous antibiotics loaded", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  })
);

router.post(
  "/",
  authorize("antibiotics:create"),
  validateRequest(createSchema),
  asyncHandler(async (req, res) => {
    const admission = await Admission.findById(req.body.admissionId);
    if (!admission) throw new ApiError(404, "Admission not found");

    const { admissionId: _admissionId, ...data } = req.body;
    const item = await PreviousAntibiotic.create({
      ...data,
      admission: admission._id,
      patient: admission.patient,
      createdBy: new Types.ObjectId(req.user!.id),
    });

    return sendSuccess(res, item, "Previous antibiotic created", 201);
  })
);

router.patch(
  "/:id",
  authorize("antibiotics:update"),
  validateRequest(updateSchema),
  asyncHandler(async (req, res) => {
    const item = await PreviousAntibiotic.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!item) throw new ApiError(404, "Previous antibiotic not found");
    return sendSuccess(res, item, "Previous antibiotic updated");
  })
);

router.delete(
  "/:id",
  authorize("antibiotics:delete"),
  asyncHandler(async (req, res) => {
    const item = await PreviousAntibiotic.findByIdAndDelete(req.params.id);
    if (!item) throw new ApiError(404, "Previous antibiotic not found");
    return sendSuccess(res, null, "Previous antibiotic deleted");
  })
);

export default router;
export { PreviousAntibiotic };
