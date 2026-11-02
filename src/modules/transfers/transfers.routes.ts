import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { transfersController } from "./transfers.controller";
import {
  createTransferSchema,
  idParamSchema,
  listTransfersSchema,
  updateStatusSchema,
} from "./transfers.validation";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("transfers:read"),
  validateRequest(listTransfersSchema),
  transfersController.list
);
router.post(
  "/",
  authorize("transfers:create"),
  validateRequest(createTransferSchema),
  transfersController.create
);
router.patch(
  "/:id/status",
  authorize("transfers:update"),
  validateRequest(updateStatusSchema),
  transfersController.updateStatus
);
router.get(
  "/:id",
  authorize("transfers:read"),
  validateRequest(idParamSchema),
  transfersController.getById
);

export default router;
