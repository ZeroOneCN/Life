"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMoney = toMoney;
exports.toInteger = toInteger;
function toMoney(value, fallback = 0) {
    const raw = String(value ?? '').replace(/[^\d.-]/g, '');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}
function toInteger(value, fallback = 0, min = 0, max = Number.POSITIVE_INFINITY) {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, parsed));
}
