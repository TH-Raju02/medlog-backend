import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { authService } from "./auth.service";

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    return sendSuccess(res, result, "Registration successful", 201);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body.email, req.body.password);
    return sendSuccess(res, result, "Login successful");
  }),

  verifyOtp: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.verifyOtp(req.body.email, req.body.code);
    return sendSuccess(res, result, "Account verified");
  }),

  resendOtp: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resendOtp(req.body.email);
    return sendSuccess(res, result, "OTP resent");
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    return sendSuccess(res, result, "Verification code sent");
  }),

  verifyResetCode: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.verifyResetCode(req.body.email, req.body.code);
    return sendSuccess(res, result, "Code verified");
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(
      req.body.email,
      req.body.resetToken,
      req.body.password
    );
    return sendSuccess(res, result, "Password updated");
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    return sendSuccess(res, result, "Token refreshed");
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.user!.id, req.body.refreshToken);
    return sendSuccess(res, null, "Logged out");
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.me(req.user!.id);
    return sendSuccess(res, user, "Profile loaded");
  }),
};
