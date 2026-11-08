import multer from 'multer';

// One picture per request, kept in memory, resized with sharp, then sent to
// Cloudinary. The browser already crops and shrinks it, so 4 MB is plenty.
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    const err = new Error('The picture must be a JPEG, PNG or WebP image.');
    err.status = 400;
    cb(err);
  },
});
