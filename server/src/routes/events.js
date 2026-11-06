import { Router } from 'express';
import { z } from 'zod';
import { Event, EventRsvp, EventCheckin, EVENT_KINDS } from '../models/Event.js';
import { Branch } from '../models/Branch.js';
import { User } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { colomboToDate, dateToColombo } from '../utils/time.js';
import {
  canManageEvent,
  canCheckIn,
  normaliseMemberNo,
  MANAGE_EVENT_ROLES,
  CHECKIN_ROLES,
} from '../utils/eventPermissions.js';
import { cardPhotoUrl } from '../services/photos.js';

export const eventsRouter = Router();

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const HOUR = 60 * 60 * 1000;
const DEFAULT_LENGTH = 4 * HOUR; // if no end time is given
const CHECKIN_OPENS_BEFORE = 12 * HOUR;
const CHECKIN_CLOSES_AFTER = 24 * HOUR;

// ---------- helpers ----------

async function countsFor(Model, eventIds) {
  const rows = await Model.aggregate([
    { $match: { event: { $in: eventIds } } },
    { $group: { _id: '$event', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

// Events as the browser sees them: counts, her own "attending", and what she may do.
async function present(events, user) {
  const ids = events.map((e) => e._id);
  const [going, attended] = await Promise.all([countsFor(EventRsvp, ids), countsFor(EventCheckin, ids)]);

  let myRsvps = new Set();
  let myCheckins = new Set();
  if (user) {
    const [r, c] = await Promise.all([
      EventRsvp.find({ user: user._id, event: { $in: ids } }).select('event'),
      EventCheckin.find({ user: user._id, event: { $in: ids } }).select('event'),
    ]);
    myRsvps = new Set(r.map((x) => String(x.event)));
    myCheckins = new Set(c.map((x) => String(x.event)));
  }

  const now = Date.now();
  return events.map((e) => {
    const id = String(e._id);
    return {
      ...e.toJSON(),
      startsAtLocal: dateToColombo(e.startsAt), // Sri Lanka time, for the edit form
      endsAtLocal: dateToColombo(e.endsAt),
      isPast: e.endsAt.getTime() < now,
      goingCount: going.get(id) || 0,
      attendedCount: attended.get(id) || 0,
      iAmGoing: myRsvps.has(id),
      iAttended: myCheckins.has(id),
      canManage: user ? canManageEvent(user, e.branch) : false,
      canScan: user ? canCheckIn(user, e.branch) : false,
    };
  });
}

async function loadEvent(req, res) {
  if (!OBJECT_ID.test(req.params.id)) {
    res.status(404).json({ error: 'Event not found.' });
    return null;
  }
  const event = await Event.findById(req.params.id).populate('branch', 'name code');
  if (!event) {
    res.status(404).json({ error: 'Event not found.' });
    return null;
  }
  return event;
}

const branchIdOf = (event) => (event.branch ? event.branch._id : null);

// ---------- listing (open to everyone) ----------

// GET /api/events?when=upcoming|past&branch=<id>
// A branch filter shows that branch's events plus the joint (all-branch) ones.
eventsRouter.get('/', async (req, res) => {
  const past = req.query.when === 'past';
  const now = new Date();
  const filter = past ? { endsAt: { $lt: now } } : { endsAt: { $gte: now } };

  if (req.query.branch) {
    const branch = String(req.query.branch);
    if (!OBJECT_ID.test(branch)) return res.status(400).json({ error: 'Unknown branch.' });
    filter.$or = [{ branch }, { branch: null }];
  }

  const events = await Event.find(filter)
    .sort({ startsAt: past ? -1 : 1 })
    .limit(past ? 30 : 100)
    .populate('branch', 'name code');

  res.json({ events: await present(events, req.user) });
});

// GET /api/events/:id
eventsRouter.get('/:id', async (req, res) => {
  const event = await loadEvent(req, res);
  if (!event) return;
  const [shown] = await present([event], req.user);
  res.json({ event: shown });
});

// ---------- creating, editing, deleting (committee) ----------

const eventSchema = z.object({
  title: z.string().trim().min(3, 'Give the event a title').max(120),
  kind: z.enum(EVENT_KINDS).optional().default('Get-together'),
  description: z.string().trim().max(2000).optional().default(''),
  venue: z.string().trim().min(2, 'Enter the venue').max(200),
  branch: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.string().regex(OBJECT_ID, 'Choose a branch').nullable()
  ),
  startsAt: z.string(),
  endsAt: z.string().optional().default(''),
});

async function checkEventInput(body, user) {
  const startsAt = colomboToDate(body.startsAt);
  if (!startsAt) return { error: 'Enter the date and start time.' };
  const endsAt = body.endsAt ? colomboToDate(body.endsAt) : new Date(startsAt.getTime() + DEFAULT_LENGTH);
  if (!endsAt) return { error: 'Enter a valid end time.' };
  if (endsAt <= startsAt) return { error: 'The event must end after it starts.' };

  if (body.branch && !(await Branch.exists({ _id: body.branch }))) {
    return { error: 'Choose a branch.' };
  }
  if (!canManageEvent(user, body.branch)) {
    return {
      status: 403,
      error: body.branch
        ? 'You can only create events for your own branch.'
        : 'Events for all branches need the central Secretary or the main admin.',
    };
  }
  return {
    values: {
      title: body.title,
      kind: body.kind,
      description: body.description,
      venue: body.venue,
      branch: body.branch,
      startsAt,
      endsAt,
    },
  };
}

// POST /api/events
eventsRouter.post('/', requireRole(...MANAGE_EVENT_ROLES), validate(eventSchema), async (req, res) => {
  const checked = await checkEventInput(req.body, req.user);
  if (checked.error) return res.status(checked.status || 400).json({ error: checked.error });

  const event = await Event.create({ ...checked.values, createdBy: req.user._id });
  await event.populate('branch', 'name code');
  const [shown] = await present([event], req.user);
  res.status(201).json({ event: shown });
});

// PUT /api/events/:id
eventsRouter.put('/:id', requireRole(...MANAGE_EVENT_ROLES), validate(eventSchema), async (req, res) => {
  const event = await loadEvent(req, res);
  if (!event) return;
  if (!canManageEvent(req.user, branchIdOf(event))) {
    return res.status(403).json({ error: "You can't edit this event." });
  }
  const checked = await checkEventInput(req.body, req.user);
  if (checked.error) return res.status(checked.status || 400).json({ error: checked.error });

  Object.assign(event, checked.values);
  await event.save();
  await event.populate('branch', 'name code');
  const [shown] = await present([event], req.user);
  res.json({ event: shown });
});

// DELETE /api/events/:id  (also removes its "attending" list and check-ins)
eventsRouter.delete('/:id', requireRole(...MANAGE_EVENT_ROLES), async (req, res) => {
  const event = await loadEvent(req, res);
  if (!event) return;
  if (!canManageEvent(req.user, branchIdOf(event))) {
    return res.status(403).json({ error: "You can't delete this event." });
  }
  await Promise.all([
    EventRsvp.deleteMany({ event: event._id }),
    EventCheckin.deleteMany({ event: event._id }),
  ]);
  await event.deleteOne();
  res.json({ ok: true });
});

// ---------- "I'm attending" (members) ----------

eventsRouter.post('/:id/rsvp', requireAuth, async (req, res) => {
  const event = await loadEvent(req, res);
  if (!event) return;
  if (event.endsAt < new Date()) {
    return res.status(400).json({ error: 'This event has already happened.' });
  }
  await EventRsvp.updateOne(
    { event: event._id, user: req.user._id },
    { $setOnInsert: { event: event._id, user: req.user._id } },
    { upsert: true }
  );
  res.json({ ok: true, goingCount: await EventRsvp.countDocuments({ event: event._id }) });
});

eventsRouter.delete('/:id/rsvp', requireAuth, async (req, res) => {
  const event = await loadEvent(req, res);
  if (!event) return;
  await EventRsvp.deleteOne({ event: event._id, user: req.user._id });
  res.json({ ok: true, goingCount: await EventRsvp.countDocuments({ event: event._id }) });
});

// ---------- who is coming / who came (committee and event helpers) ----------

const personFields = {
  path: 'user',
  select: 'fullName memberNo batchYear branch status',
  populate: { path: 'branch', select: 'name' },
};

eventsRouter.get('/:id/attendees', requireRole(...CHECKIN_ROLES), async (req, res) => {
  const event = await loadEvent(req, res);
  if (!event) return;
  if (!canCheckIn(req.user, branchIdOf(event))) {
    return res.status(403).json({ error: 'This list is for the committee of this branch.' });
  }

  const [rsvps, checkins] = await Promise.all([
    EventRsvp.find({ event: event._id }).populate(personFields),
    EventCheckin.find({ event: event._id }).populate(personFields).populate('by', 'fullName'),
  ]);

  const people = new Map();
  const add = (u) => {
    const id = String(u._id);
    if (!people.has(id)) {
      people.set(id, {
        _id: id,
        fullName: u.fullName,
        memberNo: u.memberNo || '',
        batchYear: u.batchYear || null,
        branch: u.branch?.name || '',
        going: false,
        attendedAt: null,
        scannedBy: '',
      });
    }
    return people.get(id);
  };
  for (const r of rsvps) if (r.user) add(r.user).going = true;
  for (const c of checkins) {
    if (!c.user) continue;
    const p = add(c.user);
    p.attendedAt = c.createdAt;
    p.scannedBy = c.by?.fullName || '';
  }

  const attendees = [...people.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  res.json({ attendees, goingCount: rsvps.length, attendedCount: checkins.length });
});

// ---------- scanning at the gate ----------

const checkinSchema = z.object({
  code: z.string().trim().min(3, 'Scan a card or type a member number').max(60),
  method: z.enum(['qr', 'typed']).optional().default('qr'),
});

// POST /api/events/:id/checkin  { code }  → result: ok | already | removed | inactive | unknown
eventsRouter.post(
  '/:id/checkin',
  requireRole(...CHECKIN_ROLES),
  validate(checkinSchema),
  async (req, res) => {
    const event = await loadEvent(req, res);
    if (!event) return;
    if (!canCheckIn(req.user, branchIdOf(event))) {
      return res.status(403).json({ error: "You can't scan cards for this event." });
    }
    const now = Date.now();
    if (now < event.startsAt.getTime() - CHECKIN_OPENS_BEFORE) {
      return res.status(400).json({ error: 'Scanning opens 12 hours before the event starts.' });
    }
    if (now > event.endsAt.getTime() + CHECKIN_CLOSES_AFTER) {
      return res.status(400).json({ error: 'Scanning for this event has closed.' });
    }

    const memberNo = normaliseMemberNo(req.body.code);
    const member = await User.findOne({ memberNo }).populate('branch', 'name code');
    if (!member) return res.json({ result: 'unknown', code: memberNo });

    const summary = {
      _id: member._id,
      fullName: member.fullName,
      memberNo: member.memberNo,
      batchYear: member.batchYear || null,
      lastClass: member.lastClass,
      schoolRoles: member.schoolRoles,
      branch: member.branch,
      photoUrl: cardPhotoUrl(member.photoId),
      // e.g. a Colombo member at a Kandy event: still welcome, just shown to the helper
      visiting: Boolean(event.branch && String(member.branch?._id) !== String(event.branch._id)),
    };

    if (member.status === 'suspended') return res.json({ result: 'removed', member: summary });
    if (member.status !== 'active') return res.json({ result: 'inactive', member: summary });

    try {
      const checkin = await EventCheckin.create({
        event: event._id,
        user: member._id,
        by: req.user._id,
        method: req.body.method,
      });
      const attendedCount = await EventCheckin.countDocuments({ event: event._id });
      res.json({ result: 'ok', member: summary, at: checkin.createdAt, attendedCount });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      const earlier = await EventCheckin.findOne({ event: event._id, user: member._id }).populate('by', 'fullName');
      res.json({ result: 'already', member: summary, at: earlier?.createdAt, by: earlier?.by?.fullName || '' });
    }
  }
);

// DELETE /api/events/:id/checkin/:userId  undo a scan made by mistake
eventsRouter.delete('/:id/checkin/:userId', requireRole(...CHECKIN_ROLES), async (req, res) => {
  const event = await loadEvent(req, res);
  if (!event) return;
  if (!canCheckIn(req.user, branchIdOf(event))) {
    return res.status(403).json({ error: "You can't change check-ins for this event." });
  }
  if (!OBJECT_ID.test(req.params.userId)) return res.status(404).json({ error: 'Not found.' });
  await EventCheckin.deleteOne({ event: event._id, user: req.params.userId });
  res.json({ ok: true, attendedCount: await EventCheckin.countDocuments({ event: event._id }) });
});
