"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTravelRouter = createTravelRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const data_source_1 = require("../../db/data-source");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const pagination_1 = require("../../shared/utils/pagination");
const date_1 = require("../../shared/utils/date");
const app_error_1 = require("../../shared/errors/app-error");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const finance_travel_book_entity_1 = require("./entities/finance-travel-book.entity");
const finance_travel_expense_record_entity_1 = require("./entities/finance-travel-expense-record.entity");
const finance_travel_import_batch_entity_1 = require("./entities/finance-travel-import-batch.entity");
const finance_travel_pay_channel_entity_1 = require("./entities/finance-travel-pay-channel.entity");
const finance_travel_setting_entity_1 = require("./entities/finance-travel-setting.entity");
const bookSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    name: zod_1.z.string().trim().min(1).max(128),
    description: zod_1.z.string().optional().default(''),
    startDate: zod_1.z.string().min(1),
    endDate: zod_1.z.string().optional().default(''),
    summary: zod_1.z.string().optional().default(''),
});
const recordSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    bookId: zod_1.z.string().trim().min(1),
    date: zod_1.z.string().min(1),
    timeStart: zod_1.z.string().trim().min(1),
    timeEnd: zod_1.z.string().trim().min(1),
    category: zod_1.z.string().trim().min(1).max(32),
    title: zod_1.z.string().trim().min(1).max(255),
    amount: zod_1.z.number().min(0),
    discountAmount: zod_1.z.number().min(0).optional().default(0),
    discountNote: zod_1.z.string().optional().default(''),
    vehicleInfo: zod_1.z.string().optional().default(''),
    payChannel: zod_1.z.string().trim().min(1).max(64),
    remark: zod_1.z.string().optional().default(''),
});
const payChannelSchema = zod_1.z.object({
    value: zod_1.z.string().trim().min(1).max(64),
    label: zod_1.z.string().trim().min(1).max(128),
});
const settingsSchema = zod_1.z.object({
    activeUserId: zod_1.z.string().optional(),
    activeBookId: zod_1.z.string().optional(),
    detailsBookId: zod_1.z.string().optional(),
    statsBookId: zod_1.z.string().optional(),
    reportBookId: zod_1.z.string().optional(),
    leaderboardUserId: zod_1.z.string().optional(),
    reportColumns: zod_1.z.array(zod_1.z.string()).optional(),
});
const importRowSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    bookId: zod_1.z.string().trim().optional(),
    date: zod_1.z.string().optional(),
    timeStart: zod_1.z.string().optional(),
    timeEnd: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    title: zod_1.z.string().optional(),
    amount: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    discountAmount: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    discountNote: zod_1.z.string().optional(),
    vehicleInfo: zod_1.z.string().optional(),
    payChannel: zod_1.z.string().optional(),
    remark: zod_1.z.string().optional(),
});
const importSchema = zod_1.z.object({
    fileName: zod_1.z.string().trim().optional().default('travel-import.json'),
    rows: zod_1.z.array(importRowSchema).default([]),
});
const exportSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    bookId: zod_1.z.string().trim().min(1),
    format: zod_1.z.enum(['json', 'html']).optional().default('json'),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(finance_travel_setting_entity_1.FinanceTravelSettingEntity);
