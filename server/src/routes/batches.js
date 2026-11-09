import { Router } from 'express';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { requireAuth } from '../middleware/auth.js';
import { History } from '../models/History.js';

export const batchesRouter = Router();

const OBJECT_ID = /^[a-f0-9]{24}$/i;

// GET /api/batches  (public: numbers only, no names)
// For each branch: the years from the school's first batch to this year, and how
// many active members each batch has. Years with 0 are the "missing" batches.
// All branches share the same school, so they share the same years.
batchesRouter.get('/', async (_req, res) => {
  const [branches, rows, history] = await Promise.all([
    Branch.find({ active: true }).sort({ order: 1, name: 1 }).select('name code foundedYear'),
    User.aggregate([
      { $match: { status: 'active', batchYear: { $ne: null } } },
      { $group: { _id: { branch: '$branch', year: '$batchYear' }, n: { $sum: 1 } } },
    ]),
    History.findOne({ key: 'main' }).select('firstBatchYear'),
  ]);
  const thisYear = new Date().getFullYear();
  // First batch set on the history page; until then, the oldest batch anyone registered
  // (or the last ten years when nobody has).
  const allYears = rows.map((r) => r._id.year).filter(Number.isInteger);
  const start = history?.firstBatchYear || (allYears.length ? Math.min(...allYears) : thisYear - 10);

  res.json({
    thisYear,
    branches: branches.map((b) => {
      const counts = {};
      for (const r of rows) if (String(r._id.branch) === String(b._id)) counts[r._id.year] = r.n;
      const known = Object.keys(counts).map(Number);
      // Never hide a batch someone registered, even if it is older than the first batch set.
      const from = Math.min(start, ...known, thisYear);
      return { _id: b._id, name: b.name, code: b.code, from, to: thisYear, counts };
    }),
  });
});

// GET /api/batches/:branch/:year  who from this batch has joined (members only)
// :branch is a branch id, or "all" for the whole school.
batchesRouter.get('/:branch/:year', requireAuth, async (req, res) => {
  const { branch } = req.params;
  const year = Number(req.params.year);
  if ((branch !== 'all' && !OBJECT_ID.test(branch)) || !Number.isInteger(year)) {
    return res.status(404).json({ error: 'Batch not found.' });
  }

  const filter = { status: 'active', batchYear: year };
  if (branch !== 'all') filter.branch = branch;
  const members = await User.find(filter)
    .sort({ fullName: 1 })
    .limit(500)
    .populate('branch', 'name')
    .select('fullName nameAtSchool lastClass house schoolRoles currentCity profession branch');

  res.json({
    year,
    members: members.map((m) => ({
      _id: m._id,
      fullName: m.fullName,
      nameAtSchool: m.nameAtSchool || '',
      lastClass: m.lastClass || '',
      house: m.house || '',
      schoolRoles: m.schoolRoles || [],
      currentCity: m.currentCity || '',
      branch: m.branch?.name || '',
      // Only if she agreed to show her work to other members
      profession: m.profession?.showToMembers ? m.profession.title || m.profession.category || '' : '',
    })),
  });
});
