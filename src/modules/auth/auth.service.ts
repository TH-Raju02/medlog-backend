import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import { CodePurpose, isMailConfigured, sendCodeEmail } from "../../utils/mailer";
import { User, IUser, JobTitle } from "./auth.model";
import { Role } from "../../constants/permissions";

export const OTP_LENGTH = 4;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

const isProduction = () => env.NODE_ENV === "production";

/** Codes come from DEFAULT_OTP and are returned to the app (not emailed) in development and in OTP_MODE=fixed. */
const usesFixedCodes = () => !isProduction() || env.OTP_MODE === "fixed";

const subscriptionView = (user: IUser) => {
  const sub = user.subscription;
  if (!sub || !sub.plan) return { status: "none" as const };
  const expired = sub.expiresAt ? sub.expiresAt.getTime() < Date.now() : false;
  return {
    plan: sub.plan,
    status: expired ? ("expired" as const) : sub.status,
    startedAt: sub.startedAt,
    expiresAt: sub.expiresAt,
    amount: sub.amount,
    currency: sub.currency,
  };
};

export const sanitizeUser = (user: IUser) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  country: user.country,
  countryCode: user.countryCode,
  jobTitle: user.jobTitle,
  specialty: user.specialty,
  role: user.role,
  isVerified: user.isVerified,
  subscription: subscriptionView(user),
  preferences: user.preferences,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const signAccessToken = (user: IUser) =>
  jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL } as jwt.SignOptions
  );

const signRefreshToken = (user: IUser) =>
  jwt.sign({ sub: user.id, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL,
  } as jwt.SignOptions);

const parseTtlToMs = (ttl: string): number => {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const map: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * (map[unit] ?? 86400000);
};

