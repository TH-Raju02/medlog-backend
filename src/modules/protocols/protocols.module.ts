import { Router } from "express";
import { z } from "zod";
import { Schema, model, Types } from "mongoose";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

const protocolSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    specialty: { type: String },
    content: { type: String, required: true },
    summary: { type: String },
    tags: [{ type: String }],
    isPublished: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
protocolSchema.index({ createdAt: -1 });
protocolSchema.index({ title: "text", content: "text", category: "text" });

const Protocol = model("Protocol", protocolSchema);

const createSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    category: z.string().max(120).optional(),
    specialty: z.string().max(120).optional(),
    content: z.string().min(1),
    summary: z.string().max(500).optional(),
    tags: z.array(z.string()).optional(),
    isPublished: z.boolean().optional(),
  }),
});

const router = Router();
router.use(authenticate);

router.get(
  "/",
  authorize("protocols:read"),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const filter: Record<string, unknown> = { isPublished: true };
    if (req.query.specialty) filter.specialty = req.query.specialty;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.search) {
      filter.$or = [
        { title: new RegExp(String(req.query.search), "i") },
        { category: new RegExp(String(req.query.search), "i") },
        { summary: new RegExp(String(req.query.search), "i") },
      ];
    }

    const [items, total] = await Promise.all([
      Protocol.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Protocol.countDocuments(filter),
    ]);

    return sendSuccess(res, items, "Protocols loaded", 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  })
);

router.get(
  "/:id",
  authorize("protocols:read"),
  asyncHandler(async (req, res) => {
    const item = await Protocol.findById(req.params.id);
    if (!item) throw new ApiError(404, "Protocol not found");
    return sendSuccess(res, item, "Protocol loaded");
  })
);

router.post(
  "/",
  authorize("protocols:create"),
  validateRequest(createSchema),
  asyncHandler(async (req, res) => {
    const item = await Protocol.create({
      ...req.body,
      createdBy: new Types.ObjectId(req.user!.id),
    });
    return sendSuccess(res, item, "Protocol created", 201);
  })
);

router.patch(
  "/:id",
  authorize("protocols:update"),
  asyncHandler(async (req, res) => {
    const allowed = [
      "title",
      "category",
      "specialty",
      "content",
      "summary",
      "tags",
      "isPublished",
    ];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const item = await Protocol.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );
    if (!item) throw new ApiError(404, "Protocol not found");
    return sendSuccess(res, item, "Protocol updated");
  })
);

router.delete(
  "/:id",
  authorize("protocols:delete"),
  asyncHandler(async (req, res) => {
    const item = await Protocol.findByIdAndDelete(req.params.id);
    if (!item) throw new ApiError(404, "Protocol not found");
    return sendSuccess(res, null, "Protocol deleted");
  })
);

export default router;
export { Protocol };
