import mongoose from 'mongoose';

// Simple running numbers, e.g. the next member number for the Kandy branch.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "member-KDY"
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model('Counter', counterSchema);

// Atomically take the next number for this key (1, 2, 3, ...).
export async function nextSequence(key) {
  const doc = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
}
