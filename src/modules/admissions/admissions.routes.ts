import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { admissionsController } from "./admissions.controller";
import {
  createAdmissionSchema,
  dischargeSchema,
  handoverSchema,
  idParamSchema,
  listAdmissionsSchema,
  updateAdmissionSchema,
} from "./admissions.validation";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("admissions:read"),
  validateRequest(listAdmissionsSchema),
  admissionsController.list
);
router.post(
  "/",
  authorize("admissions:create"),
  validateRequest(createAdmissionSchema),
  admissionsController.create
);
router.get(
  "/:id",
  authorize("admissions:read"),
  validateRequest(idParamSchema),
  admissionsController.getById
);
router.patch(
  "/:id",
  authorize("admissions:update"),
  validateRequest(updateAdmissionSchema),
  admissionsController.update
);
router.post(
  "/:id/review",
  authorize("admissions:update"),
  validateRequest(idParamSchema),
  admissionsController.review
);
router.delete(
  "/:id/review",
  authorize("admissions:update"),
  validateRequest(idParamSchema),
  admissionsController.undoReview
);
router.post(
  "/:id/discharge",
  authorize("admissions:update"),
  validateRequest(dischargeSchema),
  admissionsController.discharge
);
router.post(
  "/:id/handover",
  authorize("transfers:create"),
  validateRequest(handoverSchema),
  admissionsController.handover
);
router.delete(
  "/:id",
  authorize("admissions:delete"),
  validateRequest(idParamSchema),
  admissionsController.remove
);

export default router;
