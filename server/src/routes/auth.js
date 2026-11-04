import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { validate } from '../middleware/validate.js';
import { setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

// Slow down password guessing: 10 attempts per 15 minutes per IP address.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes and try again.' },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

authRouter.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');

  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'Email or password is wrong.' });

  if (user.status === 'pending') {
    return res.status(403).json({
      error: 'Your registration is still waiting for approval by your branch coordinator.',
    });
  }
  if (user.status !== 'active') {
    return res
      .status(403)
      .json({ error: 'This account is not active. Please contact the Secretary.' });
  }

  user.lastLoginAt = new Date();
  await user.save();
  setAuthCookie(res, user._id);

  const fresh = await User.findById(user._id).populate('branch', 'name code');
  res.json({ user: fresh });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Who is logged in? Returns { user: null } when nobody is.
authRouter.get('/me', async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = await User.findById(req.user._id)
    .populate('branch', 'name code')
    .populate('roles.branch', 'name code');
  res.json({ user });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'Use at least 8 characters'),
});

authRouter.post(
  '/change-password',
  requireAuth,
  validate(changePasswordSchema),
  async (req, res) => {
    const user = await User.findById(req.user._id).select('+passwordHash');
    const ok = await bcrypt.compare(req.body.currentPassword, user.passwordHash);
    if (!ok) return res.status(400).json({ error: 'Your current password is wrong.' });

    user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await user.save();
    res.json({ ok: true });
  }
);
