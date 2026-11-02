import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { escapeRegex } from "../../utils/escapeRegex";
import { User } from "../auth/auth.model";
import { sanitizeUser } from "../auth/auth.service";

type ProfileUpdate = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobTitle?: "Doctor" | "Pharmacist";
  country?: string;
  countryCode?: string;
  specialty?: string;
  preferences?: Record<string, unknown>;
};

export class UsersService {
  async me(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    return sanitizeUser(user);
  }

  async updateMe(userId: string, data: ProfileUpdate) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    const { preferences, ...fields } = data;
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) user.set(key, value);
    }
    if (preferences) {
      for (const [key, value] of Object.entries(preferences)) {
        if (value !== undefined) user.set(`preferences.${key}`, value);
      }
    }
    await user.save();
    return sanitizeUser(user);
  }

  async colleagues(userId: string, search: string | undefined, limit: number) {
    const filter: Record<string, unknown> = {
      _id: { $ne: new Types.ObjectId(userId) },
      isVerified: true,
    };
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ firstName: pattern }, { lastName: pattern }, { email: pattern }];
    }
    const users = await User.find(filter).sort({ firstName: 1, lastName: 1 }).limit(limit);
    return users.map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      jobTitle: u.jobTitle,
      specialty: u.specialty,
    }));
  }
}

export const usersService = new UsersService();
