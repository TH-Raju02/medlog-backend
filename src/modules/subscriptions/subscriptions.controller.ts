import { Request, Response } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { logger } from "../../utils/logger";
import { isAllowedReturnUrl, subscriptionsService } from "./subscriptions.service";

const apiBaseUrl = (req: Request) =>
  (env.PUBLIC_API_URL ? env.PUBLIC_API_URL.replace(/\/+$/, "") : `${req.protocol}://${req.get("host")}`) +
  "/api/v1";

const withParams = (url: string, params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
};

export const subscriptionsController = {
  plans: asyncHandler(async (_req: Request, res: Response) => {
    return sendSuccess(res, subscriptionsService.plans(), "Plans loaded");
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const subscription = await subscriptionsService.me(req.user!.id);
    return sendSuccess(res, subscription, "Subscription loaded");
  }),

  checkout: asyncHandler(async (req: Request, res: Response) => {
    const result = await subscriptionsService.createCheckout(
      req.user!.id,
      req.body.plan,
      req.body.returnUrl,
      apiBaseUrl(req)
    );
    return sendSuccess(res, result, "Checkout session created", 201);
  }),

  confirm: asyncHandler(async (req: Request, res: Response) => {
    const result = await subscriptionsService.fulfil(req.body.sessionId, req.user!.id);
    return sendSuccess(res, result, result.paid ? "Subscription active" : "Payment not completed");
  }),

  /** Stripe redirects the in-app browser here; we hand control back to the app. */
  returnToApp: asyncHandler(async (req: Request, res: Response) => {
    const to = String(req.query.to);
    if (!isAllowedReturnUrl(to)) {
      return res.status(400).send("Invalid return URL");
    }
    const status = String(req.query.status);
    const sessionId = req.query.session_id ? String(req.query.session_id) : undefined;
    if (status === "success" && sessionId) {
      try {
        await subscriptionsService.fulfil(sessionId);
      } catch (error) {
        logger.warn("Checkout fulfilment on return failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return res.redirect(
      302,
      withParams(to, { status, ...(sessionId ? { session_id: sessionId } : {}) })
    );
  }),

  webhook: asyncHandler(async (req: Request, res: Response) => {
    const result = await subscriptionsService.handleWebhook(
      req.body as Buffer,
      req.headers["stripe-signature"] as string | undefined
    );
    return res.json(result);
  }),
};
