import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES, hasRole } from '../utils/permissions.js';
import { Transaction } from '../models/Fund.js';
import { EventCheckin } from '../models/Event.js';
import { Notification } from '../models/Notification.js';
import { scopedBranchFilter } from '../utils/branchFilter.js';
import { buildMemberSearch } from '../utils/memberSearch.js';
import { deleteCardPhoto, cardPhotoUrl } from '../services/photos.js';

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

  // Search box (name, member number, email or batch year) and role filter
  const search = buildMemberSearch(req.query.q, req.query.role);
  if (search.error) return res.status(400).json({ error: search.error });
  Object.assign(filter, search.filter);

  const total = await User.countDocuments(filter);
  const users = await User.find(filter)
    .sort({ fullName: 1 })
    .limit(500)
    .populate('branch', 'name code')
    .populate('roles.branch', 'name code')
    .populate('removal.by', 'fullName');
  res.json({ users, total });
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

// ---------- Removing and restoring members (main admin only) ----------

const removeSchema = z.object({
  reason: z.string().trim().min(3, 'Give a short reason').max(300),
});

async function findMember(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ error: 'Member not found.' });
    return null;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'Member not found.' });
    return null;
  }
  return user;
}

// POST /api/users/:id/remove  { reason }
// She can no longer log in and her committee roles are cleared. Her record,
// member number and photo are kept, so the membership can be restored.
usersRouter.post('/:id/remove', requireRole('admin'), validate(removeSchema), async (req, res) => {
  const user = await findMember(req, res);
  if (!user) return;
  if (String(user._id) === String(req.user._id)) {
    return res.status(400).json({ error: "You can't remove your own membership." });
  }
  if (user.status !== 'active') {
    return res.status(400).json({ error: 'Only active members can be removed.' });
  }

  user.status = 'suspended';
  user.roles = [];
  user.removal = { by: req.user._id, at: new Date(), reason: req.body.reason };
  await user.save();
  res.json({ ok: true, name: user.fullName });
});

// POST /api/users/:id/restore  → active again (committee roles are not given back)
usersRouter.post('/:id/restore', requireRole('admin'), async (req, res) => {
  const user = await findMember(req, res);
  if (!user) return;
  if (user.status !== 'suspended') {
    return res.status(400).json({ error: 'This member has not been removed.' });
  }
  user.status = 'active';
  user.removal = { by: null, at: undefined, reason: '' };
  await user.save();
  res.json({ ok: true, name: user.fullName });
});

// DELETE /api/users/:id  erase a removed or rejected member completely, photo included.
// Only after removal, so nobody is deleted by a single click.
usersRouter.delete('/:id', requireRole('admin'), async (req, res) => {
  const user = await findMember(req, res);
  if (!user) return;
  if (!['suspended', 'rejected'].includes(user.status)) {
    return res.status(400).json({ error: 'Remove the membership first, then delete it.' });
  }
  await deleteCardPhoto(user.photoId);
  await user.deleteOne();
  res.json({ ok: true, name: user.fullName });
});

// ---------- One member's page (admin, Secretary, Treasurer) ----------

const DETAIL_ROLES = ['secretary', 'treasurer'];

// GET /api/users/:id/details  everything about her, her payments and events.
// A branch secretary or treasurer can open members of her own branch only.
usersRouter.get('/:id/details', requireRole(...DETAIL_ROLES), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Member not found.' });
  const member = await User.findById(req.params.id)
    .populate('branch', 'name code')
    .populate('otherBranch.branch', 'name')
    .populate('roles.branch', 'name')
    .populate('review.by', 'fullName')
    .populate('removal.by', 'fullName');
  if (!member) return res.status(404).json({ error: 'Member not found.' });
  if (!hasRole(req.user, DETAIL_ROLES, member.branch?._id)) {
    return res.status(403).json({ error: 'You can only open members of your own branch.' });
  }

  const [payments, checkins, reminders] = await Promise.all([
    Transaction.find({ member: member._id })
      .sort({ date: -1, createdAt: -1 })
      .limit(200)
      .populate('fund', 'name')
      .populate('branch', 'name')
      .populate('recordedBy', 'fullName')
      .populate('voided.by', 'fullName'),
    EventCheckin.find({ user: member._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({ path: 'event', select: 'title startsAt branch', populate: { path: 'branch', select: 'name' } }),
    Notification.find({ user: member._id, kind: 'fee-reminder' }).sort({ createdAt: -1 }).limit(20).select('year createdAt readAt'),
  ]);

  const counted = payments.filter((t) => !t.voided?.at);
  const paidYears = [...new Set(counted.filter((t) => t.subscriptionYear).map((t) => t.subscriptionYear))].sort((a, b) => b - a);

  res.json({
    member: { ...member.toJSON(), photoUrl: cardPhotoUrl(member.photoId) },
    paidYears,
    totalPaidCents: counted.filter((t) => t.type === 'in').reduce((sum, t) => sum + t.amountCents, 0),
    payments,
    events: checkins
      .filter((c) => c.event)
      .map((c) => ({ _id: c.event._id, title: c.event.title, startsAt: c.event.startsAt, branch: c.event.branch?.name || 'All branches', checkedInAt: c.createdAt })),
    reminders,
    canManage: hasRole(req.user, ['admin']), // remove / restore / delete
  });
});
