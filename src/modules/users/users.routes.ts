import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { usersController } from "./users.controller";
import { listColleaguesSchema, updateProfileSchema } from "./users.validation";

const router = Router();

router.use(authenticate);

router.get("/me", authorize("profile:read"), usersController.me);
router.patch(
  "/me",
  authorize("profile:update"),
  validateRequest(updateProfileSchema),
  usersController.updateMe
);
router.get(
  "/colleagues",
  authorize("users:read"),
  validateRequest(listColleaguesSchema),
  usersController.colleagues
);

export default router;
