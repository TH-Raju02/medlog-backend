import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { patientsController } from "./patients.controller";
import {
  createPatientSchema,
  idParamSchema,
  listPatientsSchema,
  lookupPatientSchema,
  updatePatientSchema,
} from "./patients.validation";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("patients:read"),
  validateRequest(listPatientsSchema),
  patientsController.list
);
router.post(
  "/",
  authorize("patients:create"),
  validateRequest(createPatientSchema),
  patientsController.create
);
router.get(
  "/lookup",
  authorize("patients:read"),
  validateRequest(lookupPatientSchema),
  patientsController.lookup
);
router.get(
  "/:id",
  authorize("patients:read"),
  validateRequest(idParamSchema),
  patientsController.getById
);
router.patch(
  "/:id",
  authorize("patients:update"),
  validateRequest(updatePatientSchema),
  patientsController.update
);
router.delete(
  "/:id",
  authorize("patients:delete"),
  validateRequest(idParamSchema),
  patientsController.remove
);

export default router;
