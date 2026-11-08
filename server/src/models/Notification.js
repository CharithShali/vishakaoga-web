import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// A message shown to one member on the website (the bell in the menu).
const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['fee-reminder', 'general'], default: 'general' },
    year: { type: Number, default: null }, // for fee reminders: which year's fee
    title: { type: String, required: true, trim: true },
    body: { type: String, trim: true, default: '' },
    link: { type: String, default: '' }, // a page on this site, e.g. "/card"
    createdBy: { type: ObjectId, ref: 'User', default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
notificationSchema.index({ kind: 1, year: 1, user: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
