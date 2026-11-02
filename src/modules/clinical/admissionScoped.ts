import { Router } from "express";
import { z, ZodRawShape } from "zod";
import { Model, Types } from "mongoose";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { Permission } from "../../constants/permissions";
import { Admission } from "../admissions/admissions.model";

interface Options {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  /** Writable fields; the first required field makes an item valid. */
  fields: ZodRawShape;
  label: string;
  permissions: { read: Permission; create: Permission; update: Permission; delete: Permission };
  sort: Record<string, 1 | -1>;
}

const loadWritableAdmission = async (admissionId: string) => {
  if (!Types.ObjectId.isValid(admissionId)) throw new ApiError(400, "Invalid admission id");
  const admission = await Admission.findById(admissionId);
  if (!admission) throw new ApiError(404, "Admission not found");
  if (admission.status === "discharged") {
    throw new ApiError(409, "This admission is discharged and can no longer be edited", {
      code: "ADMISSION_DISCHARGED",
    });
  }
  return admission;
};

/**
 * CRUD router for records that belong to one admission (reconciliation, plans, labs, cultures).
 * Besides single-item routes it supports `POST /bulk` (add many) and `PUT /replace`
 * (sync a whole editable table: rows without `_id` are created, missing rows are deleted).
 */
export const admissionScopedRouter = ({ model, fields, label, permissions, sort }: Options) => {
  const item = z.object(fields);
  const partial = item.partial();
  const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

  const listSchema = z.object({
    query: z.object({
      admissionId: z.string().optional(),
      patientId: z.string().optional(),
      page: z.coerce.number().int().positive().optional().default(1),
      limit: z.coerce.number().int().positive().max(200).optional().default(100),
    }),
  });
  const createSchema = z.object({ body: item.extend({ admissionId: z.string().min(1) }) });
  const bulkSchema = z.object({
    body: z.object({ admissionId: z.string().min(1), items: z.array(item).min(1).max(100) }),
  });
  const replaceSchema = z.object({
    body: z.object({
      admissionId: z.string().min(1),
      items: z.array(item.extend({ _id: objectId.optional() })).max(200),
    }),
  });
  const updateSchema = z.object({ params: z.object({ id: objectId }), body: partial });
  const idSchema = z.object({ params: z.object({ id: objectId }) });

  const router = Router();
  router.use(authenticate);

  router.get(
    "/",
    authorize(permissions.read),
    validateRequest(listSchema),
    asyncHandler(async (req, res) => {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 100);
      const filter: Record<string, unknown> = {};
      if (req.query.admissionId) filter.admission = req.query.admissionId;
      if (req.query.patientId) filter.patient = req.query.patientId;
      const [items, total] = await Promise.all([
        model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
        model.countDocuments(filter),
      ]);
      return sendSuccess(res, items, `${label} loaded`, 200, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      });
    })
  );

  router.post(
    "/",
    authorize(permissions.create),
    validateRequest(createSchema),
    asyncHandler(async (req, res) => {
      const { admissionId, ...data } = req.body;
      const admission = await loadWritableAdmission(admissionId);
      const created = await model.create({
        ...data,
        admission: admission._id,
        patient: admission.patient,
        createdBy: new Types.ObjectId(req.user!.id),
      });
      return sendSuccess(res, created, `${label} created`, 201);
    })
  );

  router.post(
    "/bulk",
    authorize(permissions.create),
    validateRequest(bulkSchema),
    asyncHandler(async (req, res) => {
      const admission = await loadWritableAdmission(req.body.admissionId);
      const createdBy = new Types.ObjectId(req.user!.id);
      const created = await model.insertMany(
        (req.body.items as Record<string, unknown>[]).map((data) => ({
          ...data,
          admission: admission._id,
          patient: admission.patient,
          createdBy,
        }))
      );
      return sendSuccess(res, created, `${label} created`, 201);
    })
  );

  router.put(
    "/replace",
    authorize(permissions.update),
    validateRequest(replaceSchema),
    asyncHandler(async (req, res) => {
      const admission = await loadWritableAdmission(req.body.admissionId);
      const createdBy = new Types.ObjectId(req.user!.id);
      const rows = req.body.items as Array<Record<string, unknown> & { _id?: string }>;
      const keepIds = rows.filter((r) => r._id).map((r) => new Types.ObjectId(r._id));

      await model.deleteMany({ admission: admission._id, _id: { $nin: keepIds } });
      for (const row of rows) {
        const { _id, ...data } = row;
        if (_id) {
          await model.updateOne({ _id, admission: admission._id }, { $set: data }, { runValidators: true });
        } else {
          await model.create({ ...data, admission: admission._id, patient: admission.patient, createdBy });
        }
      }

      const items = await model.find({ admission: admission._id }).sort(sort);
      return sendSuccess(res, items, `${label} saved`);
    })
  );

  router.patch(
    "/:id",
    authorize(permissions.update),
    validateRequest(updateSchema),
    asyncHandler(async (req, res) => {
      const existing = await model.findById(req.params.id);
      if (!existing) throw new ApiError(404, `${label} not found`);
      await loadWritableAdmission(String(existing.admission));
      const updated = await model.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );
      return sendSuccess(res, updated, `${label} updated`);
    })
  );

  router.delete(
    "/:id",
    authorize(permissions.delete),
    validateRequest(idSchema),
    asyncHandler(async (req, res) => {
      const existing = await model.findById(req.params.id);
      if (!existing) throw new ApiError(404, `${label} not found`);
      await loadWritableAdmission(String(existing.admission));
      await existing.deleteOne();
      return sendSuccess(res, null, `${label} deleted`);
    })
  );

  return router;
};
