// Money arrives from the server in whole cents (500050 = LKR 5,000.50).

const number = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 500050 → "LKR 5,000.5"; 500000 → "LKR 5,000" */
export function lkr(cents) {
  const sign = cents < 0 ? '−' : '';
  return `${sign}LKR ${number.format(Math.abs(cents) / 100)}`;
}

/** Today's date in Sri Lanka, "2026-11-06" (for the date box). */
export function todayInColombo() {
  return new Date(Date.now() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}

/** "2026-11-06" → "6 Nov 2026" */
export function shortDate(text) {
  const [y, m, d] = text.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}
