"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStepRouter = createStepRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const data_source_1 = require("../../db/data-source");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const pagination_1 = require("../../shared/utils/pagination");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const app_error_1 = require("../../shared/errors/app-error");
const health_step_record_entity_1 = require("./entities/health-step-record.entity");
const health_step_setting_entity_1 = require("./entities/health-step-setting.entity");
const recordSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    steps: zod_1.z.number().int().min(0),
    hour: zod_1.z.number().int().min(0).max(23).nullable().optional(),
    recordTime: zod_1.z.string().min(1),
});
const settingsSchema = zod_1.z.object({
    strideLength: zod_1.z.number().min(0.1).optional(),
    activeUserId: zod_1.z.string().optional(),
    statsUserId: zod_1.z.string().optional(),
    recordsUserId: zod_1.z.string().optional(),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(health_step_setting_entity_1.HealthStepSettingEntity);
function mapRecord(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        steps: entity.steps,
        hour: entity.hour,
        recordTime: (0, dayjs_1.default)(entity.record_time).toISOString(),
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function calculateDistanceKm(steps, strideLength) {
    return Number(((steps * strideLength) / 1000).toFixed(2));
}
function aggregateByBucket(records, bucket, strideLength) {
    const grouped = new Map();
    records.forEach((record) => {
        const key = bucket === 'date'
            ? (0, dayjs_1.default)(record.record_time).format('YYYY-MM-DD')
            : (0, dayjs_1.default)(record.record_time).format('YYYY-MM');
        const current = grouped.get(key) ?? { totalSteps: 0, recordCount: 0 };
        current.totalSteps += record.steps;
        current.recordCount += 1;
        grouped.set(key, current);
    });
    return Array.from(grouped.entries())
        .map(([key, value]) => ({
        bucket: key,
        label: bucket === 'date' ? (0, dayjs_1.default)(key).format('M月D日') : (0, dayjs_1.default)(`${key}-01`).format('M月'),
        totalSteps: value.totalSteps,
        recordCount: value.recordCount,
        distanceKm: calculateDistanceKm(value.totalSteps, strideLength),
    }))
        .sort((left, right) => left.bucket.localeCompare(right.bucket));
}
function createStepRouter() {
    const router = (0, express_1.Router)();
    router.get('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const hour = request.query.hour !== undefined ? Number(request.query.hour) : 'all';
        const month = String(request.query.month ?? '');
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(health_step_record_entity_1.HealthStepRecordEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { record_time: 'DESC', updated_at: 'DESC' },
        });
        const filtered = items
            .filter((item) => hour === 'all' || item.hour === hour)
            .filter((item) => !month || (0, dayjs_1.default)(item.record_time).format('YYYY-MM') === month);
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, filtered.length)));
    }));
    router.post('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(recordSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(health_step_record_entity_1.HealthStepRecordEntity);
        const item = await repository.save(repository.create({
            user_id: payload.userId ?? authUserId,
            steps: payload.steps,
            hour: payload.hour ?? null,
            record_time: (0, dayjs_1.default)(payload.recordTime).isValid() ? (0, dayjs_1.default)(payload.recordTime).toDate() : new Date(),
        }));
        response.json((0, response_1.successResponse)(mapRecord(item), 'create_step_record_success'));
    }));
    router.patch('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(recordSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(health_step_record_entity_1.HealthStepRecordEntity);
        const current = await repository.findOne({
            where: { id: recordId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('step_record_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            steps: payload.steps ?? current.steps,
            hour: payload.hour !== undefined ? payload.hour : current.hour,
            record_time: payload.recordTime ? ((0, dayjs_1.default)(payload.recordTime).isValid() ? (0, dayjs_1.default)(payload.recordTime).toDate() : current.record_time) : current.record_time,
        });
        response.json((0, response_1.successResponse)(mapRecord(next), 'update_step_record_success'));
    }));
    router.delete('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(health_step_record_entity_1.HealthStepRecordEntity);
        const current = await repository.findOne({
            where: { id: recordId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('step_record_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_step_record_success'));
    }));
    router.get('/summary', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const settings = await settingService.getOrCreate(authUserId, {
            stride_length: 0.7,
            active_user_id: authUserId,
            stats_user_id: authUserId,
            records_user_id: authUserId,
        });
        const repository = data_source_1.appDataSource.getRepository(health_step_record_entity_1.HealthStepRecordEntity);
        const records = await repository.find({ where: { user_id: userId } });
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const currentMonth = (0, dayjs_1.default)().format('YYYY-MM');
        const todaySteps = records.filter((item) => (0, dayjs_1.default)(item.record_time).format('YYYY-MM-DD') === today).reduce((sum, item) => sum + item.steps, 0);
        const monthSteps = records.filter((item) => (0, dayjs_1.default)(item.record_time).format('YYYY-MM') === currentMonth).reduce((sum, item) => sum + item.steps, 0);
        response.json((0, response_1.successResponse)({
            totalRecords: records.length,
            todaySteps,
            todayDistanceKm: calculateDistanceKm(todaySteps, Number(settings.stride_length)),
            currentMonthSteps: monthSteps,
            currentMonthDistanceKm: calculateDistanceKm(monthSteps, Number(settings.stride_length)),
            strideLength: Number(settings.stride_length),
        }));
    }));
    router.get('/trend', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const month = String(request.query.month ?? (0, dayjs_1.default)().format('YYYY-MM'));
        const hour = request.query.hour !== undefined ? Number(request.query.hour) : 'all';
        const settings = await settingService.getOrCreate(authUserId, {
            stride_length: 0.7,
            active_user_id: authUserId,
            stats_user_id: authUserId,
            records_user_id: authUserId,
        });
        const repository = data_source_1.appDataSource.getRepository(health_step_record_entity_1.HealthStepRecordEntity);
        const records = (await repository.find({ where: { user_id: userId } }))
            .filter((item) => (0, dayjs_1.default)(item.record_time).format('YYYY-MM') === month)
            .filter((item) => hour === 'all' || item.hour === hour);
        response.json((0, response_1.successResponse)(aggregateByBucket(records, 'date', Number(settings.stride_length))));
    }));
    router.get('/month-compare', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const month = String(request.query.month ?? (0, dayjs_1.default)().format('YYYY-MM'));
        const currentMonth = (0, dayjs_1.default)(`${month}-01`);
        const previousMonth = currentMonth.subtract(1, 'month');
        const settings = await settingService.getOrCreate(authUserId, {
            stride_length: 0.7,
            active_user_id: authUserId,
            stats_user_id: authUserId,
            records_user_id: authUserId,
        });
        const repository = data_source_1.appDataSource.getRepository(health_step_record_entity_1.HealthStepRecordEntity);
        const records = await repository.find({ where: { user_id: userId } });
        const currentSteps = records.filter((item) => (0, dayjs_1.default)(item.record_time).format('YYYY-MM') === currentMonth.format('YYYY-MM')).reduce((sum, item) => sum + item.steps, 0);
        const previousSteps = records.filter((item) => (0, dayjs_1.default)(item.record_time).format('YYYY-MM') === previousMonth.format('YYYY-MM')).reduce((sum, item) => sum + item.steps, 0);
        const changePercentage = previousSteps === 0 ? null : Number((((currentSteps - previousSteps) / previousSteps) * 100).toFixed(1));
        response.json((0, response_1.successResponse)({
            currentLabel: currentMonth.format('YYYY年M月'),
            previousLabel: previousMonth.format('YYYY年M月'),
            currentSteps,
            previousSteps,
            currentDistanceKm: calculateDistanceKm(currentSteps, Number(settings.stride_length)),
            previousDistanceKm: calculateDistanceKm(previousSteps, Number(settings.stride_length)),
            changePercentage,
            trend: changePercentage === null ? 'none' : changePercentage > 0 ? 'up' : changePercentage < 0 ? 'down' : 'flat',
        }));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            stride_length: 0.7,
            active_user_id: userId,
            stats_user_id: userId,
            records_user_id: userId,
        });
        response.json((0, response_1.successResponse)({
            strideLength: Number(settings.stride_length),
            activeUserId: settings.active_user_id ?? userId,
            statsUserId: settings.stats_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            stride_length: payload.strideLength,
            active_user_id: payload.activeUserId,
            stats_user_id: payload.statsUserId,
            records_user_id: payload.recordsUserId,
        }, {
            stride_length: 0.7,
            active_user_id: userId,
            stats_user_id: userId,
            records_user_id: userId,
        });
        response.json((0, response_1.successResponse)({
            strideLength: Number(settings.stride_length),
            activeUserId: settings.active_user_id ?? userId,
            statsUserId: settings.stats_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
        }, 'update_step_settings_success'));
    }));
    return router;
}
