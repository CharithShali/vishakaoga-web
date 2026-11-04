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

/**
 * Turn any uploaded photo into a small card photo: 400 x 480 (5:6), WebP, ~30-50 KB.
 * .rotate() fixes sideways phone photos using their orientation data.
 */
export async function prepareCardPhoto(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(400, 480, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80 })
    .toBuffer();
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
