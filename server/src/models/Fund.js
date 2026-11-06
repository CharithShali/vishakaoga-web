import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// A named pot of money, e.g. "Scholarship fund". Optional goal for a progress bar.
const fundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    goalCents: { type: Number, default: 0 }, // 0 = no goal
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Fund = mongoose.model('Fund', fundSchema);

export const CATEGORIES = {
  in: ['Membership fee', 'Donation', 'Event income', 'Other income'],
  out: ['Event costs', 'Scholarship', 'School project', 'Running costs', 'Other expense'],
};
export const PAYMENT_METHODS = ['Cash', 'Bank transfer', 'Cheque', 'Other'];

// One money record. Never deleted: a wrong entry is voided (kept, but not counted).
const transactionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "2026-11-06", a plain calendar date
    type: { type: String, enum: ['in', 'out'], required: true },
    amountCents: { type: Number, required: true, min: 1 },
    category: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    fund: { type: ObjectId, ref: 'Fund', required: true },
    // null = central (the association as a whole, not one branch)
    branch: { type: ObjectId, ref: 'Branch', default: null },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'Cash' },
    reference: { type: String, trim: true, default: '' }, // receipt or slip number
    // Who paid (e.g. a membership fee) and for which year
    member: { type: ObjectId, ref: 'User', default: null },
    subscriptionYear: { type: Number, default: null },
    recordedBy: { type: ObjectId, ref: 'User', required: true },
    updatedBy: { type: ObjectId, ref: 'User', default: null },
    voided: {
      at: { type: Date, default: null },
      by: { type: ObjectId, ref: 'User', default: null },
      reason: { type: String, trim: true, default: '' },
    },
  },
  { timestamps: true }
);

transactionSchema.index({ date: -1, createdAt: -1 });
transactionSchema.index({ branch: 1, date: -1 });
transactionSchema.index({ member: 1, subscriptionYear: 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
