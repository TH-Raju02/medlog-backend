import { Router } from "express";
import { z } from "zod";
import { Schema, model } from "mongoose";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

const specialtySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    icon: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
specialtySchema.index({ createdAt: -1 });

const Specialty = model("Specialty", specialtySchema);

const createSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    icon: z.string().max(80).optional(),
    isActive: z.boolean().optional(),
  }),
});

const router = Router();

// Public: the Create Account screen needs the specialty list before the user has a token.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await Specialty.find({ isActive: true }).select("name description").sort({ name: 1 });
    return sendSuccess(res, items, "Specialties loaded");
  })
);

router.use(authenticate);

router.post(
  "/",
  authorize("specialties:manage"),
  validateRequest(createSchema),
  asyncHandler(async (req, res) => {
    const item = await Specialty.create(req.body);
    return sendSuccess(res, item, "Specialty created", 201);
  })
);

router.patch(
  "/:id",
  authorize("specialties:manage"),
  asyncHandler(async (req, res) => {
    const item = await Specialty.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          ...(req.body.name !== undefined ? { name: req.body.name } : {}),
          ...(req.body.description !== undefined
            ? { description: req.body.description }
            : {}),
          ...(req.body.icon !== undefined ? { icon: req.body.icon } : {}),
          ...(req.body.isActive !== undefined ? { isActive: req.body.isActive } : {}),
        },
      },
      { new: true }
    );
    if (!item) throw new ApiError(404, "Specialty not found");
    return sendSuccess(res, item, "Specialty updated");
  })
);

export default router;
export { Specialty };
