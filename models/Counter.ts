import mongoose, { Schema, Model } from "mongoose";

type CounterDoc = {
  _id: string;
  seq: number;
};

const CounterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc>) ||
  mongoose.model<CounterDoc>("Counter", CounterSchema);

export async function nextSeq(key: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc!.seq;
}

export async function peekSeq(key: string): Promise<number> {
  const doc = await Counter.findById(key).lean();
  return (doc?.seq ?? 0) + 1;
}

export default Counter;
