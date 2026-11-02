import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import { validateRequest } from "../../middlewares/validateRequest";
import { paymentLimiter } from "../../middlewares/rateLimiter";
import { subscriptionsController } from "./subscriptions.controller";
import { checkoutSchema, confirmSchema, returnSchema } from "./subscriptions.validation";

const router = Router();

// Opened by the in-app browser after Stripe Checkout, so it carries no bearer token.
router.get(
  "/return",
  paymentLimiter,
  validateRequest(returnSchema),
  subscriptionsController.returnToApp
);

router.use(authenticate);

router.get("/plans", authorize("subscriptions:read"), subscriptionsController.plans);
router.get("/me", authorize("subscriptions:read"), subscriptionsController.me);
router.post(
  "/checkout",
  paymentLimiter,
  authorize("subscriptions:manage"),
  validateRequest(checkoutSchema),
  subscriptionsController.checkout
);
router.post(
  "/confirm",
  paymentLimiter,
  authorize("subscriptions:manage"),
  validateRequest(confirmSchema),
  subscriptionsController.confirm
);

export default router;