function toMoney(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}
function normalizeTime(value, fallback = '00:00') {
    const raw = String(value ?? '').trim();
    const matched = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (!matched) {
        return fallback;
    }
    return `${String(Number(matched[1])).padStart(2, '0')}:${matched[2]}`;
}
function calculateDurationMinutes(timeStart, timeEnd) {
    const start = (0, dayjs_1.default)(`2020-01-01T${normalizeTime(timeStart)}`);
    let end = (0, dayjs_1.default)(`2020-01-01T${normalizeTime(timeEnd)}`);
    if (end.isBefore(start)) {
        end = end.add(1, 'day');
    }
    return Math.max(0, end.diff(start, 'minute'));
}
function mapBook(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        name: entity.name,
        description: entity.description,
        startDate: entity.start_date,
        endDate: entity.end_date ?? '',
        summary: entity.summary,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapRecord(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        bookId: entity.book_id,
        date: entity.date,
        timeStart: entity.time_start,
        timeEnd: entity.time_end,
        durationMinutes: entity.duration_minutes,
        category: entity.category,
        title: entity.title,
        amount: Number(entity.amount),
        discountAmount: Number(entity.discount_amount),
        discountNote: entity.discount_note,
        vehicleInfo: entity.vehicle_info,
        payChannel: entity.pay_channel,
        remark: entity.remark,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapPayChannel(entity) {
    return {
        id: entity.id,
        value: entity.value,
        label: entity.label,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function buildRecordKey(item) {
    return [
        item.userId.trim().toLowerCase(),
        item.bookId.trim().toLowerCase(),
        item.date,
        item.timeStart,
        item.timeEnd,
        item.title.trim().toLowerCase(),
        item.amount.toFixed(2),
    ].join('|');
}
function buildSummary(records) {
    const totalAmount = records.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalSaved = records.reduce((sum, item) => sum + Number(item.discount_amount), 0);
    const paidAmount = totalAmount - totalSaved;
    const categoryBreakdown = new Map();
    const channelBreakdown = new Map();
    records.forEach((item) => {
        const category = categoryBreakdown.get(item.category) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
        category.totalAmount += Number(item.amount);
        category.savedAmount += Number(item.discount_amount);
        category.count += 1;
        categoryBreakdown.set(item.category, category);
        const channel = channelBreakdown.get(item.pay_channel) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
        channel.totalAmount += Number(item.amount);
        channel.savedAmount += Number(item.discount_amount);
        channel.count += 1;
        channelBreakdown.set(item.pay_channel, channel);
    });
    return {
        totalCount: records.length,
        totalAmount: Number(totalAmount.toFixed(2)),
        totalSaved: Number(totalSaved.toFixed(2)),
        totalPaidAmount: Number(paidAmount.toFixed(2)),
        topCategoryName: Array.from(categoryBreakdown.entries()).sort((a, b) => b[1].totalAmount - a[1].totalAmount)[0]?.[0] ?? '暂无',
        topPayChannelName: Array.from(channelBreakdown.entries()).sort((a, b) => b[1].totalAmount - a[1].totalAmount)[0]?.[0] ?? '暂无',
    };
}
function createTravelRouter() {
    const router = (0, express_1.Router)();
    router.get('/books', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const repository = data_source_1.appDataSource.getRepository(finance_travel_book_entity_1.FinanceTravelBookEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { updated_at: 'DESC' },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapBook))));
    }));
    router.post('/books', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(bookSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_travel_book_entity_1.FinanceTravelBookEntity);
        const item = await repository.save(repository.create({
            user_id: payload.userId ?? authUserId,
            name: payload.name,
            description: payload.description,
            start_date: (0, date_1.normalizeDate)(payload.startDate),
            end_date: payload.endDate ? (0, date_1.normalizeDate)(payload.endDate) : null,
            summary: payload.summary,
        }));
        response.json((0, response_1.successResponse)(mapBook(item), 'create_travel_book_success'));
    }));
    router.patch('/books/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const bookId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(bookSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_travel_book_entity_1.FinanceTravelBookEntity);
        const current = await repository.findOne({
            where: { id: bookId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('travel_book_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            name: payload.name ?? current.name,
            description: payload.description ?? current.description,
            start_date: payload.startDate ? (0, date_1.normalizeDate)(payload.startDate) : current.start_date,
            end_date: payload.endDate !== undefined ? (payload.endDate ? (0, date_1.normalizeDate)(payload.endDate) : null) : current.end_date,
            summary: payload.summary ?? current.summary,
        });
        response.json((0, response_1.successResponse)(mapBook(next), 'update_travel_book_success'));
    }));
    router.delete('/books/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const bookId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_travel_book_entity_1.FinanceTravelBookEntity);
        const current = await repository.findOne({
            where: { id: bookId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('travel_book_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_travel_book_success'));
    }));
    router.get('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const bookId = String(request.query.bookId ?? 'all');
        const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { date: 'DESC', updated_at: 'DESC' },
        });
        const filtered = items
            .filter((item) => bookId === 'all' || item.book_id === bookId)
            .filter((item) => !keyword || [item.title, item.category, item.pay_channel, item.remark, item.vehicle_info].some((value) => value.toLowerCase().includes(keyword)));
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, filtered.length)));
    }));
    router.post('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(recordSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity);
        const item = await repository.save(repository.create({
            user_id: payload.userId ?? authUserId,
            book_id: payload.bookId,
            date: (0, date_1.normalizeDate)(payload.date),
            time_start: normalizeTime(payload.timeStart),
            time_end: normalizeTime(payload.timeEnd),
            duration_minutes: calculateDurationMinutes(payload.timeStart, payload.timeEnd),
            category: payload.category,
            title: payload.title,
            amount: payload.amount,
            discount_amount: payload.discountAmount,
            discount_note: payload.discountNote,
            vehicle_info: payload.vehicleInfo,
            pay_channel: payload.payChannel,
            remark: payload.remark,
        }));
        response.json((0, response_1.successResponse)(mapRecord(item), 'create_travel_record_success'));
    }));
    router.patch('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(recordSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity);
        const current = await repository.findOne({
            where: { id: recordId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('travel_record_not_found', 404, 404);
        }
        const nextTimeStart = payload.timeStart ? normalizeTime(payload.timeStart) : current.time_start;
        const nextTimeEnd = payload.timeEnd ? normalizeTime(payload.timeEnd) : current.time_end;
        const next = await repository.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            book_id: payload.bookId ?? current.book_id,
            date: payload.date ? (0, date_1.normalizeDate)(payload.date) : current.date,
            time_start: nextTimeStart,
            time_end: nextTimeEnd,
            duration_minutes: calculateDurationMinutes(nextTimeStart, nextTimeEnd),
            category: payload.category ?? current.category,
            title: payload.title ?? current.title,
            amount: payload.amount ?? current.amount,
            discount_amount: payload.discountAmount ?? current.discount_amount,
            discount_note: payload.discountNote ?? current.discount_note,
            vehicle_info: payload.vehicleInfo ?? current.vehicle_info,
            pay_channel: payload.payChannel ?? current.pay_channel,
            remark: payload.remark ?? current.remark,
        });
        response.json((0, response_1.successResponse)(mapRecord(next), 'update_travel_record_success'));
    }));
    router.delete('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity);
        const current = await repository.findOne({
            where: { id: recordId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('travel_record_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_travel_record_success'));
    }));
    router.get('/pay-channels', (0, async_handler_1.asyncHandler)(async (_request, response) => {
        const repository = data_source_1.appDataSource.getRepository(finance_travel_pay_channel_entity_1.FinanceTravelPayChannelEntity);
        const items = await repository.find({
            order: { label: 'ASC' },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapPayChannel))));
    }));
    router.post('/pay-channels', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const payload = (0, validation_1.validateBody)(payChannelSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_travel_pay_channel_entity_1.FinanceTravelPayChannelEntity);
        const item = await repository.save(repository.create({
            value: payload.value.toUpperCase(),
            label: payload.label,
        }));
        response.json((0, response_1.successResponse)(mapPayChannel(item), 'create_travel_pay_channel_success'));
    }));
    router.patch('/pay-channels/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const channelId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(payChannelSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_travel_pay_channel_entity_1.FinanceTravelPayChannelEntity);
        const current = await repository.findOne({ where: { id: channelId } });
        if (!current) {
            throw new app_error_1.AppError('travel_pay_channel_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            value: payload.value ? payload.value.toUpperCase() : current.value,
            label: payload.label ?? current.label,
        });
        response.json((0, response_1.successResponse)(mapPayChannel(next), 'update_travel_pay_channel_success'));
    }));
    router.delete('/pay-channels/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const channelId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_travel_pay_channel_entity_1.FinanceTravelPayChannelEntity);
        const current = await repository.findOne({ where: { id: channelId } });
        if (!current) {
            throw new app_error_1.AppError('travel_pay_channel_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_travel_pay_channel_success'));
    }));
    router.get('/summary', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const bookId = String(request.query.bookId ?? 'all');
        const repository = data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity);
        const records = (await repository.find({ where: { user_id: userId } }))
            .filter((item) => bookId === 'all' || item.book_id === bookId);
        response.json((0, response_1.successResponse)(buildSummary(records)));
    }));
    router.get('/daily-trend', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const bookId = String(request.query.bookId ?? 'all');
        const repository = data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity);
        const records = (await repository.find({ where: { user_id: userId } }))
            .filter((item) => bookId === 'all' || item.book_id === bookId);
        const grouped = new Map();
        records.forEach((item) => {
            const current = grouped.get(item.date) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
            current.totalAmount += Number(item.amount);
            current.savedAmount += Number(item.discount_amount);
            current.count += 1;
            grouped.set(item.date, current);
        });
        const items = Array.from(grouped.entries())
            .map(([date, value]) => ({
            date,
            label: (0, dayjs_1.default)(date).format('MM-DD'),
            totalAmount: Number(value.totalAmount.toFixed(2)),
            savedAmount: Number(value.savedAmount.toFixed(2)),
            paidAmount: Number((value.totalAmount - value.savedAmount).toFixed(2)),
            count: value.count,
        }))
            .sort((left, right) => (0, dayjs_1.default)(left.date).valueOf() - (0, dayjs_1.default)(right.date).valueOf());
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/category-breakdown', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const bookId = String(request.query.bookId ?? 'all');
        const repository = data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity);
        const records = (await repository.find({ where: { user_id: userId } }))
            .filter((item) => bookId === 'all' || item.book_id === bookId);
        const grouped = new Map();
        records.forEach((item) => {
            const current = grouped.get(item.category) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
            current.totalAmount += Number(item.amount);
            current.savedAmount += Number(item.discount_amount);
            current.count += 1;
            grouped.set(item.category, current);
        });
        const items = Array.from(grouped.entries())
            .map(([name, value]) => ({
            name,
            count: value.count,
            totalAmount: Number(value.totalAmount.toFixed(2)),
            savedAmount: Number(value.savedAmount.toFixed(2)),
            paidAmount: Number((value.totalAmount - value.savedAmount).toFixed(2)),
        }))
            .sort((left, right) => right.paidAmount - left.paidAmount);
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/pay-channel-breakdown', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const bookId = String(request.query.bookId ?? 'all');
        const repository = data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity);
        const records = (await repository.find({ where: { user_id: userId } }))
            .filter((item) => bookId === 'all' || item.book_id === bookId);
        const grouped = new Map();
        records.forEach((item) => {
            const current = grouped.get(item.pay_channel) ?? { totalAmount: 0, savedAmount: 0, count: 0 };
            current.totalAmount += Number(item.amount);
            current.savedAmount += Number(item.discount_amount);
            current.count += 1;
            grouped.set(item.pay_channel, current);
        });
        const items = Array.from(grouped.entries())
            .map(([name, value]) => ({
            name,
            count: value.count,
            totalAmount: Number(value.totalAmount.toFixed(2)),
            savedAmount: Number(value.savedAmount.toFixed(2)),
            paidAmount: Number((value.totalAmount - value.savedAmount).toFixed(2)),
        }))
            .sort((left, right) => right.paidAmount - left.paidAmount);
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/leaderboard', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const [books, records] = await Promise.all([
            data_source_1.appDataSource.getRepository(finance_travel_book_entity_1.FinanceTravelBookEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity).find({ where: { user_id: userId } }),
        ]);
        const items = books.map((book) => {
            const scoped = records.filter((item) => item.book_id === book.id);
            const totalAmount = scoped.reduce((sum, item) => sum + Number(item.amount), 0);
            const totalSaved = scoped.reduce((sum, item) => sum + Number(item.discount_amount), 0);
            return {
                bookId: book.id,
                bookName: book.name,
                totalCount: scoped.length,
                totalAmount: Number(totalAmount.toFixed(2)),
                totalSaved: Number(totalSaved.toFixed(2)),
                totalPaidAmount: Number((totalAmount - totalSaved).toFixed(2)),
                updatedAt: book.updated_at.toISOString(),
            };
        }).sort((left, right) => right.totalPaidAmount - left.totalPaidAmount);
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/report', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const bookId = String(request.query.bookId ?? '');
        const [book, records] = await Promise.all([
            data_source_1.appDataSource.getRepository(finance_travel_book_entity_1.FinanceTravelBookEntity).findOne({ where: { id: bookId, user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity).find({ where: { user_id: userId, book_id: bookId } }),
        ]);
        response.json((0, response_1.successResponse)({
            book: book ? mapBook(book) : null,
            summary: buildSummary(records),
            records: records.map(mapRecord),
            generatedAt: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm'),
        }));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            active_user_id: userId,
            active_book_id: null,
            details_book_id: null,
            stats_book_id: null,
            report_book_id: null,
            leaderboard_user_id: userId,
            report_columns_json: null,
        });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            activeBookId: settings.active_book_id ?? '',
            detailsBookId: settings.details_book_id ?? '',
            statsBookId: settings.stats_book_id ?? '',
            reportBookId: settings.report_book_id ?? '',
            leaderboardUserId: settings.leaderboard_user_id ?? userId,
            reportColumns: settings.report_columns_json ?? [],
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            active_user_id: payload.activeUserId,
            active_book_id: payload.activeBookId,
            details_book_id: payload.detailsBookId,
            stats_book_id: payload.statsBookId,
            report_book_id: payload.reportBookId,
            leaderboard_user_id: payload.leaderboardUserId,
            report_columns_json: payload.reportColumns,
        }, {
            active_user_id: userId,
            active_book_id: null,
            details_book_id: null,
            stats_book_id: null,
            report_book_id: null,
            leaderboard_user_id: userId,
            report_columns_json: null,
        });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            activeBookId: settings.active_book_id ?? '',
            detailsBookId: settings.details_book_id ?? '',
            statsBookId: settings.stats_book_id ?? '',
            reportBookId: settings.report_book_id ?? '',
            leaderboardUserId: settings.leaderboard_user_id ?? userId,
            reportColumns: settings.report_columns_json ?? [],
        }, 'update_travel_settings_success'));
    }));
    router.post('/actions/import', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(importSchema, request.body);
        const rows = payload.rows ?? [];
        const recordRepo = data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity);
        const batchRepo = data_source_1.appDataSource.getRepository(finance_travel_import_batch_entity_1.FinanceTravelImportBatchEntity);
        const existing = await recordRepo.find({ where: { user_id: authUserId } });
        const seen = new Set(existing.map((item) => buildRecordKey({
            userId: item.user_id,
            bookId: item.book_id,
            date: item.date,
            timeStart: item.time_start,
            timeEnd: item.time_end,
            title: item.title,
            amount: Number(item.amount),
        })));
        let importedCount = 0;
        let duplicateCount = 0;
        let invalidCount = 0;
        const toSave = [];
        rows.forEach((row) => {
            const userId = row.userId ?? authUserId;
            const bookId = row.bookId ?? '';
            const date = row.date ? (0, date_1.normalizeDate)(row.date) : '';
            const title = row.title?.trim() ?? '';
            const category = row.category?.trim() ?? '';
            const payChannel = row.payChannel?.trim() ?? '';
            const amount = toMoney(row.amount, NaN);
            const timeStart = normalizeTime(row.timeStart, '');
            const timeEnd = normalizeTime(row.timeEnd, '');
            if (!bookId || !date || !title || !category || !payChannel || !timeStart || !timeEnd || !Number.isFinite(amount) || amount <= 0) {
                invalidCount += 1;
                return;
            }
            const key = buildRecordKey({
                userId,
                bookId,
                date,
                timeStart,
                timeEnd,
                title,
                amount,
            });
            if (seen.has(key)) {
                duplicateCount += 1;
                return;
            }
            seen.add(key);
            importedCount += 1;
            toSave.push(recordRepo.create({
                user_id: userId,
                book_id: bookId,
                date,
                time_start: timeStart,
                time_end: timeEnd,
                duration_minutes: calculateDurationMinutes(timeStart, timeEnd),
                category,
                title,
                amount,
                discount_amount: toMoney(row.discountAmount, 0),
                discount_note: row.discountNote ?? '',
                vehicle_info: row.vehicleInfo ?? '',
                pay_channel: payChannel,
                remark: row.remark ?? '',
            }));
        });
        if (toSave.length) {
            await recordRepo.save(toSave);
        }
        await batchRepo.save(batchRepo.create({
            user_id: authUserId,
            file_name: payload.fileName,
            total_rows: rows.length,
            imported_count: importedCount,
            duplicate_count: duplicateCount,
            invalid_count: invalidCount,
            summary_json: {
                importedCount,
                duplicateCount,
                invalidCount,
            },
        }));
        response.json((0, response_1.successResponse)({
            total_rows: rows.length,
            imported_count: importedCount,
            duplicate_count: duplicateCount,
            invalid_count: invalidCount,
        }, 'import_travel_records_success'));
    }));
    router.post('/actions/export-report', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(exportSchema, request.body);
        const userId = payload.userId ?? authUserId;
        const [book, records] = await Promise.all([
            data_source_1.appDataSource.getRepository(finance_travel_book_entity_1.FinanceTravelBookEntity).findOne({ where: { id: payload.bookId, user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_travel_expense_record_entity_1.FinanceTravelExpenseRecordEntity).find({ where: { user_id: userId, book_id: payload.bookId } }),
        ]);
        const report = {
            book: book ? mapBook(book) : null,
            summary: buildSummary(records),
            records: records.map(mapRecord),
            generatedAt: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm'),
        };
        if (payload.format === 'html') {
            const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8" /><title>旅行报告</title></head><body><h1>${book?.name ?? '旅行报告'}</h1><pre>${JSON.stringify(report, null, 2)}</pre></body></html>`;
            response.json((0, response_1.successResponse)({
                format: 'html',
                fileName: `${book?.name ?? 'travel-report'}.html`,
                content: html,
            }, 'export_travel_report_success'));
            return;
        }
        response.json((0, response_1.successResponse)({
            format: 'json',
            fileName: `${book?.name ?? 'travel-report'}.json`,
            content: report,
        }, 'export_travel_report_success'));
    }));
    return router;
}
