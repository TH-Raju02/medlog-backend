import Stripe from "stripe";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import { User, SubscriptionPlan } from "../auth/auth.model";
import { sanitizeUser } from "../auth/auth.service";
import { PLANS } from "./subscriptions.plans";

let stripeClient: Stripe | null = null;

const getStripe = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, "Payments are not configured on the server", {
      code: "PAYMENTS_NOT_CONFIGURED",
    });
  }
  stripeClient = stripeClient ?? new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

export const isAllowedReturnUrl = (url: string) =>
  env.PAYMENT_RETURN_URL_PREFIXES.split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .some((prefix) => url.startsWith(prefix));

export class SubscriptionsService {
  plans() {
    return {
      paymentsEnabled: Boolean(env.STRIPE_SECRET_KEY),
      currency: env.STRIPE_CURRENCY,
      plans: Object.values(PLANS),
    };
  }

  async me(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    return sanitizeUser(user).subscription;
  }

  async createCheckout(
    userId: string,
    plan: SubscriptionPlan,
    returnUrl: string,
    apiBaseUrl: string
  ) {
    if (!isAllowedReturnUrl(returnUrl)) {
      throw new ApiError(400, "Return URL is not allowed", { code: "INVALID_RETURN_URL" });
    }
    const stripe = getStripe();
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    const definition = PLANS[plan];
    const back = (status: "success" | "cancel") =>
      `${apiBaseUrl}/subscriptions/return?status=${status}&to=${encodeURIComponent(returnUrl)}` +
      (status === "success" ? "&session_id={CHECKOUT_SESSION_ID}" : "");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { userId: user.id, plan },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: env.STRIPE_CURRENCY,
            unit_amount: definition.amount,
            product_data: {
              name: `${definition.name} Subscription Plan`,
              description: definition.description,
            },
          },
        },
      ],
      success_url: back("success"),
      cancel_url: back("cancel"),
    });

    return { sessionId: session.id, url: session.url };
  }

  /** Activates the plan for a paid Checkout Session. Safe to call more than once. */
  async fulfil(sessionId: string, expectedUserId?: string) {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const userId = session.metadata?.userId;
    const plan = session.metadata?.plan as SubscriptionPlan | undefined;

    if (!userId || !plan || !PLANS[plan]) {
      throw new ApiError(400, "Unknown checkout session", { code: "INVALID_SESSION" });
    }
    if (expectedUserId && expectedUserId !== userId) {
      throw new ApiError(403, "Checkout session belongs to another user", { code: "FORBIDDEN" });
    }

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    if (session.payment_status !== "paid") {
      return { paid: false, subscription: sanitizeUser(user).subscription };
    }

    if (user.subscription?.stripeSessionId !== session.id) {
      const now = new Date();
      const current = user.subscription;
      const base =
        current?.status === "active" && current.expiresAt && current.expiresAt > now
          ? current.expiresAt
          : now;
      user.subscription = {
        plan,
        status: "active",
        startedAt: now,
        expiresAt: addMonths(base, PLANS[plan].months),
        amount: (session.amount_total ?? PLANS[plan].amount) / 100,
        currency: session.currency ?? env.STRIPE_CURRENCY,
        stripeSessionId: session.id,
      };
      await user.save();
      logger.info("Subscription activated", { userId, plan });
    }

    return { paid: true, subscription: sanitizeUser(user).subscription };
  }

  async handleWebhook(payload: Buffer, signature: string | undefined) {
    const stripe = getStripe();
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new ApiError(503, "Webhook secret is not configured", {
        code: "PAYMENTS_NOT_CONFIGURED",
      });
    }
    if (!signature) throw new ApiError(400, "Missing Stripe signature");

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new ApiError(400, "Invalid Stripe signature", { code: "INVALID_SIGNATURE" });
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await this.fulfil(event.data.object.id);
    }
    return { received: true };
  }
}

export const subscriptionsService = new SubscriptionsService();
