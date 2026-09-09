/**
 * dateUtils.js
 * Centralized date formatting for the entire Vriddhi application.
 * All dates displayed as DD-MM-YYYY or DD-MM-YYYY HH:MM AM/PM.
 */

/** Parse any date-like value (Firestore Timestamp, Date, ISO string, epoch) to JS Date */
export function parseDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/** Format date as DD-MM-YYYY */
export function formatDate(value, fallback = '—') {
  const d = parseDate(value);
  if (!d || isNaN(d.getTime())) return fallback;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** Format date+time as DD-MM-YYYY, HH:MM AM/PM */
export function formatDateTime(value, fallback = '—') {
  const d = parseDate(value);
  if (!d || isNaN(d.getTime())) return fallback;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hh = String(hours).padStart(2, '0');
  return `${dd}-${mm}-${yyyy}, ${hh}:${minutes} ${ampm}`;
}

/** Short date label e.g. "9 Sep" — for charts/mini labels only */
export function formatShortDate(value, fallback = '—') {
  const d = parseDate(value);
  if (!d || isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const fmtDT = formatDateTime;
export const fmtD  = formatDate;
