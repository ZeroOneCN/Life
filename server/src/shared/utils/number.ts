export function toMoney(value: unknown, fallback = 0) {
  const raw = String(value ?? '').replace(/[^\d.-]/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

export function toInteger(value: unknown, fallback = 0, min = 0, max = Number.POSITIVE_INFINITY) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}
