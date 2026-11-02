import { Schema, model, Document, Types } from "mongoose";

export interface IReminder extends Document {
  title: string;
  dueAt: Date;
  completedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new Schema<IReminder>(
  {
    title: { type: String, required: true, trim: true },
    dueAt: { type: Date, required: true },
    completedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

reminderSchema.index({ createdBy: 1, dueAt: 1 });
reminderSchema.index({ createdAt: -1 });

export const Reminder = model<IReminder>("Reminder", reminderSchema);
