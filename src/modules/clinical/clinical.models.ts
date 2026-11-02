import { Schema, model, Document, Types } from "mongoose";

interface AdmissionScoped extends Document {
  admission: Types.ObjectId;
  patient: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const scoped = {
  admission: { type: Schema.Types.ObjectId, ref: "Admission", required: true, index: true },
  patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
};

export interface IMedicationReconciliation extends AdmissionScoped {
  drug: string;
  dose?: string;
  route?: string;
  frequency?: string;
  discrepancy?: string;
  comment?: string;
}

const reconciliationSchema = new Schema<IMedicationReconciliation>(
  {
    ...scoped,
    drug: { type: String, required: true, trim: true },
    dose: { type: String },
    route: { type: String },
    frequency: { type: String },
    discrepancy: { type: String },
    comment: { type: String },
  },
  { timestamps: true }
);
reconciliationSchema.index({ createdAt: -1 });

export const MedicationReconciliation = model<IMedicationReconciliation>(
  "MedicationReconciliation",
  reconciliationSchema
);

export const DTP_CATEGORIES = ["indication", "effectiveness", "safety", "adherence", "none"] as const;

export interface IRecommendation extends AdmissionScoped {
  text: string;
  dtp: (typeof DTP_CATEGORIES)[number];
  recordedAt: Date;
}

const recommendationSchema = new Schema<IRecommendation>(
  {
    ...scoped,
    text: { type: String, required: true, trim: true },
    dtp: { type: String, enum: DTP_CATEGORIES, default: "none", index: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
recommendationSchema.index({ recordedAt: -1, createdAt: -1 });

export const Recommendation = model<IRecommendation>("Recommendation", recommendationSchema);

export interface ILabResult extends AdmissionScoped {
  testName: string;
  date?: Date;
  reference?: string;
  value?: string;
}

const labResultSchema = new Schema<ILabResult>(
  {
    ...scoped,
    testName: { type: String, required: true, trim: true },
    date: { type: Date },
    reference: { type: String },
    value: { type: String },
  },
  { timestamps: true }
);
labResultSchema.index({ date: -1, createdAt: -1 });

export const LabResult = model<ILabResult>("LabResult", labResultSchema);

export interface ICultureResult extends AdmissionScoped {
  cultureType: string;
  collectedAt?: Date;
  resultAt?: Date;
  organism?: string;
  susceptibility?: string;
}

const cultureSchema = new Schema<ICultureResult>(
  {
    ...scoped,
    cultureType: { type: String, required: true, trim: true },
    collectedAt: { type: Date },
    resultAt: { type: Date },
    organism: { type: String },
    susceptibility: { type: String },
  },
  { timestamps: true }
);
cultureSchema.index({ collectedAt: -1, createdAt: -1 });

export const CultureResult = model<ICultureResult>("CultureResult", cultureSchema);
