import { Router } from "express";
import { authController } from "./auth.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resendOtpSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  verifyResetCodeSchema,
} from "./auth.validation";
import { authenticate } from "../../middlewares/authenticate";
import { authLimiter, otpLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post("/register", authLimiter, validateRequest(registerSchema), authController.register);
router.post("/login", authLimiter, validateRequest(loginSchema), authController.login);
router.post("/verify-otp", otpLimiter, validateRequest(verifyOtpSchema), authController.verifyOtp);
router.post("/resend-otp", otpLimiter, validateRequest(resendOtpSchema), authController.resendOtp);
router.post(
  "/forgot-password",
  otpLimiter,
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  "/verify-reset-code",
  otpLimiter,
  validateRequest(verifyResetCodeSchema),
  authController.verifyResetCode
);
router.post(
  "/reset-password",
  authLimiter,
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);
router.post("/refresh", authLimiter, validateRequest(refreshSchema), authController.refresh);
router.post("/logout", authenticate, validateRequest(logoutSchema), authController.logout);
router.get("/me", authenticate, authController.me);

export default router;
