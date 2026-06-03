"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONTH_FORMAT = exports.DATE_FORMAT = void 0;
exports.normalizeDate = normalizeDate;
exports.normalizeMonth = normalizeMonth;
exports.nowIsoString = nowIsoString;
const dayjs_1 = __importDefault(require("dayjs"));
exports.DATE_FORMAT = 'YYYY-MM-DD';
exports.MONTH_FORMAT = 'YYYY-MM';
function normalizeDate(value, fallback = (0, dayjs_1.default)().format(exports.DATE_FORMAT)) {
    const raw = String(value ?? '').trim();
    if (!raw) {
        return fallback;
    }
    const normalized = raw.replace(/\./g, '-').replace(/\//g, '-');
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
    const raw = String(value ?? '').trim();
    if (!raw) {
        return fallback;
    }
    if (/^\d{4}-\d{2}$/.test(raw)) {
        return raw;
    }
    const parsed = (0, dayjs_1.default)(raw);
    return parsed.isValid() ? parsed.format(exports.MONTH_FORMAT) : fallback;
}
function nowIsoString() {
    return (0, dayjs_1.default)().toISOString();
}
