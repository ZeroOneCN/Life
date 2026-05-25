import dayjs from 'dayjs';

export const DATE_FORMAT = 'YYYY-MM-DD';
export const MONTH_FORMAT = 'YYYY-MM';

export function normalizeDate(value: unknown, fallback = dayjs().format(DATE_FORMAT)) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = dayjs(normalized);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : fallback;
}

export function normalizeMonth(value: unknown, fallback = dayjs().format(MONTH_FORMAT)) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return fallback;
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return raw;
  }

  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed.format(MONTH_FORMAT) : fallback;
}

export function nowIsoString() {
  return dayjs().toISOString();
}
