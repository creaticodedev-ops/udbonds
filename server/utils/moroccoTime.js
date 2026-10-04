/**
 * Agency wall-clock helpers for Morocco (Africa/Casablanca).
 * Naive datetime strings from the booking UI are interpreted in this timezone,
 * not the server process local timezone.
 */
export const AGENCY_TIMEZONE = 'Africa/Casablanca';

const pad = (n) => String(n).padStart(2, '0');

const moroccoParts = (date) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: AGENCY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const map = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
};

/** Minutes from midnight in Africa/Casablanca for an absolute instant. */
export const moroccoMinutesOfDay = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return NaN;
  const p = moroccoParts(d);
  return p.hour * 60 + p.minute;
};

/**
 * Parse a booking datetime.
 * - Instant with Z / offset → absolute UTC
 * - Naive "YYYY-MM-DDTHH:mm" → Africa/Casablanca wall time
 */
export const parseAgencyDateTime = (value) => {
  if (value instanceof Date) {
    const d = new Date(value.getTime());
    return Number.isNaN(d.getTime()) ? d : d;
  }
  const raw = String(value ?? '').trim();
  if (!raw) return new Date(NaN);

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return new Date(raw);
  }

  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!m) return new Date(raw);

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4] || 0);
  const minute = Number(m[5] || 0);
  const second = Number(m[6] || 0);

  // Morocco is UTC+1 year-round (since 2018). Iterate with Intl for safety.
  let utcMs = Date.UTC(year, month - 1, day, hour - 1, minute, second);
  for (let i = 0; i < 4; i += 1) {
    const p = moroccoParts(new Date(utcMs));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const want = Date.UTC(year, month - 1, day, hour, minute, second);
    const delta = want - asUtc;
    if (delta === 0) break;
    utcMs += delta;
  }
  return new Date(utcMs);
};

export const formatAgencyDateTimeLocal = (date) => {
  const p = moroccoParts(date instanceof Date ? date : new Date(date));
  if (!Number.isFinite(p.year)) return '';
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

export default {
  AGENCY_TIMEZONE,
  moroccoMinutesOfDay,
  parseAgencyDateTime,
  formatAgencyDateTimeLocal,
};
