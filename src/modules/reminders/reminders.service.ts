import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { Reminder } from "./reminders.model";

/** Reminders are a personal to-do list, so every query is scoped to its owner. */
export class RemindersService {
  async list(userId: string, page: number, limit: number, status: "open" | "all") {
    const filter: Record<string, unknown> = { createdBy: new Types.ObjectId(userId) };
    if (status === "open") filter.completedAt = { $exists: false };
    const [items, total] = await Promise.all([
      Reminder.find(filter)
        .sort({ dueAt: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Reminder.countDocuments(filter),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async create(userId: string, data: { title: string; dueAt: Date }) {
    return Reminder.create({ ...data, createdBy: new Types.ObjectId(userId) });
  }

  async update(
    userId: string,
    id: string,
    data: { title?: string; dueAt?: Date; completed?: boolean }
  ) {
    const reminder = await Reminder.findOne({ _id: id, createdBy: new Types.ObjectId(userId) });
    if (!reminder) throw new ApiError(404, "Reminder not found");
    if (data.title !== undefined) reminder.title = data.title;
    if (data.dueAt !== undefined) reminder.dueAt = data.dueAt;
    if (data.completed !== undefined) {
      reminder.completedAt = data.completed ? new Date() : undefined;
    }
    await reminder.save();
    return reminder;
  }

  async remove(userId: string, id: string) {
    const reminder = await Reminder.findOneAndDelete({
      _id: id,
      createdBy: new Types.ObjectId(userId),
    });
    if (!reminder) throw new ApiError(404, "Reminder not found");
    return reminder;
  }
}

export const remindersService = new RemindersService();
