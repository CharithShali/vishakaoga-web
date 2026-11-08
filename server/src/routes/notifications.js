import { Router } from 'express';
import { Notification } from '../models/Notification.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

// GET /api/notifications/unread-count  for the bell in the menu
notificationsRouter.get('/unread-count', async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, readAt: null });
  res.json({ count });
});

// GET /api/notifications  her latest 50
notificationsRouter.get('/', async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('createdBy', 'fullName');
  res.json({ notifications });
});

// POST /api/notifications/read-all
notificationsRouter.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
});
