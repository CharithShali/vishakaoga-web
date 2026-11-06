// Event times are Sri Lanka times (UTC+05:30, no daylight saving), wherever the
// person typing them is, and wherever the server runs (Render runs in UTC).

const OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "2026-12-05T18:30" (Sri Lanka time, as typed in the form) → Date. null if invalid. */
export function colomboToDate(text) {
  const m = LOCAL.exec(String(text || ''));
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MS;
  const date = new Date(utc);
  // Reject impossible dates like 2026-02-31 (Date would roll them over).
  return dateToColombo(date) === text ? date : null;
}

/** Date → "2026-12-05T18:30" in Sri Lanka time (for filling the edit form). */
export function dateToColombo(date) {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 16);
}
