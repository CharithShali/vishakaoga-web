import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Short code used in member numbers, e.g. OGA-KDY-2004-0012
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    order: { type: Number, default: 0 },
    address: { type: String, default: '' },
    foundedYear: { type: Number },
    // School houses at this branch. Empty = the form shows a text box instead of a list.
    houses: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Branch = mongoose.model('Branch', branchSchema);
