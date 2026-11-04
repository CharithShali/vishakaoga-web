import { Router } from 'express';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { cardPhotoUrl } from '../services/photos.js';

export const membersRouter = Router();

// GET /api/members/me  what the logged-in member's card shows
membersRouter.get('/me', requireAuth, async (req, res) => {
  const u = await User.findById(req.user._id).populate('branch', 'name code');
  res.json({
    member: {
      _id: u._id,
      fullName: u.fullName,
      nameAtSchool: u.nameAtSchool,
      memberNo: u.memberNo || null,
      status: u.status,
      branch: u.branch,
      batchYear: u.batchYear || null,
      lastClass: u.lastClass,
      schoolRoles: u.schoolRoles,
      profession: u.profession,
      photoUrl: cardPhotoUrl(u.photoId),
    },
  });
});

// GET /api/members/me/photo  her photo, served from this site so the
// "Save card" button can draw it into a downloadable image.
membersRouter.get('/me/photo', requireAuth, async (req, res) => {
  const url = cardPhotoUrl(req.user.photoId);
  if (!url) return res.status(404).json({ error: 'No photo yet.' });

  const upstream = await fetch(url);
  if (!upstream.ok) return res.status(502).json({ error: 'Could not load the photo.' });

  res.set('Content-Type', upstream.headers.get('content-type') || 'image/webp');
  res.set('Cache-Control', 'private, max-age=3600');
  res.send(Buffer.from(await upstream.arrayBuffer()));
});
