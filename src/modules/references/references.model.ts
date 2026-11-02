import { Schema, model, Document, Types } from "mongoose";

export interface IReference extends Document {
  name: string;
  kind: "file" | "folder";
  parent?: Types.ObjectId | null;
  file?: {
    storedName: string;
    originalName: string;
    mimeType: string;
    size: number;
  };
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const referenceSchema = new Schema<IReference>(
  {
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["file", "folder"], required: true },
    parent: { type: Schema.Types.ObjectId, ref: "Reference", default: null, index: true },
    file: {
      storedName: { type: String },
      originalName: { type: String },
      mimeType: { type: String },
      size: { type: Number },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        const file = ret.file as Record<string, unknown> | undefined;
        if (file) delete file.storedName;
        return ret;
      },
    },
  }
);

referenceSchema.index({ parent: 1, createdAt: -1 });

export const Reference = model<IReference>("Reference", referenceSchema);