export class AuthService {
  async register(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    jobTitle?: JobTitle;
    specialty?: string;
    phone?: string;
    country?: string;
    countryCode?: string;
    acceptTerms?: boolean;
  }) {
    const existing = await User.findOne({ email: input.email.toLowerCase() });
    if (existing) {
      throw new ApiError(409, "Email already registered", { code: "EMAIL_EXISTS" });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const otpCode = this.newCode();
    const otpExpiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000);

    const user = await User.create({
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      passwordHash,
      country: input.country ?? "Kuwait",
      countryCode: input.countryCode ?? "KW",
      jobTitle: input.jobTitle,
      specialty: input.specialty,
      role: "clinician" as Role,
      isVerified: false,
      acceptedTermsAt: input.acceptTerms ? new Date() : undefined,
      otpCode,
      otpExpiresAt,
    });

    try {
      await this.deliverCode(user.email, otpCode, "verify");
    } catch (error) {
      // Without a code the account could never be verified, so let the user register again.
      await User.deleteOne({ _id: user._id });
      throw error;
    }

    return {
      user: sanitizeUser(user),
      otpHint: usesFixedCodes() ? otpCode : undefined,
    };
  }

  async login(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordHash +refreshTokens"
    );
    if (!user) {
      throw new ApiError(401, "Invalid credentials", { code: "INVALID_CREDENTIALS" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new ApiError(401, "Invalid credentials", { code: "INVALID_CREDENTIALS" });
    }

    if (!user.isVerified) {
      throw new ApiError(403, "Account not verified", { code: "UNVERIFIED" });
    }

    return this.issueTokens(user);
  }

  async verifyOtp(email: string, code: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+otpCode +otpExpiresAt +refreshTokens"
    );
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (user.isVerified) {
      return this.issueTokens(user);
    }

    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt < new Date()) {
      throw new ApiError(400, "OTP expired", { code: "OTP_EXPIRED" });
    }

    if (user.otpCode !== code) {
      throw new ApiError(400, "Invalid OTP", { code: "OTP_INVALID" });
    }

    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    return this.issueTokens(user);
  }

  async resendOtp(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+otpCode +otpExpiresAt"
    );
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    if (user.isVerified) {
      throw new ApiError(400, "Account already verified");
    }

    const otpCode = this.newCode();
    user.otpCode = otpCode;
    user.otpExpiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000);
    await user.save();
    await this.deliverCode(user.email, otpCode, "verify");

    return {
      message: "OTP sent",
      otpHint: usesFixedCodes() ? otpCode : undefined,
    };
  }

  /** Always answers the same way so the endpoint can't be used to discover accounts. */
  async forgotPassword(email: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+resetCode +resetCodeExpiresAt +resetTokenHash"
    );
    if (!user) {
      return { message: "If the email is registered, a code has been sent" };
    }

    const resetCode = this.newCode();
    user.resetCode = resetCode;
    user.resetCodeExpiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000);
    user.resetTokenHash = undefined;
    await user.save();
    try {
      await this.deliverCode(user.email, resetCode, "reset");
    } catch (error) {
      // Same response either way so the endpoint can't reveal which emails are registered.
      logger.error("Password reset code could not be delivered", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      message: "If the email is registered, a code has been sent",
      otpHint: usesFixedCodes() ? resetCode : undefined,
    };
  }

  async verifyResetCode(email: string, code: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+resetCode +resetCodeExpiresAt +resetTokenHash"
    );
    if (!user || !user.resetCode || !user.resetCodeExpiresAt) {
      throw new ApiError(400, "Invalid or expired code", { code: "RESET_CODE_INVALID" });
    }
    if (user.resetCodeExpiresAt < new Date()) {
      throw new ApiError(400, "Code expired", { code: "RESET_CODE_EXPIRED" });
    }
    if (user.resetCode !== code) {
      throw new ApiError(400, "Invalid code", { code: "RESET_CODE_INVALID" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetCode = undefined;
    user.resetCodeExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    user.resetTokenHash = hashToken(resetToken);
    await user.save();

    return { resetToken, email: user.email };
  }

  async resetPassword(email: string, resetToken: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordHash +resetCodeExpiresAt +resetTokenHash +refreshTokens"
    );
    if (
      !user ||
      !user.resetTokenHash ||
      user.resetTokenHash !== hashToken(resetToken) ||
      !user.resetCodeExpiresAt ||
      user.resetCodeExpiresAt < new Date()
    ) {
      throw new ApiError(400, "Reset link is invalid or expired", { code: "RESET_TOKEN_INVALID" });
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.resetTokenHash = undefined;
    user.resetCodeExpiresAt = undefined;
    user.refreshTokens = [];
    if (!user.isVerified) user.isVerified = true;
    await user.save();

    return { message: "Password updated" };
  }

  async refresh(refreshToken: string) {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as jwt.JwtPayload;
    } catch {
      throw new ApiError(401, "Invalid refresh token", { code: "INVALID_REFRESH" });
    }

    const user = await User.findById(payload.sub).select("+refreshTokens");
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const tokenHash = hashToken(refreshToken);
    const stored = user.refreshTokens.find(
      (t) => t.tokenHash === tokenHash && t.expiresAt > new Date()
    );
    if (!stored) {
      throw new ApiError(401, "Refresh token revoked", { code: "REVOKED_REFRESH" });
    }

    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
    await user.save();
    return this.issueTokens(user);
  }

  async logout(userId: string, refreshToken?: string) {
    const user = await User.findById(userId).select("+refreshTokens");
    if (!user) return;

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
    } else {
      user.refreshTokens = [];
    }
    await user.save();
  }

  async me(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    return sanitizeUser(user);
  }

  private async issueTokens(user: IUser) {
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const tokenHash = hashToken(refreshToken);

    if (!user.refreshTokens) {
      user.refreshTokens = [];
    }
    user.refreshTokens.push({
      tokenHash,
      expiresAt: new Date(Date.now() + parseTtlToMs(env.REFRESH_TOKEN_TTL)),
      createdAt: new Date(),
    });
    // Keep last 5 refresh tokens
    user.refreshTokens = user.refreshTokens.slice(-5);
    await user.save();

    return {
      user: sanitizeUser(user),
      tokens: {
        accessToken,
        refreshToken,
        tokenType: "Bearer",
        expiresIn: env.ACCESS_TOKEN_TTL,
      },
    };
  }

  /** Emails the code, except in OTP_MODE=fixed in production or in development without an email setup. */
  private async deliverCode(email: string, code: string, purpose: CodePurpose) {
    if (isProduction() && env.OTP_MODE === "fixed") return;
    if (!isProduction() && !isMailConfigured()) return;
    await sendCodeEmail(email, code, purpose);
  }

  private newCode() {
    if (!usesFixedCodes()) {
      return String(crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
    }
    const digits = env.DEFAULT_OTP.replace(/\D/g, "").slice(0, OTP_LENGTH);
    return digits.length === OTP_LENGTH ? digits : "1234";
  }
}

export const authService = new AuthService();
