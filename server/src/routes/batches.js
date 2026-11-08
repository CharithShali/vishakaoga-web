import { Router } from 'express';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';
import { requireAuth } from '../middleware/auth.js';
import { FIRST_BATCH_YEAR } from '../utils/options.js';

export const batchesRouter = Router();

const OBJECT_ID = /^[a-f0-9]{24}$/i;

// GET /api/batches  (public: numbers only, no names)
// For each branch: the years from its first batch to this year, and how many
// active members each batch has. Years with 0 are the "missing" batches.
batchesRouter.get('/', async (_req, res) => {
  const [branches, rows] = await Promise.all([
    Branch.find({ active: true }).sort({ order: 1, name: 1 }).select('name code foundedYear'),
    User.aggregate([
      { $match: { status: 'active', batchYear: { $ne: null } } },
      { $group: { _id: { branch: '$branch', year: '$batchYear' }, n: { $sum: 1 } } },
    ]),
  ]);
  const thisYear = new Date().getFullYear();

  res.json({
    thisYear,
    branches: branches.map((b) => {
      const counts = {};
      for (const r of rows) if (String(r._id.branch) === String(b._id)) counts[r._id.year] = r.n;
      const known = Object.keys(counts).map(Number);
      // Start at the branch's founding year, or earlier if someone registered an older batch.
      const from = Math.min(b.foundedYear || FIRST_BATCH_YEAR, ...known, thisYear);
      return { _id: b._id, name: b.name, code: b.code, from, to: thisYear, counts };
    }),
  });
});

// GET /api/batches/:branch/:year  who from this batch has joined (members only)
batchesRouter.get('/:branch/:year', requireAuth, async (req, res) => {
  const { branch } = req.params;
  const year = Number(req.params.year);
  if (!OBJECT_ID.test(branch) || !Number.isInteger(year)) return res.status(404).json({ error: 'Batch not found.' });

  const members = await User.find({ status: 'active', branch, batchYear: year })
    .sort({ fullName: 1 })
    .limit(500)
    .select('fullName nameAtSchool lastClass house schoolRoles currentCity profession');

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
      // Only if she agreed to show her work to other members
      profession: m.profession?.showToMembers ? m.profession.title || m.profession.category || '' : '',
    })),
  });
});
