import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

// photos.js reads env, which needs these two values to load.
process.env.MONGODB_URI ||= 'mongodb://localhost/test';
process.env.JWT_SECRET ||= 'test-secret';
const { prepareCardPhoto } = await import('./photos.js');

test('a big phone photo becomes a small 400 x 480 WebP', async () => {
  const big = await sharp({
    create: { width: 3000, height: 4000, channels: 3, background: { r: 200, g: 180, b: 150 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const out = await prepareCardPhoto(big);
  const meta = await sharp(out).metadata();

  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 400);
  assert.equal(meta.height, 480);
  assert.ok(out.length < 100 * 1024, `expected under 100 KB, got ${out.length} bytes`);
});
