import { Router } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { nextSequence } from '../models/Counter.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { hasRole } from '../utils/permissions.js';
import { scopedBranchFilter } from '../utils/branchFilter.js';
import { formatMemberNo } from '../utils/memberNo.js';
import { PROFESSION_CATEGORIES, SCHOOL_ROLES, FIRST_BATCH_YEAR } from '../utils/options.js';
import {
  prepareCardPhoto,
  uploadCardPhoto,
  cardPhotoUrl,
  deleteCardPhoto,
} from '../services/photos.js';

export const registrationsRouter = Router();

// Who reviews new registrations: the branch coordinator (her branch only),
// the Secretary (her branch, or all if central) and the main admin.
const REVIEW_ROLES = ['coordinator', 'secretary'];
const OBJECT_ID = /^[a-f0-9]{24}$/i;

// ---------- The form ----------

const upload = multer({
  storage: multer.memoryStorage(), // kept in memory, resized, then sent to Cloudinary
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // the browser sends a cropped ~100-300 KB JPEG
  fileFilter(_req, file, cb) {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    const err = new Error('The photo must be a JPEG, PNG or WebP image.');
    err.status = 400;
    cb(err);
  },
});

const thisYear = new Date().getFullYear();
const text = (max) => z.string().trim().max(max).optional().default('');
const branchId = z.string().regex(OBJECT_ID, 'Choose your branch');
const year = z.coerce
  .number({ invalid_type_error: 'Enter a year like 2004' })
  .int()
  .min(FIRST_BATCH_YEAR, `Enter a year from ${FIRST_BATCH_YEAR}`)
  .max(thisYear + 1, 'That year is in the future');
const optionalYear = z.preprocess((v) => (v === '' || v == null ? undefined : v), year.optional());

const registrationSchema = z
  .object({
    branch: branchId,
    otherBranch: z
      .object({
        branch: z.preprocess((v) => (v === '' ? null : v), branchId.nullable().optional()),
        years: text(60),
      })
      .optional()
      .default({}),
    fullName: z.string().trim().min(2, 'Enter your full name').max(120),
    nameAtSchool: text(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{9,20}$/, 'Enter a valid phone number'),
    password: z.string().min(8, 'Use at least 8 characters for your password').max(200),
    currentCity: text(100),
    address: text(300),
    profession: z.object({
      category: z.enum(PROFESSION_CATEGORIES, {
        errorMap: () => ({ message: 'Choose the field you work in' }),
      }),
      title: text(120),
      workplace: text(160),
      showToMembers: z.boolean().optional().default(false),
    }),
    yearJoined: optionalYear,
    batchYear: year,
    lastClass: z.string().trim().min(1, 'Enter your last class').max(40),
    house: text(60),
    admissionNo: text(40),
    schoolRoles: z.array(z.enum(SCHOOL_ROLES)).optional().default([]),
    sports: text(200),
    otherAchievements: text(300),
    consent: z.literal(true, {
      errorMap: () => ({ message: 'Please agree to share your name, branch and batch with members' }),
    }),
  })
  .refine((d) => !d.yearJoined || d.yearJoined <= d.batchYear, {
    message: 'The year you joined must be before the year you left',
    path: ['yearJoined'],
  });

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many registrations from this network. Please try again in an hour.' },
});

