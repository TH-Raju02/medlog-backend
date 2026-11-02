import { Schema, model, Document, Types } from "mongoose";

export const TRANSFER_TYPES = ["inter_ward", "inter_hospital", "handoff"] as const;
export const TRANSFER_STATUSES = ["pending", "accepted", "completed", "cancelled"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export interface ITransfer extends Document {
  admission: Types.ObjectId;
  patient: Types.ObjectId;
  fromWard?: string;
  toWard?: string;
  fromHospital?: string;
  toHospital?: string;
  reason?: string;
  notes?: string;
  transferType: (typeof TRANSFER_TYPES)[number];
  status: TransferStatus;
  requestedBy: Types.ObjectId;
  toUser?: Types.ObjectId;
  toSpecialty?: string;
  acceptedBy?: Types.ObjectId;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transferSchema = new Schema<ITransfer>(
  {
    admission: { type: Schema.Types.ObjectId, ref: "Admission", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    fromWard: { type: String },
    toWard: { type: String },
    fromHospital: { type: String },
    toHospital: { type: String },
    reason: { type: String },
    notes: { type: String },
    transferType: { type: String, enum: TRANSFER_TYPES, default: "inter_ward", index: true },
    status: { type: String, enum: TRANSFER_STATUSES, default: "pending", index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    toUser: { type: Schema.Types.ObjectId, ref: "User", index: true },
    toSpecialty: { type: String },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
    respondedAt: { type: Date },
  },
  { timestamps: true }
);
transferSchema.index({ createdAt: -1 });

export const Transfer = model<ITransfer>("Transfer", transferSchema);
