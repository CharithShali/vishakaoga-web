import mongoose from 'mongoose';

// The history page: one document, edited by the central Secretary or the main admin.
// Branch details (since, address, principal, photo) live on each Branch.

const { ObjectId } = mongoose.Schema.Types;
const opts = { _id: false };

const person = new mongoose.Schema(
  {
    position: { type: String, default: '' }, // e.g. President, Hony. Secretary
    name: { type: String, default: '' },
    branch: { type: ObjectId, ref: 'Branch', default: null },
    batch: { type: String, default: '' },
  },
  opts
);

const historySchema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    storyTitle: { type: String, default: '' },
    story: { type: String, default: '' },
    motto: { type: String, default: '' },
    mottoMeaning: { type: String, default: '' },
    timeline: [
      new mongoose.Schema({ year: String, title: String, text: { type: String, default: '' } }, opts),
    ],
    committeeTerm: { type: String, default: '' }, // e.g. 2025–2026
    centralCommittee: [person],
    branchCommittees: [person], // grouped by branch on the page
    presidents: [
      new mongoose.Schema({ term: String, name: String, branch: { type: ObjectId, ref: 'Branch', default: null }, batch: { type: String, default: '' } }, opts),
    ],
    honours: [
      new mongoose.Schema(
        {
          year: { type: String, default: '' },
          name: String,
          branch: { type: ObjectId, ref: 'Branch', default: null },
          batch: { type: String, default: '' },
          field: { type: String, default: '' }, // e.g. Medicine, Sport
          achievement: { type: String, default: '' },
          photoId: { type: String, default: '' }, // public picture, 5:6
        },
        opts
      ),
    ],
    updatedBy: { type: ObjectId, ref: 'User' },
    demo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const History = mongoose.model('History', historySchema);
