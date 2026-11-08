// Member photos: resized here with sharp, then stored on Cloudinary as
// "authenticated" images. They can only be opened with a signed link that the
// server hands out to people allowed to see them (the member and the committee).
//
// All image code lives in this one file, so moving to another image service
// later only means changing this file.

import sharp from 'sharp';
import cloudinaryPackage from 'cloudinary'; // CommonJS package: take .v2 from the default export

const cloudinary = cloudinaryPackage.v2;
import { env } from '../config/env.js';

const FOLDER = 'vishakaoga/members';
let configured = false;

function setup() {
  if (configured) return;
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary is not set up. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env.'
    );
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  configured = true;
}

// Largest size a stored card photo may be. Change PHOTO_MAX_KB in .env to adjust.
export const PHOTO_MAX_KB = Number(process.env.PHOTO_MAX_KB) || 50;
const QUALITY_STEPS = [80, 70, 60, 50, 40, 30];

/**
 * Turn any uploaded photo into a small card photo: 400 x 480 (5:6), WebP,
 * never bigger than PHOTO_MAX_KB. Starts at good quality and lowers it step by
 * step until it fits; very busy photos also get slightly smaller dimensions.
 * .rotate() fixes sideways phone photos using their orientation data.
 */
export async function prepareCardPhoto(buffer, maxKb = PHOTO_MAX_KB) {
  return shrinkToFit(buffer, 400, 480, maxKb);
}

// Resize to width x height (cropping to fill), then lower the WebP quality step by
// step until it is under maxKb. Last resort: 80% of the size.
async function shrinkToFit(buffer, width, height, maxKb) {
  const limit = maxKb * 1024;
  const sized = await sharp(buffer)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .toBuffer();

  let out;
  for (const quality of QUALITY_STEPS) {
    out = await sharp(sized).webp({ quality }).toBuffer();
    if (out.length <= limit) return out;
  }
  for (const quality of QUALITY_STEPS) {
    out = await sharp(sized).resize(Math.round(width * 0.8), Math.round(height * 0.8)).webp({ quality }).toBuffer();
    if (out.length <= limit) return out;
  }
  return out;
}

/** Upload a prepared photo. Returns its Cloudinary public id. */
export async function uploadCardPhoto(buffer) {
  setup();
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, type: 'authenticated', resource_type: 'image', format: 'webp' },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    stream.end(buffer);
  });
  return result.public_id;
}

/** A signed link to a member photo (null if she has none or Cloudinary isn't set up). */
export function cardPhotoUrl(photoId) {
  if (!photoId) return null;
  try {
    setup();
  } catch {
    return null;
  }
  return cloudinary.url(photoId, {
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format: 'webp',
  });
}

/** Delete a photo, e.g. when a registration is rejected. Never throws. */
export async function deleteCardPhoto(photoId) {
  if (!photoId) return;
  try {
    setup();
    await cloudinary.uploader.destroy(photoId, { type: 'authenticated', resource_type: 'image' });
  } catch (err) {
    console.error(`Could not delete photo ${photoId}:`, err.message);
  }
}

// ---------- Public pictures (news covers, branch photos, "made us proud") ----------
// These are meant for everyone, so they are stored as normal public images.

const PUBLIC_FOLDER = 'vishakaoga/public';

// Shapes the website uses. The browser crops to the same shape first.
export const IMAGE_SHAPES = {
  wide: { width: 1200, height: 675, maxKb: 180 }, // 16:9 news covers, branch photos
  portrait: { width: 400, height: 480, maxKb: 60 }, // 5:6 people
};

export function preparePublicImage(buffer, shape) {
  const s = IMAGE_SHAPES[shape];
  if (!s) throw Object.assign(new Error('Unknown picture shape.'), { status: 400 });
  return shrinkToFit(buffer, s.width, s.height, s.maxKb);
}

/** Upload a prepared public picture. Returns its Cloudinary public id. */
export async function uploadPublicImage(buffer) {
  setup();
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: PUBLIC_FOLDER, type: 'upload', resource_type: 'image', format: 'webp' },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    stream.end(buffer);
  });
  return result.public_id;
}

/** Only ids made by uploadPublicImage are accepted from the browser. */
export function isPublicImageId(id) {
  return typeof id === 'string' && id.startsWith(`${PUBLIC_FOLDER}/`) && /^[\w/-]+$/.test(id);
}

export function publicImageUrl(id) {
  if (!id) return null;
  try {
    setup();
  } catch {
    return null;
  }
  return cloudinary.url(id, { secure: true, format: 'webp' });
}

/** Delete a public picture that is no longer used. Never throws. */
export async function deletePublicImage(id) {
  if (!isPublicImageId(id)) return;
  try {
    setup();
    await cloudinary.uploader.destroy(id, { resource_type: 'image' });
  } catch (err) {
    console.error(`Could not delete picture ${id}:`, err.message);
  }
}
