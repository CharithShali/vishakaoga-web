import mongoose from 'mongoose';
import { ROLES } from '../utils/permissions.js';
import { PROFESSION_CATEGORIES } from '../utils/options.js';

export { PROFESSION_CATEGORIES };

const { ObjectId } = mongoose.Schema.Types;

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, enum: ROLES, required: true },
    // null = this role covers all branches
    branch: { type: ObjectId, ref: 'Branch', default: null },
  },
  { _id: false }
);

const professionSchema = new mongoose.Schema(
  {
    category: { type: String, enum: PROFESSION_CATEGORIES },
    title: { type: String, trim: true, default: '' }, // e.g. "Consultant paediatrician"
    workplace: { type: String, trim: true, default: '' }, // e.g. "Lady Ridgeway Hospital"
    // Other members see it only if she agrees; the committee always can.
    showToMembers: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ---- Login ----
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },

    // ---- About her ----
    fullName: { type: String, required: true, trim: true },
    nameAtSchool: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    currentCity: { type: String, trim: true, default: '' }, // e.g. "Kandy" or "Melbourne"
    address: { type: String, trim: true, default: '' },
    profession: { type: professionSchema, default: () => ({}) },
    // Cloudinary public id of her card photo (stored privately, see services/photos.js)
    photoId: { type: String, default: '' },

    // ---- School years ----
    branch: { type: ObjectId, ref: 'Branch', required: true },
    otherBranch: {
      branch: { type: ObjectId, ref: 'Branch', default: null },
      years: { type: String, trim: true, default: '' }, // e.g. "Grade 1 to 5"
    },
    yearJoined: { type: Number },
    batchYear: { type: Number }, // year she left school
    lastClass: { type: String, trim: true, default: '' }, // e.g. "13 A"
    house: { type: String, trim: true, default: '' },
    admissionNo: { type: String, trim: true, default: '' },
    schoolRoles: { type: [String], default: [] }, // e.g. ["Prefect", "School Band"]
    sports: { type: String, trim: true, default: '' },
    otherAchievements: { type: String, trim: true, default: '' },

    // ---- Membership ----
    // pending = waiting for the branch coordinator to approve the registration
    status: {
      type: String,
      enum: ['pending', 'active', 'rejected', 'suspended'],
      default: 'pending',
    },
    memberNo: { type: String, unique: true, sparse: true }, // given on approval
    consentAt: { type: Date }, // when she agreed to share name, batch, photo with members
    review: {
      by: { type: ObjectId, ref: 'User', default: null },
      at: { type: Date },
      note: { type: String, trim: true, default: '' }, // reason, if rejected
    },
    roles: { type: [roleSchema], default: [] },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ status: 1, branch: 1, batchYear: 1 });

// Never send the password hash to the browser, even by mistake.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
