import mongoose from 'mongoose';

export const POST_CATEGORIES = ['News', 'Notice', 'Reunion', 'Project', 'Achievement', 'Memories'];

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: POST_CATEGORIES, default: 'News' },
    // A short line shown on the news list and the home page
    summary: { type: String, default: '' },
    // Plain text. A blank line starts a new paragraph; web links become clickable.
    body: { type: String, default: '' },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null }, // null = all branches
    coverId: { type: String, default: '' }, // public Cloudinary picture, 16:9
    membersOnly: { type: Boolean, default: false }, // hidden from people who aren't logged in
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    demo: { type: Boolean, default: false }, // made by `npm run seed:demo`, removed before going live
  },
  { timestamps: true }
);

postSchema.index({ status: 1, publishedAt: -1 });

export const Post = mongoose.model('Post', postSchema);