// POST /api/registrations  (multipart: "data" = JSON of the form, "photo" = cropped image)
registrationsRouter.post('/', registerLimiter, upload.single('photo'), async (req, res) => {
  let raw;
  try {
    raw = JSON.parse(req.body?.data || '{}');
  } catch {
    return res.status(400).json({ error: 'The form data was not valid. Please try again.' });
  }

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return res.status(400).json({ error: issue.message, field: issue.path.join('.') });
  }
  const form = parsed.data;

  if (!req.file) {
    return res
      .status(400)
      .json({ error: 'Please add a photo for your membership card.', field: 'photo' });
  }

  const branch = await Branch.findOne({ _id: form.branch, active: true });
  if (!branch) return res.status(400).json({ error: 'Choose your branch.', field: 'branch' });

  let otherBranch = form.otherBranch.branch || null;
  if (otherBranch === form.branch) otherBranch = null;
  if (otherBranch && !(await Branch.exists({ _id: otherBranch }))) {
    return res.status(400).json({ error: 'Choose the other branch again.', field: 'otherBranch' });
  }

  // One account per email. A rejected registration may try again.
  const existing = await User.findOne({ email: form.email });
  if (existing && existing.status !== 'rejected') {
    return res.status(409).json({
      error:
        existing.status === 'pending'
          ? 'This email has already registered and is waiting for approval.'
          : 'This email is already registered. Please log in instead.',
      field: 'email',
    });
  }

  let photo;
  try {
    photo = await prepareCardPhoto(req.file.buffer);
  } catch {
    return res
      .status(400)
      .json({ error: 'We could not read that photo. Please try another one.', field: 'photo' });
  }

  const passwordHash = await bcrypt.hash(form.password, 12);
  const photoId = await uploadCardPhoto(photo);

  try {
    if (existing) {
      await deleteCardPhoto(existing.photoId);
      await existing.deleteOne();
    }
    await User.create({
      email: form.email,
      passwordHash,
      fullName: form.fullName,
      nameAtSchool: form.nameAtSchool,
      phone: form.phone,
      currentCity: form.currentCity,
      address: form.address,
      profession: form.profession,
      photoId,
      branch: branch._id,
      otherBranch: { branch: otherBranch, years: otherBranch ? form.otherBranch.years : '' },
      yearJoined: form.yearJoined,
      batchYear: form.batchYear,
      lastClass: form.lastClass,
      house: form.house,
      admissionNo: form.admissionNo,
      schoolRoles: form.schoolRoles,
      sports: form.sports,
      otherAchievements: form.otherAchievements,
      status: 'pending',
      consentAt: new Date(),
    });
  } catch (err) {
    await deleteCardPhoto(photoId); // don't leave an orphan photo behind
    throw err;
  }

  res.status(201).json({
    ok: true,
    message: `Thank you! The ${branch.name} branch committee will check your registration. Once approved, log in with your email and password to see your membership card.`,
  });
});

// ---------- Committee review ----------

// GET /api/registrations?branch=<id>  registrations waiting for approval
registrationsRouter.get('/', requireRole(...REVIEW_ROLES), async (req, res) => {
  const scoped = scopedBranchFilter(req.user, REVIEW_ROLES, req.query.branch);
  if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });

  const pending = await User.find({ status: 'pending', ...scoped })
    .sort({ createdAt: 1 })
    .limit(200)
    .populate('branch', 'name code')
    .populate('otherBranch.branch', 'name code');

  res.json({
    registrations: pending.map((u) => ({ ...u.toJSON(), photoUrl: cardPhotoUrl(u.photoId) })),
  });
});

// Find a pending registration the current committee member may review.
async function findReviewable(req, res) {
  if (!OBJECT_ID.test(req.params.id)) {
    res.status(404).json({ error: 'Registration not found.' });
    return null;
  }
  const user = await User.findById(req.params.id).populate('branch', 'name code');
  if (!user || user.status !== 'pending') {
    res.status(404).json({ error: 'This registration is no longer waiting for approval.' });
    return null;
  }
  if (!hasRole(req.user, REVIEW_ROLES, user.branch._id)) {
    res
      .status(403)
      .json({ error: `Only the ${user.branch.name} committee can review this registration.` });
    return null;
  }
  return user;
}

// POST /api/registrations/:id/approve  → active member with a member number
registrationsRouter.post('/:id/approve', requireRole(...REVIEW_ROLES), async (req, res) => {
  const user = await findReviewable(req, res);
  if (!user) return;

  const seq = await nextSequence(`member-${user.branch.code}`);
  const memberNo = formatMemberNo(user.branch.code, user.batchYear, seq);

  // Only update if it is still pending (two committee members could click at once).
  const updated = await User.findOneAndUpdate(
    { _id: user._id, status: 'pending' },
    {
      $set: {
        status: 'active',
        memberNo,
        review: { by: req.user._id, at: new Date(), note: '' },
      },
    },
    { new: true }
  );
  if (!updated) {
    return res.status(409).json({ error: 'Someone else has just reviewed this registration.' });
  }
  res.json({ ok: true, memberNo, name: updated.fullName });
});

const rejectSchema = z.object({
  note: z.string().trim().min(3, 'Give a short reason').max(300),
});

// POST /api/registrations/:id/reject  { note }  → photo deleted, she may register again
registrationsRouter.post(
  '/:id/reject',
  requireRole(...REVIEW_ROLES),
  validate(rejectSchema),
  async (req, res) => {
    const user = await findReviewable(req, res);
    if (!user) return;

    await deleteCardPhoto(user.photoId);
    user.photoId = '';
    user.status = 'rejected';
    user.review = { by: req.user._id, at: new Date(), note: req.body.note };
    await user.save();
    res.json({ ok: true });
  }
);
