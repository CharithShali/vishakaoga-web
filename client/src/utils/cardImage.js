// Draws the portrait membership card onto a canvas and returns it as a PNG Blob,
// for the "Save card" button. Same layout as MemberCard.jsx, at phone-friendly size.

const W = 640;
const H = 1040;
const NAVY = '#14284B';
const GOLD = '#C9A227';
const GOLD_SOFT = '#D9C27A';
const IVORY = '#F8F5EE';
const MUTED_LIGHT = '#DCE2EC';
const SERIF = "'Playfair Display', Georgia, serif";
const SANS = "'Source Sans 3', system-ui, sans-serif";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load an image for the card.'));
    img.src = src;
  });
}

// Write centred text, shrinking the font until it fits the width.
function fitText(ctx, text, y, { size, min = 18, weight = 400, family = SANS, color, maxWidth }) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 1;
  } while (s > min);
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, y);
}

// The school badge, round, with a thin gold ring (same as on the card on screen).
async function drawBadge(ctx, cx, cy, size) {
  try {
    const badge = await loadImage('/badge.png');
    ctx.drawImage(badge, cx - size / 2, cy - size / 2, size, size);
  } catch {
    return; // the card is still fine without it
  }
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
}

/**
 * member: { fullName, branch: { name }, batchYear, lastClass, schoolRoles, memberNo, status }
 * photoSrc: a same-site link to her photo (or null); qrDataUrl: the QR code image.
 */
export async function drawCardPng(member, photoSrc, qrDataUrl) {
  await document.fonts?.ready; // use the site's fonts, not the fallback

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Card background with gold border
  roundRect(ctx, 6, 6, W - 12, H - 12, 40);
  ctx.fillStyle = NAVY;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = GOLD;
  ctx.stroke();

  // Header: badge + "Vishaka OGA", centred
  ctx.font = `700 40px ${SERIF}`;
  const brand = 'Vishaka OGA';
  const brandW = ctx.measureText(brand).width;
  const badgeSize = 64;
  const startX = (W - (badgeSize + 16 + brandW)) / 2;
  await drawBadge(ctx, startX + badgeSize / 2, 82, badgeSize);
  ctx.font = `700 40px ${SERIF}`;
  ctx.fillStyle = GOLD;
  ctx.textAlign = 'left';
  ctx.fillText(brand, startX + badgeSize + 16, 96);
  ctx.textAlign = 'center';

  ctx.strokeStyle = '#3A5078';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, 136);
  ctx.lineTo(W - 56, 136);
  ctx.stroke();

  // Photo, 5:6, rounded
  const pw = 200;
  const ph = 240;
  const px = (W - pw) / 2;
  const py = 168;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.fillStyle = '#22385F';
  ctx.fill();
  ctx.clip();
  if (photoSrc) {
    try {
      const photo = await loadImage(photoSrc);
      ctx.drawImage(photo, px, py, pw, ph);
    } catch {
      // keep the empty frame
    }
  }
  ctx.restore();
  roundRect(ctx, px, py, pw, ph, 18);
  ctx.strokeStyle = '#6E83A8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Name and details
  const maxText = W - 100;
  fitText(ctx, member.fullName || '', 470, { size: 44, weight: 700, family: SERIF, color: IVORY, maxWidth: maxText });
  const details = [member.batchYear && `Batch ${member.batchYear}`, member.lastClass && `Class ${member.lastClass}`]
    .filter(Boolean)
    .join(' · ');
  if (details) fitText(ctx, details, 514, { size: 30, color: MUTED_LIGHT, maxWidth: maxText });
  const roles = (member.schoolRoles || []).slice(0, 3).join(' · ');
  if (roles) fitText(ctx, roles, 554, { size: 28, color: GOLD_SOFT, maxWidth: maxText });

  // QR code on white
  const q = 250;
  const qx = (W - q) / 2;
  const qy = 586;
  roundRect(ctx, qx, qy, q, q, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  if (qrDataUrl) {
    const qr = await loadImage(qrDataUrl);
    ctx.drawImage(qr, qx + 14, qy + 14, q - 28, q - 28);
  }

  // Member number and status
  fitText(ctx, member.memberNo ? `No. ${member.memberNo}` : '', 878, { size: 28, color: MUTED_LIGHT, maxWidth: maxText });
  const status = member.status === 'active' ? 'Active member' : String(member.status || '');
  ctx.font = `700 26px ${SANS}`;
  const sw = ctx.measureText(status).width + 44;
  roundRect(ctx, (W - sw) / 2, 900, sw, 44, 22);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = NAVY;
  ctx.fillText(status, W / 2, 931);

  // Branch band at the bottom, centred
  ctx.save();
  roundRect(ctx, 6, 6, W - 12, H - 12, 40);
  ctx.clip();
  ctx.fillStyle = GOLD_SOFT;
  ctx.fillRect(0, 966, W, H - 966);
  ctx.restore();
  roundRect(ctx, 6, 6, W - 12, H - 12, 40);
  ctx.lineWidth = 6;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  const branch = `${member.branch?.name || ''} branch`.toUpperCase();
  ctx.font = `700 28px ${SANS}`;
  ctx.fillStyle = NAVY;
  ctx.letterSpacing = '4px'; // ignored by older browsers, which is fine
  ctx.fillText(branch, W / 2, 1012);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not save the card.'))), 'image/png');
  });
}
