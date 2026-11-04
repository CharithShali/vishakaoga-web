function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open that photo.'));
    img.src = src;
  });
}

/**
 * Cut the chosen area out of the photo and return it as a JPEG Blob.
 * Kept at most 800 px wide; the server shrinks it again to 400 x 480.
 */
export async function cropToBlob(src, area, maxWidth = 800) {
  const img = await loadImage(src);
  const scale = Math.min(1, maxWidth / area.width);
  const width = Math.round(area.width * scale);
  const height = Math.round(area.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the photo.'))),
      'image/jpeg',
      0.9
    );
  });
}
