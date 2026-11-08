import { Router } from 'express';
import { z } from 'zod';
import { Post, POST_CATEGORIES } from '../models/Post.js';
import { Branch } from '../models/Branch.js';
import { requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { POST_ROLES, canManagePost, draftCondition } from '../utils/postPermissions.js';
import { isPublicImageId, publicImageUrl, deletePublicImage } from '../services/photos.js';

export const postsRouter = Router();

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const PAGE_SIZE = 12;

const branchIdOf = (post) => (post.branch ? post.branch._id ?? post.branch : null);

function present(post, user, { withBody = false } = {}) {
  const p = post.toJSON();
  if (!withBody) delete p.body;
  return {
    ...p,
    coverUrl: publicImageUrl(post.coverId),
    author: post.author?.fullName ? { fullName: post.author.fullName } : null,
    canManage: user ? canManagePost(user, branchIdOf(post)) : false,
  };
}

async function loadPost(req, res) {
  if (!OBJECT_ID.test(req.params.id)) {
    res.status(404).json({ error: 'Post not found.' });
    return null;
  }
  const post = await Post.findById(req.params.id).populate('branch', 'name code').populate('author', 'fullName');
  if (!post) {
    res.status(404).json({ error: 'Post not found.' });
    return null;
  }
  return post;
}

// ---------- reading (open to everyone) ----------

// GET /api/posts?branch=&category=&skip=&limit=&published=1
// Published posts, newest first. "Members only" posts are left out for visitors.
// Committee members also see the drafts they may edit.
postsRouter.get('/', async (req, res) => {
  const published = { status: 'published' };
  if (!req.user) published.membersOnly = false;
  // ?published=1 (home page): never drafts
  const draft = req.user && req.query.published !== '1' ? draftCondition(req.user) : null;
  const and = [draft ? { $or: [published, draft] } : published];

  if (req.query.branch) {
    const branch = String(req.query.branch);
    if (!OBJECT_ID.test(branch)) return res.status(400).json({ error: 'Unknown branch.' });
    and.push({ $or: [{ branch }, { branch: null }] }); // her branch plus posts for everyone
  }
  if (req.query.category) {
    if (!POST_CATEGORIES.includes(req.query.category)) return res.status(400).json({ error: 'Unknown category.' });
    and.push({ category: req.query.category });
  }

  const filter = { $and: and };
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.min(PAGE_SIZE, Math.max(1, Number(req.query.limit) || PAGE_SIZE));
  const [posts, total] = await Promise.all([
    // Drafts first ('draft' sorts before 'published'), then newest
    Post.find(filter)
      .sort({ status: 1, publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-body')
      .populate('branch', 'name code')
      .populate('author', 'fullName'),
    Post.countDocuments(filter),
  ]);

  res.json({ posts: posts.map((p) => present(p, req.user)), total, categories: POST_CATEGORIES });
});

// GET /api/posts/:id
postsRouter.get('/:id', async (req, res) => {
  const post = await loadPost(req, res);
  if (!post) return;
  const canManage = req.user ? canManagePost(req.user, branchIdOf(post)) : false;
  if (post.status !== 'published' && !canManage) return res.status(404).json({ error: 'Post not found.' });
  if (post.membersOnly && !req.user) {
    return res.status(401).json({ error: 'This post is for members. Please log in to read it.' });
  }
  res.json({ post: present(post, req.user, { withBody: true }) });
});

// ---------- writing (committee) ----------

const postSchema = z.object({
  title: z.string().trim().min(3, 'Give the post a title').max(140),
  category: z.enum(POST_CATEGORIES).optional().default('News'),
  summary: z.string().trim().max(300, 'Keep the summary under 300 characters').optional().default(''),
  body: z.string().trim().max(20000, 'The post is too long').optional().default(''),
  branch: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.string().regex(OBJECT_ID, 'Choose a branch').nullable()
  ),
  coverId: z.string().max(200).optional().default(''),
  membersOnly: z.boolean().optional().default(false),
  status: z.enum(['draft', 'published']).optional().default('published'),
});

async function checkPostInput(body, user) {
  if (!body.summary && !body.body) return { error: 'Write the post (or at least a summary).' };
  if (body.coverId && !isPublicImageId(body.coverId)) return { error: 'Choose the cover picture again.' };
  if (body.branch && !(await Branch.exists({ _id: body.branch }))) return { error: 'Choose a branch.' };
  if (!canManagePost(user, body.branch)) {
    return {
      status: 403,
      error: body.branch
        ? 'You can only post for your own branch.'
        : 'Posts for all branches need the central Secretary or the main admin.',
    };
  }
  return { values: body };
}

// POST /api/posts
postsRouter.post('/', requireRole(...POST_ROLES), validate(postSchema), async (req, res) => {
  const checked = await checkPostInput(req.body, req.user);
  if (checked.error) return res.status(checked.status || 400).json({ error: checked.error });

  const post = await Post.create({
    ...checked.values,
    publishedAt: checked.values.status === 'published' ? new Date() : null,
    author: req.user._id,
    updatedBy: req.user._id,
  });
  await post.populate([{ path: 'branch', select: 'name code' }, { path: 'author', select: 'fullName' }]);
  res.status(201).json({ post: present(post, req.user, { withBody: true }) });
});

// PUT /api/posts/:id
postsRouter.put('/:id', requireRole(...POST_ROLES), validate(postSchema), async (req, res) => {
  const post = await loadPost(req, res);
  if (!post) return;
  if (!canManagePost(req.user, branchIdOf(post))) return res.status(403).json({ error: "You can't edit this post." });
  const checked = await checkPostInput(req.body, req.user);
  if (checked.error) return res.status(checked.status || 400).json({ error: checked.error });

  const oldCover = post.coverId;
  Object.assign(post, checked.values, { updatedBy: req.user._id });
  if (post.status === 'published' && !post.publishedAt) post.publishedAt = new Date();
  if (post.status === 'draft') post.publishedAt = null;
  await post.save();
  if (oldCover && oldCover !== post.coverId) await deletePublicImage(oldCover);

  await post.populate([{ path: 'branch', select: 'name code' }, { path: 'author', select: 'fullName' }]);
  res.json({ post: present(post, req.user, { withBody: true }) });
});

// DELETE /api/posts/:id  (its cover picture is deleted too)
postsRouter.delete('/:id', requireRole(...POST_ROLES), async (req, res) => {
  const post = await loadPost(req, res);
  if (!post) return;
  if (!canManagePost(req.user, branchIdOf(post))) return res.status(403).json({ error: "You can't delete this post." });
  await post.deleteOne();
  await deletePublicImage(post.coverId);
  res.json({ ok: true });
});
