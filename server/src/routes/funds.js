import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Fund, Transaction, CATEGORIES, PAYMENT_METHODS } from '../models/Fund.js';
import { Branch } from '../models/Branch.js';
import { User } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { isCommittee } from '../utils/permissions.js';
import {
  canRecordMoney,
  canManageFunds,
  branchCondition,
  yearCondition,
  TREASURER_ROLES,
} from '../utils/fundPermissions.js';
import { toCents, centsToText, isValidDate, todayInColombo } from '../utils/money.js';
import { FIRST_BATCH_YEAR } from '../utils/options.js';

export const fundsRouter = Router();

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const NOT_VOIDED = { 'voided.at': null };
const PAGE_SIZE = 50;

// Fund records are for members only (not the public website).
fundsRouter.use(requireAuth);

// Aggregation pipelines don't convert text ids to ObjectIds the way find() does.
function forAggregate(filter) {
  const out = { ...filter };
  if (typeof out.branch === 'string') out.branch = new mongoose.Types.ObjectId(out.branch);
  return out;
}

function readFilters(query) {
  const branch = branchCondition(String(query.branch || ''));
  const year = yearCondition(query.year ? String(query.year) : String(new Date().getFullYear()));
  if (!branch || !year) return null;
  return { branch, year };
}

function sumByType(rows) {
  const totals = { inCents: 0, outCents: 0 };
  for (const r of rows) totals[r._id === 'in' ? 'inCents' : 'outCents'] += r.total;
  return { ...totals, balanceCents: totals.inCents - totals.outCents };
}

// ---------- Overview ----------

// GET /api/funds  funds, years with records, and what this person may do
fundsRouter.get('/', async (req, res) => {
  const [funds, yearRows, branches] = await Promise.all([
    Fund.find({ active: true }).sort({ order: 1, name: 1 }),
    Transaction.aggregate([{ $group: { _id: { $substrBytes: ['$date', 0, 4] } } }]),
    Branch.find({ active: true }).sort({ order: 1 }).select('name code'),
  ]);
  const years = new Set(yearRows.map((y) => y._id));
  years.add(String(new Date().getFullYear()));

  res.json({
    funds,
    years: [...years].sort().reverse(),
    branches,
    categories: CATEGORIES,
    paymentMethods: PAYMENT_METHODS,
    canManageFunds: canManageFunds(req.user),
    canRecordCentral: canRecordMoney(req.user, null),
    recordBranches: branches.filter((b) => canRecordMoney(req.user, b._id)).map((b) => String(b._id)),
  });
});

// GET /api/funds/summary?branch=&year=
fundsRouter.get('/summary', async (req, res) => {
  const f = readFilters(req.query);
  if (!f) return res.status(400).json({ error: 'Unknown branch or year.' });

  const periodMatch = forAggregate({ ...NOT_VOIDED, ...f.branch, ...f.year });
  const allTimeMatch = forAggregate({ ...NOT_VOIDED, ...f.branch });
  const byBranchMatch = forAggregate({ ...NOT_VOIDED, ...f.year });

  const [period, allTime, byBranch, byFund] = await Promise.all([
    Transaction.aggregate([{ $match: periodMatch }, { $group: { _id: '$type', total: { $sum: '$amountCents' } } }]),
    Transaction.aggregate([{ $match: allTimeMatch }, { $group: { _id: '$type', total: { $sum: '$amountCents' } } }]),
    Transaction.aggregate([
      { $match: byBranchMatch },
      { $group: { _id: { branch: '$branch', type: '$type' }, total: { $sum: '$amountCents' } } },
    ]),
    Transaction.aggregate([
      { $match: NOT_VOIDED },
      { $group: { _id: { fund: '$fund', type: '$type' }, total: { $sum: '$amountCents' } } },
    ]),
  ]);

  // One row per branch, plus "Central" for association-wide money.
  const branches = await Branch.find({ active: true }).sort({ order: 1 }).select('name');
  const rows = [...branches.map((b) => ({ key: String(b._id), name: b.name })), { key: 'central', name: 'Central (all branches)' }];
  const byBranchRows = rows.map((row) => {
    const mine = byBranch.filter((x) => String(x._id.branch ?? 'central') === row.key).map((x) => ({ _id: x._id.type, total: x.total }));
    return { ...row, ...sumByType(mine) };
  });

  const funds = await Fund.find({ active: true }).sort({ order: 1, name: 1 });
  const fundRows = funds.map((fund) => {
    const mine = byFund.filter((x) => String(x._id.fund) === String(fund._id)).map((x) => ({ _id: x._id.type, total: x.total }));
    return { _id: fund._id, name: fund.name, description: fund.description, goalCents: fund.goalCents, ...sumByType(mine) };
  });

  res.json({
    period: sumByType(period),
    balanceCents: sumByType(allTime).balanceCents, // money in hand, all time
    byBranch: byBranchRows,
    funds: fundRows,
  });
});

