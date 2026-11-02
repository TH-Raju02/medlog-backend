import { Schema, model, Document, Types } from "mongoose";
import { Role, ROLES } from "../../constants/permissions";

export const JOB_TITLES = ["Doctor", "Pharmacist"] as const;
export type JobTitle = (typeof JOB_TITLES)[number];

export const SUBSCRIPTION_PLANS = ["monthly", "six_months", "annual"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export interface IUserSubscription {
  plan?: SubscriptionPlan;
  status: "none" | "active" | "expired";
  startedAt?: Date;
  expiresAt?: Date;
  amount?: number;
  currency?: string;
  stripeSessionId?: string;
}

export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  country: string;
  countryCode: string;
  jobTitle?: JobTitle;
  specialty?: string;
  role: Role;
  isVerified: boolean;
  acceptedTermsAt?: Date;
  otpCode?: string;
  otpExpiresAt?: Date;
  resetCode?: string;
  resetCodeExpiresAt?: Date;
  resetTokenHash?: string;
  refreshTokens: Array<{
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }>;
  subscription?: IUserSubscription;
  preferences?: {
    notificationsEnabled?: boolean;
    handoverNotifications?: boolean;
    reminderTime?: string;
    language?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },
    country: { type: String, default: "Kuwait" },
    countryCode: { type: String, default: "KW" },
    jobTitle: { type: String, enum: JOB_TITLES },
    specialty: { type: String },
    role: { type: String, enum: ROLES, default: "clinician" },
    isVerified: { type: Boolean, default: false },
    acceptedTermsAt: { type: Date },
    otpCode: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    resetCode: { type: String, select: false },
    resetCodeExpiresAt: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    refreshTokens: {
      type: [
        {
          tokenHash: String,
          expiresAt: Date,
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      select: false,
    },
    subscription: {
      plan: { type: String, enum: SUBSCRIPTION_PLANS },
      status: { type: String, enum: ["none", "active", "expired"], default: "none" },
      startedAt: { type: Date },
      expiresAt: { type: Date },
      amount: { type: Number },
      currency: { type: String },
      stripeSessionId: { type: String },
    },
    preferences: {
      notificationsEnabled: { type: Boolean, default: true },
      handoverNotifications: { type: Boolean, default: true },
      reminderTime: { type: String, default: "07:00" },
      language: { type: String, default: "en" },
    },
  },
  { timestamps: true }
);

userSchema.index({ firstName: 1, lastName: 1 });

export const User = model<IUser>("User", userSchema);
export type UserId = Types.ObjectId;
