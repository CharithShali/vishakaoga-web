// Money is stored as whole cents (an integer), never as a decimal number,
// so totals never pick up rounding errors like 0.1 + 0.2 = 0.30000000000000004.

/** "5000", "5,000.50", 5000.5 → 500050. Returns null if it isn't a sensible amount. */
export function toCents(value) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [rupees, cents = ''] = text.split('.');
  const total = Number(rupees) * 100 + Number(cents.padEnd(2, '0'));
  if (!Number.isSafeInteger(total) || total <= 0 || total > 100_000_000_00) return null;
  return total;
}

/** 500050 → "5000.50" (for filling the edit form) */
export function centsToText(cents) {
  const whole = Math.floor(cents / 100);
  const part = cents % 100;
  return part ? `${whole}.${String(part).padStart(2, '0')}` : String(whole);
}

// A plain calendar date, "2026-11-06". Stored as text so it never shifts with time zones.
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDate(text) {
  const m = DATE.exec(String(text || ''));
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Today's date in Sri Lanka, "2026-11-06". */
export function todayInColombo(now = new Date()) {
  return new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}