// GET /api/funds/transactions?branch=&year=&fund=&type=&skip=
fundsRouter.get('/transactions', async (req, res) => {
  const f = readFilters(req.query);
  if (!f) return res.status(400).json({ error: 'Unknown branch or year.' });
  const filter = { ...f.branch, ...f.year };
  if (req.query.fund && OBJECT_ID.test(req.query.fund)) filter.fund = req.query.fund;
  if (req.query.type === 'in' || req.query.type === 'out') filter.type = req.query.type;
  const skip = Math.max(0, Number(req.query.skip) || 0);

  const committee = isCommittee(req.user);
  let query = Transaction.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(PAGE_SIZE)
    .populate('fund', 'name')
    .populate('branch', 'name')
    .populate('recordedBy', 'fullName')
    .populate('voided.by', 'fullName');
  // Who paid is shown to the committee only.
  if (committee) query = query.populate('member', 'fullName memberNo');

  const [rows, total] = await Promise.all([query, Transaction.countDocuments(filter)]);
  res.json({
    total,
    transactions: rows.map((t) => {
      const o = t.toJSON();
      if (!committee) {
        delete o.member;
        delete o.reference;
      }
      return {
        ...o,
        amountText: centsToText(t.amountCents),
        canEdit: !t.voided?.at && canRecordMoney(req.user, t.branch?._id ?? null),
      };
    }),
  });
});

// ---------- Recording money (treasurers) ----------

const thisYear = () => new Date().getFullYear();

const transactionSchema = z.object({
  date: z.string(),
  type: z.enum(['in', 'out'], { errorMap: () => ({ message: 'Choose money in or money out' }) }),
  amount: z.union([z.string(), z.number()]),
  category: z.string(),
  description: z.string().trim().min(3, 'Say what the money was for').max(300),
  fund: z.string().regex(OBJECT_ID, 'Choose a fund'),
  branch: z.preprocess((v) => (v === '' || v === 'central' || v == null ? null : v), z.string().regex(OBJECT_ID).nullable()),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().default('Cash'),
  reference: z.string().trim().max(60).optional().default(''),
  member: z.preprocess((v) => (v === '' || v == null ? null : v), z.string().regex(OBJECT_ID).nullable()),
  subscriptionYear: z.preprocess((v) => (v === '' || v == null ? null : Number(v)), z.number().int().nullable()),
});

async function checkTransaction(body, user) {
  const amountCents = toCents(body.amount);
  if (!amountCents) return { error: 'Enter the amount in rupees, e.g. 5000 or 5000.50' };
  if (!isValidDate(body.date)) return { error: 'Enter a valid date.' };
  if (body.date > todayInColombo()) return { error: "The date can't be in the future." };
  if (!CATEGORIES[body.type].includes(body.category)) return { error: 'Choose a category.' };
  if (!(await Fund.exists({ _id: body.fund, active: true }))) return { error: 'Choose a fund.' };
  if (body.branch && !(await Branch.exists({ _id: body.branch }))) return { error: 'Choose a branch.' };
  if (!canRecordMoney(user, body.branch)) {
    return {
      status: 403,
      error: body.branch
        ? 'You can only record money for your own branch.'
        : 'Central (all-branch) money needs the central Treasurer or the main admin.',
    };
  }
  if (body.member && !(await User.exists({ _id: body.member }))) return { error: 'Member not found.' };

  let subscriptionYear = null;
  if (body.type === 'in' && body.category === 'Membership fee') {
    if (!body.member) return { error: 'Choose the member who paid the membership fee.' };
    subscriptionYear = body.subscriptionYear || Number(body.date.slice(0, 4));
    if (subscriptionYear < FIRST_BATCH_YEAR || subscriptionYear > thisYear() + 1) {
      return { error: 'Enter the year the membership fee is for.' };
    }
  }

  return {
    values: {
      date: body.date,
      type: body.type,
      amountCents,
      category: body.category,
      description: body.description,
      fund: body.fund,
      branch: body.branch,
      paymentMethod: body.paymentMethod,
      reference: body.reference,
      member: body.member,
      subscriptionYear,
    },
  };
}

