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
