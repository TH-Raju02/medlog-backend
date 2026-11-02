import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { dashboardController } from "./dashboard.controller";
import { metricsSchema } from "./dashboard.validation";

const router = Router();

router.use(authenticate);

router.get(
  "/metrics",
  authorize("dashboard:read"),
  validateRequest(metricsSchema),
  dashboardController.metrics
);

export default router;
