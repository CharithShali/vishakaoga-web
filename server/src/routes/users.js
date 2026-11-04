import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../utils/permissions.js';
import { scopedBranchFilter } from '../utils/branchFilter.js';

export const usersRouter = Router();

const VIEW_ROLES = ['secretary', 'coordinator'];
const STATUSES = ['pending', 'active', 'rejected', 'suspended'];

// Committee member list. The central Secretary and the admin see every branch;
// a branch coordinator only sees her own branch.
usersRouter.get('/', requireRole(...VIEW_ROLES), async (req, res) => {
  const filter = {};

  const status = String(req.query.status || 'active');
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status.' });
  filter.status = status;

  const scoped = scopedBranchFilter(req.user, VIEW_ROLES, req.query.branch);
  if (scoped.error) return res.status(scoped.status).json({ error: scoped.error });
  Object.assign(filter, scoped);

  const users = await User.find(filter)
    .sort({ fullName: 1 })
    .limit(500)
    .populate('branch', 'name code')
    .populate('roles.branch', 'name code');
  res.json({ users });
});

const rolesSchema = z.object({
  roles: z
    .array(
      z.object({
        name: z.enum(ROLES),
        branch: z.string().nullable().optional().default(null),
      })
    )
    .max(10),
});

// Only the main admin can give or take away committee roles.
usersRouter.put('/:id/roles', requireRole('admin'), validate(rolesSchema), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ error: 'Member not found.' });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'Member not found.' });
  if (user.status !== 'active') {
    return res.status(400).json({ error: 'Only approved members can have committee roles.' });
  }

  // Check every branch id is real, and drop exact duplicates.
  const seen = new Set();
  const roles = [];
  for (const role of req.body.roles) {
    const branch = role.name === 'admin' ? null : role.branch || null;
    if (branch) {
      if (!mongoose.isValidObjectId(branch) || !(await Branch.exists({ _id: branch }))) {
        return res.status(400).json({ error: 'Unknown branch in roles.' });
      }
    }
    const key = `${role.name}:${branch ?? 'all'}`;
    if (!seen.has(key)) {
      seen.add(key);
      roles.push({ name: role.name, branch });
    }
  }

  // Never remove the last admin, or nobody could manage roles any more.
  const wasAdmin = user.roles.some((r) => r.name === 'admin');
  const staysAdmin = roles.some((r) => r.name === 'admin');
  if (wasAdmin && !staysAdmin) {
    const admins = await User.countDocuments({ 'roles.name': 'admin', status: 'active' });
    if (admins <= 1) {
      return res
        .status(400)
        .json({ error: 'This is the only main admin. Make someone else admin first.' });
    }
  }

  user.roles = roles;
  await user.save();
  const updated = await User.findById(user._id)
    .populate('branch', 'name code')
    .populate('roles.branch', 'name code');
  res.json({ user: updated });
});
