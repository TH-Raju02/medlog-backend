import { Schema, model, Document, Types } from "mongoose";

export type AdmissionStatus = "active" | "discharged" | "transferred";
export type EntryMode = "manual" | "ai";

export interface IAdmission extends Document {
  code?: string;
  patient: Types.ObjectId;
  admissionDate: Date;
  chiefComplaint?: string;
  diagnosis?: string;
  medicalHistory?: string;
  specialty?: string;
  ward?: string;
  room?: string;
  bed?: string;
  hospital?: string;
  status: AdmissionStatus;
  entryMode: EntryMode;
  notes?: string;
  lastReviewedAt?: Date;
  lastReviewedBy?: Types.ObjectId;
  dischargedAt?: Date;
  dischargeSummary?: string;
  dischargeCounseling?: boolean;
  assignedTo?: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const admissionSchema = new Schema<IAdmission>(
  {
    code: { type: String, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    admissionDate: { type: Date, required: true, default: Date.now },
    chiefComplaint: { type: String },
    diagnosis: { type: String },
    medicalHistory: { type: String },
    specialty: { type: String, index: true },
    ward: { type: String },
    room: { type: String },
    bed: { type: String },
    hospital: { type: String },
    status: {
      type: String,
      enum: ["active", "discharged", "transferred"],
      default: "active",
      index: true,
    },
    entryMode: { type: String, enum: ["manual", "ai"], default: "manual" },
    notes: { type: String },
    lastReviewedAt: { type: Date },
    lastReviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    dischargedAt: { type: Date, index: true },
    dischargeSummary: { type: String },
    dischargeCounseling: { type: Boolean, default: false },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

admissionSchema.index({ createdAt: -1 });
admissionSchema.index({ admissionDate: -1 });

export const Admission = model<IAdmission>("Admission", admissionSchema);
