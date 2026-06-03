"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckupRouter = createCheckupRouter;
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
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const app_error_1 = require("../../shared/errors/app-error");
const notification_1 = require("../../shared/domain/notification");
const health_checkup_record_entity_1 = require("./entities/health-checkup-record.entity");
const health_checkup_setting_entity_1 = require("./entities/health-checkup-setting.entity");
const health_checkup_template_item_entity_1 = require("./entities/health-checkup-template-item.entity");
const health_checkup_template_entity_1 = require("./entities/health-checkup-template.entity");
const recordSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    testDate: zod_1.z.string().min(1),
    testType: zod_1.z.string().trim().min(1).max(128),
    testName: zod_1.z.string().trim().min(1).max(128),
    value: zod_1.z.number(),
    unit: zod_1.z.string().trim().min(1).max(64),
    referenceRange: zod_1.z.string().trim().min(1).max(255),
    notes: zod_1.z.string().optional().default(''),
    followUpDate: zod_1.z.string().optional().default(''),
    status: zod_1.z.string().trim().optional(),
});
const templateItemSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    testName: zod_1.z.string().trim().min(1).max(128),
    unit: zod_1.z.string().trim().min(1).max(64),
    referenceRange: zod_1.z.string().trim().min(1).max(255),
});
const templateSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    name: zod_1.z.string().trim().min(1).max(128),
    testType: zod_1.z.string().trim().min(1).max(128),
    items: zod_1.z.array(templateItemSchema).default([]),
});
const batchCreateSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    templateId: zod_1.z.string().trim().min(1),
    testDate: zod_1.z.string().min(1),
    followUpDate: zod_1.z.string().optional().default(''),
    status: zod_1.z.string().trim().optional(),
});
const settingsSchema = zod_1.z.object({
    activeUserId: zod_1.z.string().optional(),
    recordsUserId: zod_1.z.string().optional(),
    trendUserId: zod_1.z.string().optional(),
    insightUserId: zod_1.z.string().optional(),
    reminderEnabled: zod_1.z.boolean().optional(),
    abnormalAlertEnabled: zod_1.z.boolean().optional(),
    followUpLeadDays: zod_1.z.number().int().min(0).max(90).optional(),
});
const triggerSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255).optional(),
    message: zod_1.z.string().trim().optional(),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(health_checkup_setting_entity_1.HealthCheckupSettingEntity);
