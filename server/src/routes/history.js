import { Router } from 'express';
import { z } from 'zod';
import { History } from '../models/History.js';
import { Branch } from '../models/Branch.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HISTORY_ROLES, canEditHistory } from '../utils/postPermissions.js';
import { isPublicImageId, publicImageUrl, deletePublicImage } from '../services/photos.js';

export const historyRouter = Router();

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const BRANCH_FIELDS = 'name code order foundedYear address principal about photoId';

async function loadAll() {
  const [history, branches] = await Promise.all([
    History.findOne({ key: 'main' }),
    Branch.find({ active: true }).sort({ order: 1, name: 1 }).select(BRANCH_FIELDS),
  ]);
  return { history, branches };
}

function present({ history, branches }, user) {
  const h = history ? history.toJSON() : {};
  return {
    history: {
      storyTitle: h.storyTitle || '',
      story: h.story || '',
      motto: h.motto || '',
      mottoMeaning: h.mottoMeaning || '',
      timeline: h.timeline || [],
      committeeTerm: h.committeeTerm || '',
      centralCommittee: h.centralCommittee || [],
      branchCommittees: h.branchCommittees || [],
      presidents: h.presidents || [],
      honours: (h.honours || []).map((x) => ({ ...x, photoUrl: publicImageUrl(x.photoId) })),
      updatedAt: h.updatedAt || null,
    },
    branches: branches.map((b) => ({ ...b.toJSON(), photoUrl: publicImageUrl(b.photoId) })),
    canEdit: user ? canEditHistory(user) : false,
  };
}

// GET /api/history  (public)
historyRouter.get('/', async (req, res) => {
  res.json(present(await loadAll(), req.user));
});

// ---------- editing (central Secretary / main admin) ----------

const text = (max) => z.string().trim().max(max).optional().default('');
const branchRef = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.string().regex(OBJECT_ID, 'Unknown branch').nullable()
);
const photo = z
  .string()
  .max(200)
  .optional()
  .default('')
  .refine((v) => !v || isPublicImageId(v), 'Choose the picture again');
const person = z.object({ position: text(80), name: text(120), branch: branchRef.optional().default(null), batch: text(20) });
const keep = (row) => Object.values(row).some((v) => v && String(v).trim());

const historySchema = z.object({
  storyTitle: text(200),
  story: text(6000),
  motto: text(200),
  mottoMeaning: text(400),
  timeline: z.array(z.object({ year: text(20), title: text(200), text: text(1500) })).max(80).default([]),
  committeeTerm: text(40),
  centralCommittee: z.array(person).max(40).default([]),
  branchCommittees: z.array(person).max(90).default([]),
  presidents: z
    .array(z.object({ term: text(40), name: text(120), branch: branchRef.optional().default(null), batch: text(20) }))
    .max(150)
    .default([]),
  honours: z
    .array(
      z.object({
        year: text(20),
        name: text(120),
        branch: branchRef.optional().default(null),
        batch: text(20),
        field: text(80),
        achievement: text(600),
        photoId: photo,
      })
    )
    .max(120)
    .default([]),
  branches: z
    .array(
      z.object({
        _id: z.string().regex(OBJECT_ID),
        foundedYear: z.preprocess(
          (v) => (v === '' || v == null ? null : v),
          z.coerce.number().int().min(1800).max(2100).nullable()
        ),
        address: text(300),
        principal: text(120),
        about: text(800),
        photoId: photo,
      })
    )
    .max(10)
    .default([]),
});

// PUT /api/history  saves the whole page at once
historyRouter.put('/', requireRole(...HISTORY_ROLES), validate(historySchema), async (req, res) => {
  if (!canEditHistory(req.user)) {
    return res.status(403).json({ error: 'The history page is edited by the central Secretary or the main admin.' });
  }
  const { branches: branchEdits, ...body } = req.body;

  // Every branch mentioned must exist.
  const branchList = await Branch.find({}).select('_id');
  const known = new Set(branchList.map((b) => String(b._id)));
  const mentioned = [
    ...body.centralCommittee,
    ...body.branchCommittees,
    ...body.presidents,
    ...body.honours,
  ].map((r) => r.branch).filter(Boolean);
  if (mentioned.some((id) => !known.has(id)) || branchEdits.some((b) => !known.has(b._id))) {
    return res.status(400).json({ error: 'Unknown branch.' });
  }
  if (body.branchCommittees.some((p) => p.name && !p.branch)) {
    return res.status(400).json({ error: 'Choose the branch for each branch committee member.' });
  }

  const before = await loadAll();
  const oldPhotos = new Set([
    ...(before.history?.honours || []).map((h) => h.photoId),
    ...before.branches.map((b) => b.photoId),
  ].filter(Boolean));

  // Drop rows that were added but left empty.
  const values = {
    ...body,
    timeline: body.timeline.filter(keep),
    centralCommittee: body.centralCommittee.filter((p) => p.name || p.position),
    branchCommittees: body.branchCommittees.filter((p) => p.name || p.position),
    presidents: body.presidents.filter((p) => p.name || p.term),
    honours: body.honours.filter((h) => h.name),
    updatedBy: req.user._id,
    demo: false,
  };
  await History.findOneAndUpdate({ key: 'main' }, { $set: values }, { upsert: true, runValidators: true });
  for (const b of branchEdits) {
    const { _id, ...fields } = b;
    await Branch.updateOne({ _id }, { $set: fields });
  }

  const after = await loadAll();
  const stillUsed = new Set([
    ...(after.history?.honours || []).map((h) => h.photoId),
    ...after.branches.map((b) => b.photoId),
  ]);
  for (const id of oldPhotos) if (!stillUsed.has(id)) await deletePublicImage(id);

  res.json(present(after, req.user));
});
