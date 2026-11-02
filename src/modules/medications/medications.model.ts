import { Schema, model, Document, Types } from "mongoose";

export const MEDICATION_CATEGORIES = ["hospital", "antibiotic", "discharge"] as const;
export type MedicationCategory = (typeof MEDICATION_CATEGORIES)[number];

export interface IHospitalMedication extends Document {
  admission: Types.ObjectId;
  patient: Types.ObjectId;
  category: MedicationCategory;
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const medicationSchema = new Schema<IHospitalMedication>(
  {
    admission: { type: Schema.Types.ObjectId, ref: "Admission", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    category: { type: String, enum: MEDICATION_CATEGORIES, default: "hospital", index: true },
    name: { type: String, required: true, trim: true },
    dose: { type: String },
    route: { type: String },
    frequency: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
medicationSchema.index({ createdAt: -1 });
medicationSchema.index({ startDate: -1 });

export const HospitalMedication = model<IHospitalMedication>(
  "HospitalMedication",
  medicationSchema
);
