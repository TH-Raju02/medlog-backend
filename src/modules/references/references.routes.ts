import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { uploadLimiter } from "../../middlewares/rateLimiter";
import { ApiError } from "../../utils/ApiError";
import { referencesController } from "./references.controller";
import { newStoredName, referencesDir } from "./references.service";
import {
  createFolderSchema,
  fileTokenSchema,
  idParamSchema,
  listReferencesSchema,
  uploadFileSchema,
} from "./references.validation";

const upload = multer({
  storage: multer.diskStorage({
    destination: referencesDir,
    filename: (_req, _file, cb) => cb(null, newStoredName()),
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new ApiError(400, "Only PDF files can be uploaded", { code: "UNSUPPORTED_FILE" }));
    }
    cb(null, true);
  },
});

const router = Router();

// Signed, short-lived links opened by the system browser (no bearer header available there).
router.get("/files/:token", validateRequest(fileTokenSchema), referencesController.serveFile);

router.use(authenticate);

router.get(
  "/",
  authorize("references:read"),
  validateRequest(listReferencesSchema),
  referencesController.list
);
router.post(
  "/folders",
  authorize("references:create"),
  validateRequest(createFolderSchema),
  referencesController.createFolder
);
router.post(
  "/files",
  uploadLimiter,
  authorize("references:create"),
  upload.single("file"),
  validateRequest(uploadFileSchema),
  referencesController.upload
);
router.get(
  "/:id/link",
  authorize("references:read"),
  validateRequest(idParamSchema),
  referencesController.link
);
router.delete(
  "/:id",
  authorize("references:delete"),
  validateRequest(idParamSchema),
  referencesController.remove
);

export default router;
