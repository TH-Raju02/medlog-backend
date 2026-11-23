import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { loadWritableAdmission } from "../clinical/admissionScoped";
import { scopedRecordFilter } from "../../utils/ownership";
import { HospitalMedication, MEDICATION_CATEGORIES } from "./medications.model";

const fields = {
  name: z.string().min(1).max(200),
  dose: z.string().max(120).optional(),
  route: z.string().max(80).optional(),
  frequency: z.string().max(120).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  notes: z.string().max(1000).optional(),
  category: z.enum(MEDICATION_CATEGORIES).optional(),
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
    category: z.enum(MEDICATION_CATEGORIES).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(50),
  }),
});

/** Edits are limited to records of the user's own, still-active admissions. */
const assertWritable = async (id: string, userId: string) => {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid id");
  const existing = await HospitalMedication.findById(id).select("admission");
  if (!existing) throw new ApiError(404, "Hospital medication not found");
  await loadWritableAdmission(String(existing.admission), userId);
};

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("medications:read"),
  validateRequest(listSchema),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 50);
    const filter: Record<string, unknown> = await scopedRecordFilter(req.user!.id, {
      admissionId: req.query.admissionId as string | undefined,
      patientId: req.query.patientId as string | undefined,
    });
    if (req.query.category === "hospital") {
      // Records created before categories existed are hospital medications.
      filter.category = { $in: ["hospital", null] };
    } else if (req.query.category) {
      filter.category = req.query.category;
    }

    const [items, total] = await Promise.all([
      HospitalMedication.find(filter)
        .sort({ startDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      HospitalMedication.countDocuments(filter),
    ]);

    return sendSuccess(res, items, "Hospital medications loaded", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  })
);

router.post(
  "/",
  authorize("medications:create"),
  validateRequest(createSchema),
  asyncHandler(async (req, res) => {
    const admission = await loadWritableAdmission(req.body.admissionId, req.user!.id);

    const item = await HospitalMedication.create({
      admission: admission._id,
      patient: admission.patient,
      category: req.body.category ?? "hospital",
      name: req.body.name,
      dose: req.body.dose,
      route: req.body.route,
      frequency: req.body.frequency,
      startDate: req.body.startDate,
      endDate: req.body.endDate ?? undefined,
      notes: req.body.notes,
      createdBy: new Types.ObjectId(req.user!.id),
    });

    return sendSuccess(res, item, "Hospital medication created", 201);
  })
);

router.patch(
  "/:id",
  authorize("medications:update"),
  validateRequest(updateSchema),
  asyncHandler(async (req, res) => {
    await assertWritable(req.params.id, req.user!.id);
    const { endDate, ...rest } = req.body as Record<string, unknown>;
    const update: Record<string, unknown> = { $set: rest };
    if (endDate === null) update.$unset = { endDate: 1 };
    else if (endDate !== undefined) (update.$set as Record<string, unknown>).endDate = endDate;

    const item = await HospitalMedication.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!item) throw new ApiError(404, "Hospital medication not found");
    return sendSuccess(res, item, "Hospital medication updated");
  })
);

router.delete(
  "/:id",
  authorize("medications:delete"),
  asyncHandler(async (req, res) => {
    await assertWritable(req.params.id, req.user!.id);
    const item = await HospitalMedication.findByIdAndDelete(req.params.id);
    if (!item) throw new ApiError(404, "Hospital medication not found");
    return sendSuccess(res, null, "Hospital medication deleted");
  })
);

export default router;
export { HospitalMedication };
