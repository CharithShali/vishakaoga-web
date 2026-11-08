import { Router } from 'express';
import { Branch } from '../models/Branch.js';
import { publicImageUrl } from '../services/photos.js';

export const branchesRouter = Router();

// Public: the website needs the branch list before anyone logs in (home page, registration).
branchesRouter.get('/', async (_req, res) => {
  const branches = await Branch.find({ active: true })
    .sort({ order: 1, name: 1 })
    .select('name code order address foundedYear photoId');
  res.json({
    branches: branches.map((b) => {
      const { photoId, ...rest } = b.toJSON();
      return { ...rest, photoUrl: publicImageUrl(photoId) };
    }),
  });
});
