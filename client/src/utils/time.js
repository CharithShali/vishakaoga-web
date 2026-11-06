// Event times are always shown in Sri Lanka time, even for members abroad,
// because that's when the event actually happens.
const TZ = 'Asia/Colombo';

const fmt = (date, options) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...options }).format(new Date(date));

export const timeOnly = (date) => fmt(date, { hour: 'numeric', minute: '2-digit', hour12: true });

// For the date block on event cards: { month: 'DEC', day: '5', weekday: 'Sat' }
export function dateParts(date) {
  return {
    month: fmt(date, { month: 'short' }).toUpperCase(),
    day: fmt(date, { day: 'numeric' }),
    weekday: fmt(date, { weekday: 'short' }),
  };
}

// "Saturday 5 December 2026"
export const longDate = (date) =>
  fmt(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// "6:30 pm – 10:30 pm", or with dates when it runs over more than one day
export function timeRange(start, end) {
  const day = (d) => fmt(d, { day: 'numeric', month: 'short' });
  if (day(start) === day(end)) return `${timeOnly(start)} – ${timeOnly(end)}`;
  return `${day(start)} ${timeOnly(start)} – ${day(end)} ${timeOnly(end)}`;
}
