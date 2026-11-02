import { Schema, model } from "mongoose";

const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = model<{ _id: string; seq: number }>("Counter", counterSchema);

/** Atomically returns the next value of a named sequence (1, 2, 3, ...). */
export const nextSequence = async (name: string) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};
