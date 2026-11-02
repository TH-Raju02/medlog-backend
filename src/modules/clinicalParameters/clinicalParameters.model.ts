import { Schema, model, Document, Types } from "mongoose";

export interface IClinicalParameter extends Document {
  admission: Types.ObjectId;
  patient: Types.ObjectId;
  parameter: string;
  valueGoal?: string;
  planRecommendation?: string;
  recordedAt: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const clinicalParameterSchema = new Schema<IClinicalParameter>(
  {
    admission: { type: Schema.Types.ObjectId, ref: "Admission", required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    parameter: { type: String, required: true, trim: true },
    valueGoal: { type: String },
    planRecommendation: { type: String },
    recordedAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

clinicalParameterSchema.index({ recordedAt: -1 });
clinicalParameterSchema.index({ createdAt: -1 });

export const ClinicalParameter = model<IClinicalParameter>(
  "ClinicalParameter",
  clinicalParameterSchema
);
