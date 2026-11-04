import mongoose from 'mongoose';
import { ROLES } from '../utils/permissions.js';

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, enum: ROLES, required: true },
    // null = this role covers all branches
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true },
    nameAtSchool: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    batchYear: { type: Number },
    // pending = waiting for the branch coordinator to approve the registration
    status: {
      type: String,
      enum: ['pending', 'active', 'rejected', 'suspended'],
      default: 'pending',
    },
    memberNo: { type: String, unique: true, sparse: true },
    roles: { type: [roleSchema], default: [] },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Never send the password hash to the browser, even by mistake.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
