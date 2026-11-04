import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

// photos.js reads env, which needs these two values to load.
process.env.MONGODB_URI ||= 'mongodb://localhost/test';
process.env.JWT_SECRET ||= 'test-secret';
const { prepareCardPhoto } = await import('./photos.js');

async function plainPhoto() {
  return sharp({
    create: { width: 3000, height: 4000, channels: 3, background: { r: 200, g: 180, b: 150 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

// A very "busy" image (fine noise) is the hardest case to make small.
async function busyPhoto() {
  const width = 1200;
  const height = 1600;
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 7 + (i >> 8) * 13) % 256;
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg().toBuffer();
}

test('a big phone photo becomes a 400 x 480 WebP', async () => {
  const out = await prepareCardPhoto(await plainPhoto());
  const meta = await sharp(out).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 400);
  assert.equal(meta.height, 480);
});

test('the stored photo never goes over the size limit', async () => {
  const busy = await busyPhoto();
  for (const maxKb of [50, 30]) {
    const out = await prepareCardPhoto(busy, maxKb);
    assert.ok(out.length <= maxKb * 1024, `${maxKb} KB limit: got ${out.length} bytes`);
  }
});
