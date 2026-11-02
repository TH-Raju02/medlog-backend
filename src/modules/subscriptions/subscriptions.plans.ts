import { SubscriptionPlan } from "../auth/auth.model";

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  description: string;
  /** Price in the smallest currency unit (cents). */
  amount: number;
  months: number;
  intervalLabel: string;
  savingsLabel?: string;
}

export const PLANS: Record<SubscriptionPlan, PlanDefinition> = {
  monthly: {
    id: "monthly",
    name: "Monthly",
    description: "Flexible access, billed monthly",
    amount: 1199,
    months: 1,
    intervalLabel: "month",
  },
  six_months: {
    id: "six_months",
    name: "6 Months",
    description: "Save more with a 6-month plan",
    amount: 5999,
    months: 6,
    intervalLabel: "6 months",
    savingsLabel: "Save $11.95 (17% off)",
  },
  annual: {
    id: "annual",
    name: "Annual",
    description: "Best value for continuous access",
    amount: 9899,
    months: 12,
    intervalLabel: "year",
    savingsLabel: "Save $44.89 (31% off)",
  },
};
