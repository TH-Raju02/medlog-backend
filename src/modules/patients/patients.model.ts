import { Schema, model, Document, Types } from "mongoose";

export const MARITAL_STATUSES = ["single", "married", "divorced", "widowed"] as const;

export interface IPatient extends Document {
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: "male" | "female" | "other" | "unknown";
  nationalId?: string;
  fileNumber?: string;
  mrn: string;
  phone?: string;
  nationality?: string;
  maritalStatus?: (typeof MARITAL_STATUSES)[number];
  weightKg?: number;
  heightCm?: number;
  bloodType?: string;
  hasAllergies?: boolean;
  allergies?: string;
  smoker?: boolean;
  alcohol?: boolean;
  caffeine?: boolean;
  recreationalDrugs?: boolean;
  catheter?: boolean;
  ngt?: boolean;
  pegTube?: boolean;
  country: string;
  countryCode: string;
  notes?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["male", "female", "other", "unknown"],
      default: "unknown",
    },
    nationalId: { type: String, trim: true, index: true },
    fileNumber: { type: String, trim: true },
    mrn: { type: String, required: true, unique: true, index: true },
    phone: { type: String },
    nationality: { type: String, trim: true },
    maritalStatus: { type: String, enum: MARITAL_STATUSES },
    weightKg: { type: Number, min: 0, max: 700 },
    heightCm: { type: Number, min: 0, max: 300 },
    bloodType: { type: String, trim: true },
    hasAllergies: { type: Boolean },
    allergies: { type: String, trim: true },
    smoker: { type: Boolean, default: false },
    alcohol: { type: Boolean, default: false },
    caffeine: { type: Boolean, default: false },
    recreationalDrugs: { type: Boolean, default: false },
    catheter: { type: Boolean, default: false },
    ngt: { type: Boolean, default: false },
    pegTube: { type: Boolean, default: false },
    country: { type: String, default: "Kuwait" },
    countryCode: { type: String, default: "KW" },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

patientSchema.index({ createdAt: -1 });
patientSchema.index({ firstName: 1, lastName: 1 });
patientSchema.index({ firstName: "text", lastName: "text", mrn: "text" });

export const Patient = model<IPatient>("Patient", patientSchema);
