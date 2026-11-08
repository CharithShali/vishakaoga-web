import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Transaction } from '../models/Fund.js';
import { Notification } from '../models/Notification.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { scopedBranchFilter } from '../utils/branchFilter.js';
import { buildMemberSearch } from '../utils/memberSearch.js';
import { feeReminderText, firstNameOf, isValidYear } from '../utils/feeReminder.js';

export const feesRouter = Router();

// Membership fees: the Secretary and Treasurer (their branch, or all if central)
// and the main admin.
const FEE_ROLES = ['secretary', 'treasurer'];
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const MAX_MEMBERS = 3000;

feesRouter.use(requireRole(...FEE_ROLES));

/**
 * Active members in her branches with, for one year: paid or not, how much,
 * when, and the last reminder sent. Shared by the list and by "remind all unpaid".
 */
async function feeStatus(user, { year, branch, q, memberIds }) {
  const scoped = scopedBranchFilter(user, FEE_ROLES, branch);
  if (scoped.error) return scoped;
  const search = buildMemberSearch(q, '');
  if (search.error) return { error: search.error, status: 400 };

  const filter = { status: 'active', ...scoped, ...search.filter };
  if (memberIds) filter._id = { $in: memberIds };

  const members = await User.find(filter)
    .sort({ fullName: 1 })
    .limit(MAX_MEMBERS)
    .select('fullName memberNo batchYear phone branch')
    .populate('branch', 'name');
  const ids = members.map((m) => m._id);

  const [paidRows, remindRows] = await Promise.all([
    Transaction.aggregate([
      { $match: { member: { $in: ids }, subscriptionYear: year, 'voided.at': null } },
      { $group: { _id: '$member', totalCents: { $sum: '$amountCents' }, lastDate: { $max: '$date' } } },
    ]),
    Notification.aggregate([
      { $match: { user: { $in: ids }, kind: 'fee-reminder', year } },
      { $group: { _id: '$user', last: { $max: '$createdAt' }, count: { $sum: 1 } } },
    ]),
  ]);
  const paid = new Map(paidRows.map((r) => [String(r._id), r]));
  const reminded = new Map(remindRows.map((r) => [String(r._id), r]));

  const list = members.map((m) => {
    const p = paid.get(String(m._id));
    const r = reminded.get(String(m._id));
    return {
      _id: m._id,
      fullName: m.fullName,
      memberNo: m.memberNo || '',
      batchYear: m.batchYear || null,
      phone: m.phone || '',
      branch: m.branch ? { _id: m.branch._id, name: m.branch.name } : null,
      paid: Boolean(p),
      paidCents: p?.totalCents || 0,
      paidDate: p?.lastDate || null,
      lastReminderAt: r?.last || null,
      reminderCount: r?.count || 0,
    };
  });
  return { list, truncated: members.length === MAX_MEMBERS };
}

// GET /api/fees/status?year=2026&branch=&q=&show=all|paid|unpaid
feesRouter.get('/status', async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  if (!isValidYear(year)) return res.status(400).json({ error: 'Choose a year.' });

  const result = await feeStatus(req.user, { year, branch: req.query.branch, q: req.query.q });
  if (result.error) return res.status(result.status).json({ error: result.error });

  const { list } = result;
  const paidCount = list.filter((m) => m.paid).length;
  const show = req.query.show;
  const members = show === 'paid' ? list.filter((m) => m.paid) : show === 'unpaid' ? list.filter((m) => !m.paid) : list;

  res.json({
    year,
    total: list.length,
    paidCount,
    unpaidCount: list.length - paidCount,
    members,
    truncated: result.truncated,
  });
});

const remindSchema = z.object({
  year: z.coerce.number().int(),
  branch: z.string().optional().default(''),
  memberIds: z.array(z.string().regex(OBJECT_ID)).max(MAX_MEMBERS).optional(),
  allUnpaid: z.boolean().optional().default(false),
});

// POST /api/fees/remind { year, memberIds? | allUnpaid, branch? }
// Puts a reminder on each unpaid member's notifications (the bell in the menu).
// Members who have paid are always skipped.
feesRouter.post('/remind', validate(remindSchema), async (req, res) => {
  const { year, branch, memberIds, allUnpaid } = req.body;
  if (!isValidYear(year)) return res.status(400).json({ error: 'Choose a year.' });
  if (!allUnpaid && !memberIds?.length) {
    return res.status(400).json({ error: 'Choose who to remind.' });
  }

  const result = await feeStatus(req.user, { year, branch, memberIds: allUnpaid ? undefined : memberIds });
  if (result.error) return res.status(result.status).json({ error: result.error });

  const unpaid = result.list.filter((m) => !m.paid);
  const skippedPaid = result.list.length - unpaid.length;

  if (unpaid.length) {
    await Notification.insertMany(
      unpaid.map((m) => ({
        user: m._id,
        kind: 'fee-reminder',
        year,
        title: `Membership fee for ${year}`,
        body: feeReminderText(firstNameOf(m.fullName), year, m.branch?.name),
        link: '/card',
        createdBy: req.user._id,
      }))
    );
  }
  res.json({ sent: unpaid.length, skippedPaid });
});