function evaluateStatus(value, referenceRange) {
    const normalized = referenceRange.replace(/\s+/g, '');
    const rangeMatch = normalized.match(/^(-?\d+(?:\.\d+)?)(?:-|~)(-?\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
        const min = Number(rangeMatch[1]);
        const max = Number(rangeMatch[2]);
        return value >= min && value <= max ? 'normal' : 'abnormal';
    }
    const upperMatch = normalized.match(/^(<=|<)(-?\d+(?:\.\d+)?)$/);
    if (upperMatch) {
        const limit = Number(upperMatch[2]);
        return upperMatch[1] === '<=' ? (value <= limit ? 'normal' : 'abnormal') : (value < limit ? 'normal' : 'abnormal');
    }
    const lowerMatch = normalized.match(/^(>=|>)(-?\d+(?:\.\d+)?)$/);
    if (lowerMatch) {
        const limit = Number(lowerMatch[2]);
        return lowerMatch[1] === '>=' ? (value >= limit ? 'normal' : 'abnormal') : (value > limit ? 'normal' : 'abnormal');
    }
    return 'unknown';
}
function mapRecord(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        testDate: entity.test_date,
        testType: entity.test_type,
        testName: entity.test_name,
        value: Number(entity.value),
        unit: entity.unit,
        referenceRange: entity.reference_range,
        notes: entity.notes,
        followUpDate: entity.follow_up_date ?? '',
        status: entity.status,
        lastAbnormalAlertAt: entity.last_abnormal_alert_at?.toISOString() ?? '',
        lastFollowUpReminderAt: entity.last_follow_up_reminder_at?.toISOString() ?? '',
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapTemplate(template, items) {
    return {
        id: template.id,
        userId: template.user_id,
        name: template.name,
        testType: template.test_type,
        items: items.filter((item) => item.template_id === template.id).map((item) => ({
            id: item.id,
            testName: item.test_name,
            unit: item.unit,
            referenceRange: item.reference_range,
        })),
        createdAt: template.created_at.toISOString(),
        updatedAt: template.updated_at.toISOString(),
    };
}
function buildDueFollowUps(records, leadDays) {
    const today = (0, dayjs_1.default)().startOf('day');
    return records
        .filter((item) => item.follow_up_date && (item.status === 'abnormal' || item.status === 'attention'))
        .map((item) => ({
        id: item.id,
        testName: item.test_name,
        testType: item.test_type,
        testDate: item.test_date,
        followUpDate: item.follow_up_date ?? '',
        status: item.status,
        daysUntilDue: (0, dayjs_1.default)(item.follow_up_date).startOf('day').diff(today, 'day'),
    }))
        .filter((item) => item.daysUntilDue <= leadDays)
        .sort((left, right) => (0, dayjs_1.default)(left.followUpDate).valueOf() - (0, dayjs_1.default)(right.followUpDate).valueOf());
}
function createCheckupRouter() {
    const router = (0, express_1.Router)();
    router.get('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { test_date: 'DESC', updated_at: 'DESC' },
        });
        const filtered = items.filter((item) => !keyword || [item.test_type, item.test_name, item.notes, item.status].some((value) => value.toLowerCase().includes(keyword)));
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, filtered.length)));
    }));
    router.post('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(recordSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity);
        const status = payload.status || evaluateStatus(payload.value, payload.referenceRange);
        const item = await repository.save(repository.create({
            user_id: payload.userId ?? authUserId,
            test_date: (0, date_1.normalizeDate)(payload.testDate),
            test_type: payload.testType,
            test_name: payload.testName,
            value: payload.value,
            unit: payload.unit,
            reference_range: payload.referenceRange,
            notes: payload.notes,
            follow_up_date: payload.followUpDate ? (0, date_1.normalizeDate)(payload.followUpDate) : null,
            status,
            last_abnormal_alert_at: status === 'abnormal' ? new Date() : null,
            last_follow_up_reminder_at: null,
        }));
        response.json((0, response_1.successResponse)(mapRecord(item), 'create_checkup_record_success'));
    }));
    router.patch('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(recordSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity);
        const current = await repository.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('checkup_record_not_found', 404, 404);
        }
        const nextValue = payload.value ?? Number(current.value);
        const nextReferenceRange = payload.referenceRange ?? current.reference_range;
        const nextStatus = payload.status ?? evaluateStatus(nextValue, nextReferenceRange);
        const next = await repository.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            test_date: payload.testDate ? (0, date_1.normalizeDate)(payload.testDate) : current.test_date,
            test_type: payload.testType ?? current.test_type,
            test_name: payload.testName ?? current.test_name,
            value: nextValue,
            unit: payload.unit ?? current.unit,
            reference_range: nextReferenceRange,
            notes: payload.notes ?? current.notes,
            follow_up_date: payload.followUpDate !== undefined ? (payload.followUpDate ? (0, date_1.normalizeDate)(payload.followUpDate) : null) : current.follow_up_date,
            status: nextStatus,
            last_abnormal_alert_at: nextStatus === 'abnormal' ? (current.last_abnormal_alert_at ?? new Date()) : current.last_abnormal_alert_at,
        });
        response.json((0, response_1.successResponse)(mapRecord(next), 'update_checkup_record_success'));
    }));
    router.delete('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity);
        const current = await repository.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('checkup_record_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_checkup_record_success'));
    }));
    router.get('/templates', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const [templates, items] = await Promise.all([
            data_source_1.appDataSource.getRepository(health_checkup_template_entity_1.HealthCheckupTemplateEntity).find({ where: { user_id: userId }, order: { updated_at: 'DESC' } }),
            data_source_1.appDataSource.getRepository(health_checkup_template_item_entity_1.HealthCheckupTemplateItemEntity).find(),
        ]);
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(templates.map((template) => mapTemplate(template, items)))));
    }));
    router.post('/templates', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(templateSchema, request.body);
        const itemsInput = payload.items ?? [];
        const templateRepo = data_source_1.appDataSource.getRepository(health_checkup_template_entity_1.HealthCheckupTemplateEntity);
        const itemRepo = data_source_1.appDataSource.getRepository(health_checkup_template_item_entity_1.HealthCheckupTemplateItemEntity);
        const template = await templateRepo.save(templateRepo.create({
            user_id: payload.userId ?? authUserId,
            name: payload.name,
            test_type: payload.testType,
        }));
        const items = itemsInput.length
            ? await itemRepo.save(itemsInput.map((item) => itemRepo.create({
                template_id: template.id,
                test_name: item.testName,
                unit: item.unit,
                reference_range: item.referenceRange,
            })))
            : [];
        response.json((0, response_1.successResponse)(mapTemplate(template, items), 'create_checkup_template_success'));
    }));
    router.patch('/templates/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(templateSchema.partial(), request.body);
        const templateRepo = data_source_1.appDataSource.getRepository(health_checkup_template_entity_1.HealthCheckupTemplateEntity);
        const itemRepo = data_source_1.appDataSource.getRepository(health_checkup_template_item_entity_1.HealthCheckupTemplateItemEntity);
        const current = await templateRepo.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('checkup_template_not_found', 404, 404);
        }
        const template = await templateRepo.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            name: payload.name ?? current.name,
            test_type: payload.testType ?? current.test_type,
        });
        if (payload.items) {
            await itemRepo.delete({ template_id: current.id });
            await itemRepo.save(payload.items.map((item) => itemRepo.create({
                template_id: current.id,
                test_name: item.testName,
                unit: item.unit,
                reference_range: item.referenceRange,
            })));
        }
        const items = await itemRepo.find({ where: { template_id: current.id } });
        response.json((0, response_1.successResponse)(mapTemplate(template, items), 'update_checkup_template_success'));
    }));
    router.delete('/templates/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const templateRepo = data_source_1.appDataSource.getRepository(health_checkup_template_entity_1.HealthCheckupTemplateEntity);
        const itemRepo = data_source_1.appDataSource.getRepository(health_checkup_template_item_entity_1.HealthCheckupTemplateItemEntity);
        const current = await templateRepo.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('checkup_template_not_found', 404, 404);
        }
        await itemRepo.delete({ template_id: current.id });
        await templateRepo.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_checkup_template_success'));
    }));
    router.post('/actions/batch-create', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(batchCreateSchema, request.body);
        const templateRepo = data_source_1.appDataSource.getRepository(health_checkup_template_entity_1.HealthCheckupTemplateEntity);
        const itemRepo = data_source_1.appDataSource.getRepository(health_checkup_template_item_entity_1.HealthCheckupTemplateItemEntity);
        const recordRepo = data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity);
        const template = await templateRepo.findOne({
            where: { id: payload.templateId, user_id: payload.userId ?? authUserId },
        });
        if (!template) {
            throw new app_error_1.AppError('checkup_template_not_found', 404, 404);
        }
        const items = await itemRepo.find({ where: { template_id: template.id } });
        const status = payload.status ?? 'unknown';
        const created = await recordRepo.save(items.map((item) => recordRepo.create({
            user_id: payload.userId ?? authUserId,
            test_date: (0, date_1.normalizeDate)(payload.testDate),
            test_type: template.test_type,
            test_name: item.test_name,
            value: 0,
            unit: item.unit,
            reference_range: item.reference_range,
            notes: '',
            follow_up_date: payload.followUpDate ? (0, date_1.normalizeDate)(payload.followUpDate) : null,
            status,
            last_abnormal_alert_at: null,
            last_follow_up_reminder_at: null,
        })));
        response.json((0, response_1.successResponse)(created.map(mapRecord), 'batch_create_checkup_records_success'));
    }));
    router.get('/overview', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const settings = await settingService.getOrCreate(authUserId, {
            active_user_id: authUserId,
            records_user_id: authUserId,
            trend_user_id: authUserId,
            insight_user_id: authUserId,
            reminder_enabled: true,
            abnormal_alert_enabled: true,
            follow_up_lead_days: 7,
        });
        const records = await data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity).find({ where: { user_id: userId } });
        const dueFollowUps = buildDueFollowUps(records, settings.follow_up_lead_days);
        response.json((0, response_1.successResponse)({
            totalRecords: records.length,
            abnormalCount: records.filter((item) => item.status === 'abnormal').length,
            attentionCount: records.filter((item) => item.status === 'attention').length,
            dueFollowUpCount: dueFollowUps.length,
            uniqueIndicatorCount: new Set(records.map((item) => item.test_name)).size,
            recentTestDate: records[0]?.test_date ?? null,
        }));
    }));
    router.get('/trend', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const testName = String(request.query.testName ?? '').trim();
        const startDate = String(request.query.startDate ?? '');
        const endDate = String(request.query.endDate ?? '');
        const records = await data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity).find({ where: { user_id: userId } });
        const items = records
            .filter((item) => !testName || item.test_name === testName)
            .filter((item) => !startDate || item.test_date >= startDate)
            .filter((item) => !endDate || item.test_date <= endDate)
            .sort((a, b) => (0, dayjs_1.default)(a.test_date).valueOf() - (0, dayjs_1.default)(b.test_date).valueOf())
            .map((item) => ({
            date: item.test_date,
            label: (0, dayjs_1.default)(item.test_date).format('MM-DD'),
            value: Number(item.value),
            status: item.status,
        }));
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/insights', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const settings = await settingService.getOrCreate(authUserId, {
            active_user_id: authUserId,
            records_user_id: authUserId,
            trend_user_id: authUserId,
            insight_user_id: authUserId,
            reminder_enabled: true,
            abnormal_alert_enabled: true,
            follow_up_lead_days: 7,
        });
        const records = await data_source_1.appDataSource.getRepository(health_checkup_record_entity_1.HealthCheckupRecordEntity).find({ where: { user_id: userId } });
        const dueFollowUps = buildDueFollowUps(records, settings.follow_up_lead_days);
        const abnormalRecords = records.filter((item) => item.status === 'abnormal');
        const insights = [];
        if (abnormalRecords.length) {
            insights.push({
                id: 'abnormal',
                level: abnormalRecords.length / Math.max(1, records.length) >= 0.35 ? 'critical' : 'warning',
                title: abnormalRecords.length / Math.max(1, records.length) >= 0.35 ? '异常指标占比较高' : '发现异常指标',
                description: `当前共有 ${abnormalRecords.length} 条异常指标，建议优先复核高风险项目。`,
                affectedCount: abnormalRecords.length,
                sceneId: 'checkup.abnormal_alert',
            });
        }
        if (dueFollowUps.length) {
            insights.push({
                id: 'follow-up',
                level: dueFollowUps.some((item) => item.daysUntilDue < 0) ? 'critical' : 'warning',
                title: dueFollowUps.some((item) => item.daysUntilDue < 0) ? '存在逾期复查项目' : '复查窗口临近',
                description: `当前有 ${dueFollowUps.length} 项进入复查提醒窗口。`,
                affectedCount: dueFollowUps.length,
                sceneId: 'checkup.followup_reminder',
            });
        }
        if (!insights.length) {
            insights.push({
                id: 'stable',
                level: 'success',
                title: '当前体检记录整体平稳',
                description: '暂未发现明显异常或临近复查项目。',
            });
        }
        response.json((0, response_1.successResponse)(insights));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            active_user_id: userId,
            records_user_id: userId,
            trend_user_id: userId,
            insight_user_id: userId,
            reminder_enabled: true,
            abnormal_alert_enabled: true,
            follow_up_lead_days: 7,
        });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
            trendUserId: settings.trend_user_id ?? userId,
            insightUserId: settings.insight_user_id ?? userId,
            reminderEnabled: settings.reminder_enabled,
            abnormalAlertEnabled: settings.abnormal_alert_enabled,
            followUpLeadDays: settings.follow_up_lead_days,
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            active_user_id: payload.activeUserId,
            records_user_id: payload.recordsUserId,
            trend_user_id: payload.trendUserId,
            insight_user_id: payload.insightUserId,
            reminder_enabled: payload.reminderEnabled,
            abnormal_alert_enabled: payload.abnormalAlertEnabled,
            follow_up_lead_days: payload.followUpLeadDays,
        }, {
            active_user_id: userId,
            records_user_id: userId,
            trend_user_id: userId,
            insight_user_id: userId,
            reminder_enabled: true,
            abnormal_alert_enabled: true,
            follow_up_lead_days: 7,
        });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
            trendUserId: settings.trend_user_id ?? userId,
            insightUserId: settings.insight_user_id ?? userId,
            reminderEnabled: settings.reminder_enabled,
            abnormalAlertEnabled: settings.abnormal_alert_enabled,
            followUpLeadDays: settings.follow_up_lead_days,
        }, 'update_checkup_settings_success'));
    }));
    router.post('/actions/trigger-reminders', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(triggerSchema, request.body);
        const [followUpLogs, abnormalLogs] = await Promise.all([
            (0, notification_1.sendNotificationSceneLogs)({
                userId,
                sceneId: 'checkup.followup_reminder',
                title: payload.title ?? '体检复查提醒',
                message: payload.message ?? '检测到体检项目已进入复查窗口，请及时安排复查。',
            }),
            (0, notification_1.sendNotificationSceneLogs)({
                userId,
                sceneId: 'checkup.abnormal_alert',
                title: payload.title ?? '体检异常指标提醒',
                message: payload.message ?? '检测到体检项目存在异常指标，请尽快查看并跟进。',
            }),
        ]);
        response.json((0, response_1.successResponse)([...followUpLogs, ...abnormalLogs], 'trigger_checkup_reminders_success'));
    }));
    return router;
}
