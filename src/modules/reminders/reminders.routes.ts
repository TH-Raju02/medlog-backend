import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { remindersController } from "./reminders.controller";
import {
  createReminderSchema,
  idParamSchema,
  listRemindersSchema,
  updateReminderSchema,
} from "./reminders.validation";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("reminders:read"),
  validateRequest(listRemindersSchema),
  remindersController.list
);
router.post(
  "/",
  authorize("reminders:create"),
  validateRequest(createReminderSchema),
  remindersController.create
);
router.patch(
  "/:id",
  authorize("reminders:update"),
  validateRequest(updateReminderSchema),
  remindersController.update
);
router.delete(
  "/:id",
  authorize("reminders:delete"),
  validateRequest(idParamSchema),
  remindersController.remove
);

export default router;
