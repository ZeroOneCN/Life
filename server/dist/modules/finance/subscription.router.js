"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubscriptionRouter = createSubscriptionRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const data_source_1 = require("../../db/data-source");
const finance_subscription_record_entity_1 = require("./entities/finance-subscription-record.entity");
const finance_subscription_category_entity_1 = require("./entities/finance-subscription-category.entity");
const finance_subscription_setting_entity_1 = require("./entities/finance-subscription-setting.entity");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const pagination_1 = require("../../shared/utils/pagination");
const date_1 = require("../../shared/utils/date");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const app_error_1 = require("../../shared/errors/app-error");
const notification_1 = require("../../shared/domain/notification");
const recordSchema = zod_1.z.object({
    serviceName: zod_1.z.string().trim().min(1).max(255),
    planName: zod_1.z.string().trim().optional().default(''),
    categoryId: zod_1.z.string().trim().min(1),
    categoryName: zod_1.z.string().trim().optional().default(''),
    startDate: zod_1.z.string().min(1),
    endDate: zod_1.z.string().min(1),
    billingCycle: zod_1.z.enum(['monthly', 'quarterly', 'yearly', 'one_time']),
    cyclePrice: zod_1.z.number().min(0),
    autoRenew: zod_1.z.boolean().optional().default(false),
    notes: zod_1.z.string().optional().default(''),
});
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(128),
    description: zod_1.z.string().optional().default(''),
});
const settingsSchema = zod_1.z.object({
    recordsKeyword: zod_1.z.string().optional().default(''),
    recordsCategoryId: zod_1.z.string().optional().default('all'),
    recordsStatus: zod_1.z.enum(['all', 'active', 'upcoming', 'expired']).optional().default('all'),
    recordsAutoRenewFilter: zod_1.z.enum(['all', 'auto', 'manual']).optional().default('all'),
    recordsExpiryStartDate: zod_1.z.string().optional(),
    recordsExpiryEndDate: zod_1.z.string().optional(),
    dashboardRangeDays: zod_1.z.union([zod_1.z.literal(90), zod_1.z.literal(180), zod_1.z.literal(365)]).optional().default(90),
    reminderEnabled: zod_1.z.boolean().optional().default(true),
    expiryDayReminderEnabled: zod_1.z.boolean().optional().default(true),
    leadDays: zod_1.z.number().int().min(0).max(90).optional().default(7),
    includeAutoRenewInReminders: zod_1.z.boolean().optional().default(false),
});
const triggerReminderSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255).optional(),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(finance_subscription_setting_entity_1.FinanceSubscriptionSettingEntity);
function getStatus(record, leadDays) {
    const end = (0, dayjs_1.default)(record.end_date).startOf('day');
    const today = (0, dayjs_1.default)().startOf('day');
    if (today.isAfter(end)) {
        return 'expired';
    }
    const diff = end.diff(today, 'day');
    return diff <= leadDays ? 'upcoming' : 'active';
}
function toMonthly(record) {
    const amount = Number(record.cycle_price);
    if (record.billing_cycle === 'quarterly') {
        return Number((amount / 3).toFixed(2));
    }
    if (record.billing_cycle === 'yearly') {
        return Number((amount / 12).toFixed(2));
    }
    if (record.billing_cycle === 'one_time') {
        const days = Math.max(1, (0, dayjs_1.default)(record.end_date).diff((0, dayjs_1.default)(record.start_date), 'day') + 1);
        return Number((amount / Math.max(1, days / 30)).toFixed(2));
    }
    return Number(amount.toFixed(2));
}
function toAnnual(record) {
    return Number((toMonthly(record) * 12).toFixed(2));
}
function mapRecord(entity) {
    return {
        id: entity.id,
        serviceName: entity.service_name,
        planName: entity.plan_name,
        categoryId: entity.category_id,
        categoryName: entity.category_name,
        startDate: entity.start_date,
        endDate: entity.end_date,
        billingCycle: entity.billing_cycle,
        cyclePrice: Number(entity.cycle_price),
        autoRenew: entity.auto_renew,
        notes: entity.notes,
        lastUpcomingReminderMarker: entity.last_upcoming_reminder_marker ?? '',
        lastExpiredReminderMarker: entity.last_expired_reminder_marker ?? '',
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapCategory(entity) {
    return {
        id: entity.id,
        name: entity.name,
        description: entity.description,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function buildOverview(records, leadDays) {
    return records.reduce((summary, record) => {
        const status = getStatus(record, leadDays);
        summary.totalCount += 1;
        summary.monthlyEstimate += toMonthly(record);
        summary.annualEstimate += toAnnual(record);
        if (record.auto_renew) {
            summary.autoRenewCount += 1;
        }
        if (status === 'active') {
            summary.activeCount += 1;
        }
        else if (status === 'upcoming') {
            summary.upcomingCount += 1;
        }
        else {
            summary.expiredCount += 1;
        }
        if (!summary.nearestExpiryDate || (0, dayjs_1.default)(record.end_date).isBefore((0, dayjs_1.default)(summary.nearestExpiryDate), 'day')) {
            summary.nearestExpiryDate = record.end_date;
        }
        return summary;
    }, {
        totalCount: 0,
        activeCount: 0,
        upcomingCount: 0,
        expiredCount: 0,
        autoRenewCount: 0,
        monthlyEstimate: 0,
        annualEstimate: 0,
        nearestExpiryDate: '',
    });
}
async function triggerSubscriptionReminderLogs(userId, records, settings) {
    const today = (0, dayjs_1.default)().startOf('day');
    const repository = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
    const logs = [];
    for (const record of records) {
        const end = (0, dayjs_1.default)(record.end_date).startOf('day');
        const diff = end.diff(today, 'day');
        const base = `${record.id}:${record.end_date}`;
        if (settings.reminder_enabled
            && diff >= 0
            && diff <= settings.lead_days
            && (settings.include_auto_renew_in_reminders || !record.auto_renew)) {
            const marker = `${base}:upcoming:${today.format('YYYY-MM-DD')}`;
            if (record.last_upcoming_reminder_marker !== marker) {
                logs.push(...(await (0, notification_1.sendNotificationSceneLogs)({
                    userId,
                    sceneId: 'subscription.renewal_upcoming',
                    title: '服务订阅即将到期',
                    message: `${record.service_name} 将在 ${record.end_date} 到期，距离到期还有 ${diff} 天。`,
                })));
                record.last_upcoming_reminder_marker = marker;
            }
        }
        if (settings.expiry_day_reminder_enabled && diff <= 0) {
            const marker = `${base}:expired:${today.format('YYYY-MM-DD')}`;
            if (record.last_expired_reminder_marker !== marker) {
                logs.push(...(await (0, notification_1.sendNotificationSceneLogs)({
                    userId,
                    sceneId: 'subscription.expired',
                    title: '服务订阅已到期',
                    message: diff === 0
                        ? `${record.service_name} 今天到期，请及时确认续费或停用。`
                        : `${record.service_name} 已于 ${record.end_date} 到期，当前已逾期 ${Math.abs(diff)} 天。`,
                })));
                record.last_expired_reminder_marker = marker;
            }
        }
    }
    if (records.length) {
        await repository.save(records);
    }
    return logs;
}
function createSubscriptionRouter() {
    const router = (0, express_1.Router)();
    router.get('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
        const categoryId = String(request.query.categoryId ?? 'all');
        const status = String(request.query.status ?? 'all');
        const autoRenewFilter = String(request.query.autoRenew ?? 'all');
        const expiryStartDate = String(request.query.expiryStartDate ?? '').trim();
        const expiryEndDate = String(request.query.expiryEndDate ?? '').trim();
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
        const settings = await settingService.getOrCreate(userId, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        const items = await repository.find({
            where: { user_id: userId },
            order: { end_date: 'ASC', updated_at: 'DESC' },
        });
        const filtered = items
            .filter((item) => !keyword || [item.service_name, item.plan_name, item.category_name, item.notes].some((value) => value.toLowerCase().includes(keyword)))
            .filter((item) => categoryId === 'all' || item.category_id === categoryId)
            .filter((item) => status === 'all' || getStatus(item, settings.lead_days) === status)
            .filter((item) => autoRenewFilter === 'all' || (autoRenewFilter === 'auto' ? item.auto_renew : !item.auto_renew))
            .filter((item) => !expiryStartDate || !(0, dayjs_1.default)(item.end_date).isBefore(expiryStartDate, 'day'))
            .filter((item) => !expiryEndDate || !(0, dayjs_1.default)(item.end_date).isAfter(expiryEndDate, 'day'));
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, filtered.length)));
    }));
    router.post('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(recordSchema, request.body);
        const categoryRepo = data_source_1.appDataSource.getRepository(finance_subscription_category_entity_1.FinanceSubscriptionCategoryEntity);
        const recordRepo = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
        const category = await categoryRepo.findOne({
            where: { id: payload.categoryId, user_id: userId },
        });
        const item = await recordRepo.save(recordRepo.create({
            user_id: userId,
            service_name: payload.serviceName,
            plan_name: payload.planName,
            category_id: payload.categoryId,
            category_name: payload.categoryName || category?.name || '',
            start_date: (0, date_1.normalizeDate)(payload.startDate),
            end_date: (0, date_1.normalizeDate)(payload.endDate),
            billing_cycle: payload.billingCycle,
            cycle_price: payload.cyclePrice,
            auto_renew: payload.autoRenew,
            notes: payload.notes,
            last_upcoming_reminder_marker: null,
            last_expired_reminder_marker: null,
        }));
        const settings = await settingService.getOrCreate(userId, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        await triggerSubscriptionReminderLogs(userId, [item], settings);
        response.json((0, response_1.successResponse)(mapRecord(item), 'create_subscription_record_success'));
    }));
    router.patch('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(recordSchema.partial(), request.body);
        const recordRepo = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
        const categoryRepo = data_source_1.appDataSource.getRepository(finance_subscription_category_entity_1.FinanceSubscriptionCategoryEntity);
        const current = await recordRepo.findOne({
            where: { id: recordId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('subscription_record_not_found', 404, 404);
        }
        const category = payload.categoryId
            ? await categoryRepo.findOne({ where: { id: payload.categoryId, user_id: userId } })
            : null;
        const next = await recordRepo.save({
            ...current,
            service_name: payload.serviceName ?? current.service_name,
            plan_name: payload.planName ?? current.plan_name,
            category_id: payload.categoryId ?? current.category_id,
            category_name: payload.categoryName ?? category?.name ?? current.category_name,
            start_date: payload.startDate ? (0, date_1.normalizeDate)(payload.startDate) : current.start_date,
            end_date: payload.endDate ? (0, date_1.normalizeDate)(payload.endDate) : current.end_date,
            billing_cycle: payload.billingCycle ?? current.billing_cycle,
            cycle_price: payload.cyclePrice ?? current.cycle_price,
            auto_renew: payload.autoRenew ?? current.auto_renew,
            notes: payload.notes ?? current.notes,
        });
        const settings = await settingService.getOrCreate(userId, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        await triggerSubscriptionReminderLogs(userId, [next], settings);
        response.json((0, response_1.successResponse)(mapRecord(next), 'update_subscription_record_success'));
    }));
    router.delete('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
        const current = await repository.findOne({
            where: { id: recordId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('subscription_record_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_subscription_record_success'));
    }));
    router.get('/categories', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_category_entity_1.FinanceSubscriptionCategoryEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { name: 'ASC' },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapCategory))));
    }));
    router.post('/categories', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(categorySchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_category_entity_1.FinanceSubscriptionCategoryEntity);
        const item = await repository.save(repository.create({
            user_id: userId,
            name: payload.name,
            description: payload.description,
        }));
        response.json((0, response_1.successResponse)(mapCategory(item), 'create_subscription_category_success'));
    }));
    router.patch('/categories/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const categoryId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(categorySchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_category_entity_1.FinanceSubscriptionCategoryEntity);
        const current = await repository.findOne({
            where: { id: categoryId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('subscription_category_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            name: payload.name ?? current.name,
            description: payload.description ?? current.description,
        });
        response.json((0, response_1.successResponse)(mapCategory(next), 'update_subscription_category_success'));
    }));
    router.delete('/categories/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const categoryId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_category_entity_1.FinanceSubscriptionCategoryEntity);
        const current = await repository.findOne({
            where: { id: categoryId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('subscription_category_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_subscription_category_success'));
    }));
    router.get('/overview', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
        const records = await repository.find({ where: { user_id: userId } });
        const settings = await settingService.getOrCreate(userId, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        response.json((0, response_1.successResponse)(buildOverview(records, settings.lead_days)));
    }));
    router.get('/category-breakdown', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
        const records = await repository.find({ where: { user_id: userId } });
        const settings = await settingService.getOrCreate(userId, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        const grouped = new Map();
        records.forEach((record) => {
            if (getStatus(record, settings.lead_days) === 'expired') {
                return;
            }
            const key = record.category_id || record.category_name;
            const current = grouped.get(key) ?? {
                categoryId: record.category_id,
                categoryName: record.category_name,
                count: 0,
                monthlyAmount: 0,
                annualAmount: 0,
            };
            current.count += 1;
            current.monthlyAmount += toMonthly(record);
            current.annualAmount += toAnnual(record);
            grouped.set(key, current);
        });
        response.json((0, response_1.successResponse)(Array.from(grouped.values()).map((item) => ({
            ...item,
            monthlyAmount: Number(item.monthlyAmount.toFixed(2)),
            annualAmount: Number(item.annualAmount.toFixed(2)),
        })).sort((left, right) => right.annualAmount - left.annualAmount)));
    }));
    router.get('/expiry-timeline', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
        const settings = await settingService.getOrCreate(userId, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        const records = await repository.find({ where: { user_id: userId } });
        const today = (0, dayjs_1.default)().startOf('day');
        const end = today.add(settings.dashboard_range_days, 'day');
        const bucket = new Map();
        records.forEach((record) => {
            const date = (0, dayjs_1.default)(record.end_date).startOf('day');
            if (date.isBefore(today) || date.isAfter(end)) {
                return;
            }
            const key = date.format('YYYY-MM-DD');
            const current = bucket.get(key) ?? {
                date: key,
                label: date.format('MM-DD'),
                count: 0,
                annualAmount: 0,
                monthlyAmount: 0,
                services: [],
            };
            current.count += 1;
            current.annualAmount += toAnnual(record);
            current.monthlyAmount += toMonthly(record);
            current.services.push(record.service_name);
            bucket.set(key, current);
        });
        response.json((0, response_1.successResponse)(Array.from(bucket.values()).map((item) => ({
            ...item,
            annualAmount: Number(item.annualAmount.toFixed(2)),
            monthlyAmount: Number(item.monthlyAmount.toFixed(2)),
        })).sort((left, right) => (0, dayjs_1.default)(left.date).valueOf() - (0, dayjs_1.default)(right.date).valueOf())));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        response.json((0, response_1.successResponse)({
            recordsKeyword: settings.records_keyword,
            recordsCategoryId: settings.records_category_id,
            recordsStatus: settings.records_status,
            recordsAutoRenewFilter: settings.records_auto_renew_filter,
            recordsExpiryStartDate: settings.records_expiry_start_date ?? '',
            recordsExpiryEndDate: settings.records_expiry_end_date ?? '',
            dashboardRangeDays: settings.dashboard_range_days,
            reminderEnabled: settings.reminder_enabled,
            expiryDayReminderEnabled: settings.expiry_day_reminder_enabled,
            leadDays: settings.lead_days,
            includeAutoRenewInReminders: settings.include_auto_renew_in_reminders,
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            records_keyword: payload.recordsKeyword,
            records_category_id: payload.recordsCategoryId,
            records_status: payload.recordsStatus,
            records_auto_renew_filter: payload.recordsAutoRenewFilter,
            records_expiry_start_date: payload.recordsExpiryStartDate ? (0, date_1.normalizeDate)(payload.recordsExpiryStartDate) : undefined,
            records_expiry_end_date: payload.recordsExpiryEndDate ? (0, date_1.normalizeDate)(payload.recordsExpiryEndDate) : undefined,
            dashboard_range_days: payload.dashboardRangeDays,
            reminder_enabled: payload.reminderEnabled,
            expiry_day_reminder_enabled: payload.expiryDayReminderEnabled,
            lead_days: payload.leadDays,
            include_auto_renew_in_reminders: payload.includeAutoRenewInReminders,
        }, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        await (0, notification_1.syncNotificationScenesEnabled)(userId, [
            { sceneId: 'subscription.renewal_upcoming', enabled: settings.reminder_enabled },
            { sceneId: 'subscription.expired', enabled: settings.expiry_day_reminder_enabled },
        ]);
        response.json((0, response_1.successResponse)({
            recordsKeyword: settings.records_keyword,
            recordsCategoryId: settings.records_category_id,
            recordsStatus: settings.records_status,
            recordsAutoRenewFilter: settings.records_auto_renew_filter,
            recordsExpiryStartDate: settings.records_expiry_start_date ?? '',
            recordsExpiryEndDate: settings.records_expiry_end_date ?? '',
            dashboardRangeDays: settings.dashboard_range_days,
            reminderEnabled: settings.reminder_enabled,
            expiryDayReminderEnabled: settings.expiry_day_reminder_enabled,
            leadDays: settings.lead_days,
            includeAutoRenewInReminders: settings.include_auto_renew_in_reminders,
        }, 'update_subscription_settings_success'));
    }));
    router.get('/reminders', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
        const settings = await settingService.getOrCreate(userId, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        const records = await repository.find({ where: { user_id: userId } });
        const today = (0, dayjs_1.default)().startOf('day');
        const items = records.flatMap((record) => {
            const end = (0, dayjs_1.default)(record.end_date).startOf('day');
            const diff = end.diff(today, 'day');
            const base = `${record.id}:${record.end_date}`;
            const reminders = [];
            if (settings.reminder_enabled && diff >= 0 && diff <= settings.lead_days && (settings.include_auto_renew_in_reminders || !record.auto_renew)) {
                reminders.push({
                    recordId: record.id,
                    serviceName: record.service_name,
                    endDate: record.end_date,
                    sceneId: 'subscription.renewal_upcoming',
                    marker: `${base}:upcoming`,
                    message: `${record.service_name} 将在 ${record.end_date} 到期，距离到期还有 ${diff} 天。`,
                });
            }
            if (settings.expiry_day_reminder_enabled && diff <= 0) {
                reminders.push({
                    recordId: record.id,
                    serviceName: record.service_name,
                    endDate: record.end_date,
                    sceneId: 'subscription.expired',
                    marker: `${base}:expired`,
                    message: diff === 0
                        ? `${record.service_name} 今日到期，请及时处理续费或停用。`
                        : `${record.service_name} 已于 ${record.end_date} 到期，当前已逾期 ${Math.abs(diff)} 天。`,
                });
            }
            return reminders;
        });
        response.json((0, response_1.successResponse)(items));
    }));
    router.post('/actions/trigger-reminders', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(triggerReminderSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_subscription_record_entity_1.FinanceSubscriptionRecordEntity);
        const settings = await settingService.getOrCreate(userId, {
            records_keyword: '',
            records_category_id: 'all',
            records_status: 'all',
            records_auto_renew_filter: 'all',
            records_expiry_start_date: null,
            records_expiry_end_date: null,
            dashboard_range_days: 90,
            reminder_enabled: true,
            expiry_day_reminder_enabled: true,
            lead_days: 7,
            include_auto_renew_in_reminders: false,
        });
        const records = await repository.find({ where: { user_id: userId } });
        const logs = await triggerSubscriptionReminderLogs(userId, records, settings);
        if (!logs.length) {
            logs.push(...(await (0, notification_1.sendNotificationSceneLogs)({
                userId,
                sceneId: 'subscription.renewal_upcoming',
                title: payload.title ?? '服务订阅即将到期',
                message: '已手动触发订阅即将到期提醒。',
            })), ...(await (0, notification_1.sendNotificationSceneLogs)({
                userId,
                sceneId: 'subscription.expired',
                title: payload.title ?? '服务订阅已到期',
                message: '已手动触发订阅到期或逾期提醒。',
            })));
        }
        response.json((0, response_1.successResponse)(logs, 'trigger_subscription_reminders_success'));
    }));
    return router;
}