// GET /api/funds/transactions/:id  one record (for the edit form)
fundsRouter.get('/transactions/:id', requireRole(...TREASURER_ROLES), async (req, res) => {
  if (!OBJECT_ID.test(req.params.id)) return res.status(404).json({ error: 'Record not found.' });
  const t = await Transaction.findById(req.params.id).populate('member', 'fullName memberNo');
  if (!t) return res.status(404).json({ error: 'Record not found.' });
  if (!canRecordMoney(req.user, t.branch)) return res.status(403).json({ error: "You can't edit this record." });
  res.json({ transaction: { ...t.toJSON(), amountText: centsToText(t.amountCents) } });
});

fundsRouter.post('/transactions', requireRole(...TREASURER_ROLES), validate(transactionSchema), async (req, res) => {
  const checked = await checkTransaction(req.body, req.user);
  if (checked.error) return res.status(checked.status || 400).json({ error: checked.error });
  const t = await Transaction.create({ ...checked.values, recordedBy: req.user._id });
  res.status(201).json({ transaction: t });
});

fundsRouter.put('/transactions/:id', requireRole(...TREASURER_ROLES), validate(transactionSchema), async (req, res) => {
  if (!OBJECT_ID.test(req.params.id)) return res.status(404).json({ error: 'Record not found.' });
  const t = await Transaction.findById(req.params.id);
  if (!t) return res.status(404).json({ error: 'Record not found.' });
  if (t.voided?.at) return res.status(400).json({ error: 'This record was voided and cannot be changed.' });
  if (!canRecordMoney(req.user, t.branch)) return res.status(403).json({ error: "You can't edit this record." });

  const checked = await checkTransaction(req.body, req.user);
  if (checked.error) return res.status(checked.status || 400).json({ error: checked.error });
  Object.assign(t, checked.values, { updatedBy: req.user._id });
  await t.save();
  res.json({ transaction: t });
});

const voidSchema = z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(300) });

// POST /api/funds/transactions/:id/void  { reason }  → kept on record, no longer counted
fundsRouter.post('/transactions/:id/void', requireRole(...TREASURER_ROLES), validate(voidSchema), async (req, res) => {
  if (!OBJECT_ID.test(req.params.id)) return res.status(404).json({ error: 'Record not found.' });
  const t = await Transaction.findById(req.params.id);
  if (!t) return res.status(404).json({ error: 'Record not found.' });
  if (t.voided?.at) return res.status(400).json({ error: 'This record is already voided.' });
  if (!canRecordMoney(req.user, t.branch)) return res.status(403).json({ error: "You can't void this record." });
  t.voided = { at: new Date(), by: req.user._id, reason: req.body.reason };
  await t.save();
  res.json({ ok: true });
});

// GET /api/funds/member-search?q=  pick who paid (treasurers)
fundsRouter.get('/member-search', requireRole(...TREASURER_ROLES), async (req, res) => {
  const text = String(req.query.q || '').trim().slice(0, 60);
  if (text.length < 2) return res.json({ members: [] });
  const rx = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const members = await User.find({ status: 'active', $or: [{ fullName: rx }, { nameAtSchool: rx }, { memberNo: rx }] })
    .limit(10)
    .select('fullName memberNo batchYear branch')
    .populate('branch', 'name');
  res.json({ members });
});

// ---------- Funds themselves (central treasurer / admin) ----------

const fundSchema = z.object({
  name: z.string().trim().min(3, 'Give the fund a name').max(80),
  description: z.string().trim().max(300).optional().default(''),
  goal: z.union([z.string(), z.number()]).optional().default(''),
  active: z.boolean().optional().default(true),
});

function fundValues(body) {
  const goalText = String(body.goal ?? '').trim();
  const goalCents = goalText === '' || goalText === '0' ? 0 : toCents(goalText);
  if (goalCents === null) return { error: 'Enter the goal in rupees, or leave it empty.' };
  return { values: { name: body.name, description: body.description, goalCents, active: body.active } };
}

fundsRouter.post('/', validate(fundSchema), async (req, res) => {
  if (!canManageFunds(req.user)) return res.status(403).json({ error: 'Only the central Treasurer or the main admin can add funds.' });
  const v = fundValues(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const order = await Fund.countDocuments();
  res.status(201).json({ fund: await Fund.create({ ...v.values, order }) });
});

fundsRouter.put('/:id', validate(fundSchema), async (req, res) => {
  if (!canManageFunds(req.user)) return res.status(403).json({ error: 'Only the central Treasurer or the main admin can change funds.' });
  if (!OBJECT_ID.test(req.params.id)) return res.status(404).json({ error: 'Fund not found.' });
  const v = fundValues(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const fund = await Fund.findByIdAndUpdate(req.params.id, v.values, { new: true });
  if (!fund) return res.status(404).json({ error: 'Fund not found.' });
  res.json({ fund });
});
