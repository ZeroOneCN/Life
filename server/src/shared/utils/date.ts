import dayjs from 'dayjs';

export const DATE_FORMAT = 'YYYY-MM-DD';
export const MONTH_FORMAT = 'YYYY-MM';
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

const VALID_DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,
  /^\d{4}\/\d{2}\/\d{2}$/,
  /^\d{4}\.\d{2}\.\d{2}$/,
];

function isValidDateString(value: string): boolean {
  return VALID_DATE_PATTERNS.some((pattern) => pattern.test(value));
}

export function normalizeDate(value: unknown, fallback = dayjs().format(DATE_FORMAT)) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const raw = String(value).trim();
  if (!raw) {
    return fallback;
  }

  const normalized = raw.replace(/\./g, '-').replace(/\//g, '-');

  if (!isValidDateString(normalized)) {
    const parsed = dayjs(raw);
    if (!parsed.isValid()) {
      return fallback;
    }
    const year = parsed.year();
    if (year < 2000 || year > 2100) {
      return fallback;
    }
    return parsed.format(DATE_FORMAT);
  }

  const parsed = dayjs(normalized);
  if (!parsed.isValid()) {
    return fallback;
  }

  const year = parsed.year();
  if (year < 2000 || year > 2100) {
    return fallback;
  }

  return parsed.format(DATE_FORMAT);
}

export function normalizeMonth(value: unknown, fallback = dayjs().format(MONTH_FORMAT)) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const raw = String(value).trim();
  if (!raw) {
    return fallback;
  }

  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [year, month] = raw.split('-').map(Number);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return raw;
    }
    return fallback;
  }

  const parsed = dayjs(raw);
  if (!parsed.isValid()) {
    return fallback;
  }

  const year = parsed.year();
  if (year < 2000 || year > 2100) {
    return fallback;
  }

  return parsed.format(MONTH_FORMAT);
}

export function isValidDate(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  const raw = String(value).trim();
  if (!raw) {
    return false;
  }

  const normalized = raw.replace(/\./g, '-').replace(/\//g, '-');
  if (!isValidDateString(normalized)) {
    return false;
  }

  const parsed = dayjs(normalized);
  if (!parsed.isValid()) {
    return false;
  }

  const year = parsed.year();
  return year >= 2000 && year <= 2100;
}

export function nowIsoString() {
  return dayjs().toISOString();
}
