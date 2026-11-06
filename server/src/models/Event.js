import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const EVENT_KINDS = [
  'Get-together',
  'Reunion',
  'Meeting',
  'Sport',
  'Service',
  'Celebration',
  'Other',
];

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    kind: { type: String, enum: EVENT_KINDS, default: 'Get-together' },
    description: { type: String, trim: true, default: '' },
    venue: { type: String, trim: true, default: '' },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true }, // decides when it moves to "Past events"
    // null = a joint event for all three branches
    branch: { type: ObjectId, ref: 'Branch', default: null },
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

eventSchema.index({ endsAt: 1 });
eventSchema.index({ branch: 1, startsAt: 1 });

export const Event = mongoose.model('Event', eventSchema);

// "I'm attending" (one per member per event)
const rsvpSchema = new mongoose.Schema(
  {
    event: { type: ObjectId, ref: 'Event', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);
rsvpSchema.index({ event: 1, user: 1 }, { unique: true });

export const EventRsvp = mongoose.model('EventRsvp', rsvpSchema);

// Scanned in at the gate (one per member per event)
const checkinSchema = new mongoose.Schema(
  {
    event: { type: ObjectId, ref: 'Event', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    by: { type: ObjectId, ref: 'User' }, // who scanned her
    method: { type: String, enum: ['qr', 'typed'], default: 'qr' },
  },
  { timestamps: true }
);
checkinSchema.index({ event: 1, user: 1 }, { unique: true });

export const EventCheckin = mongoose.model('EventCheckin', checkinSchema);
