import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { POST_ROLES } from '../utils/postPermissions.js';
import { IMAGE_SHAPES, preparePublicImage, uploadPublicImage, publicImageUrl } from '../services/photos.js';

export const imagesRouter = Router();

// POST /api/images?shape=wide|portrait  (multipart field "image")
// For people who write news or edit the history page. Returns { id, url };
// the id is then saved with the post or page.
imagesRouter.post('/', requireRole(...POST_ROLES), imageUpload.single('image'), async (req, res) => {
  const shape = String(req.query.shape || 'wide');
  if (!IMAGE_SHAPES[shape]) return res.status(400).json({ error: 'Unknown picture shape.' });
  if (!req.file) return res.status(400).json({ error: 'Choose a picture.', field: 'image' });

  const prepared = await preparePublicImage(req.file.buffer, shape);
  const id = await uploadPublicImage(prepared);
  res.status(201).json({ id, url: publicImageUrl(id) });
});
