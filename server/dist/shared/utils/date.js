"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATETIME_FORMAT = exports.MONTH_FORMAT = exports.DATE_FORMAT = void 0;
exports.normalizeDate = normalizeDate;
exports.normalizeMonth = normalizeMonth;
exports.isValidDate = isValidDate;
exports.nowIsoString = nowIsoString;
const dayjs_1 = __importDefault(require("dayjs"));
exports.DATE_FORMAT = 'YYYY-MM-DD';
exports.MONTH_FORMAT = 'YYYY-MM';
exports.DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const VALID_DATE_PATTERNS = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{4}\/\d{2}\/\d{2}$/,
    /^\d{4}\.\d{2}\.\d{2}$/,
];
function isValidDateString(value) {
    return VALID_DATE_PATTERNS.some((pattern) => pattern.test(value));
}
function normalizeDate(value, fallback = (0, dayjs_1.default)().format(exports.DATE_FORMAT)) {
    if (value === null || value === undefined) {
        return fallback;
    }
    const raw = String(value).trim();
    if (!raw) {
        return fallback;
    }
    const normalized = raw.replace(/\./g, '-').replace(/\//g, '-');
    if (!isValidDateString(normalized)) {
        const parsed = (0, dayjs_1.default)(raw);
        if (!parsed.isValid()) {
            return fallback;
        }
        const year = parsed.year();
        if (year < 2000 || year > 2100) {
            return fallback;
        }
        return parsed.format(exports.DATE_FORMAT);
    }
    const parsed = (0, dayjs_1.default)(normalized);
    if (!parsed.isValid()) {
        return fallback;
    }
    const year = parsed.year();
    if (year < 2000 || year > 2100) {
        return fallback;
    }
    return parsed.format(exports.DATE_FORMAT);
}
function normalizeMonth(value, fallback = (0, dayjs_1.default)().format(exports.MONTH_FORMAT)) {
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
    const parsed = (0, dayjs_1.default)(raw);
    if (!parsed.isValid()) {
        return fallback;
    }
    const year = parsed.year();
    if (year < 2000 || year > 2100) {
        return fallback;
    }
    return parsed.format(exports.MONTH_FORMAT);
}
function isValidDate(value) {
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
    const parsed = (0, dayjs_1.default)(normalized);
    if (!parsed.isValid()) {
        return false;
    }
    const year = parsed.year();
    return year >= 2000 && year <= 2100;
}
function nowIsoString() {
    return (0, dayjs_1.default)().toISOString();
}
