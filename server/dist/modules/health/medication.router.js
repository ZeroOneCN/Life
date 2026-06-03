"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMedicationRouter = createMedicationRouter;
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
const health_medication_purchase_entity_1 = require("./entities/health-medication-purchase.entity");
const health_medication_record_entity_1 = require("./entities/health-medication-record.entity");
const health_medication_setting_entity_1 = require("./entities/health-medication-setting.entity");
const health_medication_summary_entity_1 = require("./entities/health-medication-summary.entity");
const health_medication_threshold_entity_1 = require("./entities/health-medication-threshold.entity");
const recordSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    date: zod_1.z.string().min(1),
    medicineName: zod_1.z.string().trim().min(1).max(128),
    breakfast: zod_1.z.number().min(0).optional().default(0),
    lunch: zod_1.z.number().min(0).optional().default(0),
    dinner: zod_1.z.number().min(0).optional().default(0),
});
const purchaseSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    purchaseDate: zod_1.z.string().min(1),
    medicineName: zod_1.z.string().trim().min(1).max(128),
    quantity: zod_1.z.number().min(0),
    unit: zod_1.z.string().trim().min(1).max(32),
    unitPrice: zod_1.z.number().min(0),
    totalPrice: zod_1.z.number().min(0).optional(),
    channel: zod_1.z.string().trim().min(1).max(128),
});
const summarySchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    date: zod_1.z.string().min(1),
    content: zod_1.z.string().trim().min(1),
});
const settingsSchema = zod_1.z.object({
    activeUserId: zod_1.z.string().optional(),
    recordsUserId: zod_1.z.string().optional(),
    purchaseUserId: zod_1.z.string().optional(),
    analysisUserId: zod_1.z.string().optional(),
    summaryUserId: zod_1.z.string().optional(),
    doseReminderEnabled: zod_1.z.boolean().optional(),
    stockReminderEnabled: zod_1.z.boolean().optional(),
    breakfastReminderTime: zod_1.z.string().optional(),
    lunchReminderTime: zod_1.z.string().optional(),
    dinnerReminderTime: zod_1.z.string().optional(),
    defaultStockThreshold: zod_1.z.number().min(0).optional(),
});
const thresholdSchema = zod_1.z.object({
    medicineName: zod_1.z.string().trim().min(1).max(128),
    threshold: zod_1.z.number().min(0),
});
const triggerSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1).max(255).optional(),
    message: zod_1.z.string().trim().optional(),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(health_medication_setting_entity_1.HealthMedicationSettingEntity);
function mapRecord(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        date: entity.date,
        medicineName: entity.medicine_name,
        breakfast: Number(entity.breakfast),
        lunch: Number(entity.lunch),
        dinner: Number(entity.dinner),
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapPurchase(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        purchaseDate: entity.purchase_date,
        medicineName: entity.medicine_name,
        quantity: Number(entity.quantity),
        unit: entity.unit,
        unitPrice: Number(entity.unit_price),
        totalPrice: Number(entity.total_price),
        channel: entity.channel,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapSummary(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        date: entity.date,
        content: entity.content,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function buildStockSummary(records, purchases, thresholds, defaultThreshold) {
    const usedMap = new Map();
    const purchasedMap = new Map();
    const thresholdMap = new Map(thresholds.map((item) => [item.medicine_name, Number(item.threshold)]));
    records.forEach((record) => {
        usedMap.set(record.medicine_name, (usedMap.get(record.medicine_name) ?? 0) + Number(record.breakfast) + Number(record.lunch) + Number(record.dinner));
    });
    purchases.forEach((purchase) => {
        const current = purchasedMap.get(purchase.medicine_name) ?? { quantity: 0, unit: purchase.unit, mixedUnit: false };
        current.quantity += Number(purchase.quantity);
        current.mixedUnit = current.unit !== null && current.unit !== purchase.unit;
        current.unit = current.mixedUnit ? null : purchase.unit;
        purchasedMap.set(purchase.medicine_name, current);
    });
    const medicineNames = new Set([...usedMap.keys(), ...purchasedMap.keys()]);
    return Array.from(medicineNames).map((medicineName) => {
        const usedQuantity = Number((usedMap.get(medicineName) ?? 0).toFixed(1));
        const purchased = purchasedMap.get(medicineName);
        const threshold = thresholdMap.get(medicineName) ?? defaultThreshold;
        if (!purchased) {
            return {
                medicineName,
                unit: null,
                purchasedQuantity: 0,
                usedQuantity,
                remainingQuantity: null,
                threshold,
                status: 'no_purchase',
                note: '尚未记录该药品的采购信息。',
            };
        }
        if (purchased.mixedUnit) {
            return {
                medicineName,
                unit: null,
                purchasedQuantity: Number(purchased.quantity.toFixed(1)),
                usedQuantity,
                remainingQuantity: null,
                threshold,
                status: 'mixed_unit',
                note: '采购记录存在多个单位，暂不参与库存估算。',
            };
        }
        const remaining = Number((purchased.quantity - usedQuantity).toFixed(1));
        return {
            medicineName,
            unit: purchased.unit,
            purchasedQuantity: Number(purchased.quantity.toFixed(1)),
            usedQuantity,
            remainingQuantity: remaining,
            threshold,
            status: remaining <= threshold ? 'low' : 'ok',
            note: remaining <= threshold ? '已进入低库存提醒阈值。' : '库存高于提醒阈值。',
        };
    }).sort((left, right) => {
        const priority = { low: 0, mixed_unit: 1, no_purchase: 2, ok: 3 };
        return priority[left.status] - priority[right.status];
    });
}
function createMedicationRouter() {
    const router = (0, express_1.Router)();
    router.get('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { date: 'DESC', updated_at: 'DESC' },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, items.length)));
    }));
    router.post('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(recordSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity);
        const item = await repository.save(repository.create({
            user_id: payload.userId ?? authUserId,
            date: (0, date_1.normalizeDate)(payload.date),
            medicine_name: payload.medicineName,
            breakfast: payload.breakfast,
            lunch: payload.lunch,
            dinner: payload.dinner,
        }));
        response.json((0, response_1.successResponse)(mapRecord(item), 'create_medication_record_success'));
    }));
    router.patch('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(recordSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity);
        const current = await repository.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('medication_record_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            date: payload.date ? (0, date_1.normalizeDate)(payload.date) : current.date,
            medicine_name: payload.medicineName ?? current.medicine_name,
            breakfast: payload.breakfast ?? current.breakfast,
            lunch: payload.lunch ?? current.lunch,
            dinner: payload.dinner ?? current.dinner,
        });
        response.json((0, response_1.successResponse)(mapRecord(next), 'update_medication_record_success'));
    }));
    router.delete('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity);
        const current = await repository.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('medication_record_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_medication_record_success'));
    }));
    router.get('/purchases', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { purchase_date: 'DESC', updated_at: 'DESC' },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.slice(skip, skip + pageSize).map(mapPurchase), page, pageSize, items.length)));
    }));
    router.post('/purchases', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(purchaseSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity);
        const totalPrice = payload.totalPrice ?? Number((payload.quantity * payload.unitPrice).toFixed(2));
        const item = await repository.save(repository.create({
            user_id: payload.userId ?? authUserId,
            purchase_date: (0, date_1.normalizeDate)(payload.purchaseDate),
            medicine_name: payload.medicineName,
            quantity: payload.quantity,
            unit: payload.unit,
            unit_price: payload.unitPrice,
            total_price: totalPrice,
            channel: payload.channel,
        }));
        response.json((0, response_1.successResponse)(mapPurchase(item), 'create_medication_purchase_success'));
    }));
    router.patch('/purchases/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(purchaseSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity);
        const current = await repository.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('medication_purchase_not_found', 404, 404);
        }
        const nextQuantity = payload.quantity ?? Number(current.quantity);
        const nextUnitPrice = payload.unitPrice ?? Number(current.unit_price);
        const next = await repository.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            purchase_date: payload.purchaseDate ? (0, date_1.normalizeDate)(payload.purchaseDate) : current.purchase_date,
            medicine_name: payload.medicineName ?? current.medicine_name,
            quantity: nextQuantity,
            unit: payload.unit ?? current.unit,
            unit_price: nextUnitPrice,
            total_price: payload.totalPrice ?? Number((nextQuantity * nextUnitPrice).toFixed(2)),
            channel: payload.channel ?? current.channel,
        });
        response.json((0, response_1.successResponse)(mapPurchase(next), 'update_medication_purchase_success'));
    }));
    router.delete('/purchases/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity);
        const current = await repository.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('medication_purchase_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_medication_purchase_success'));
    }));
    router.get('/summaries', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const repository = data_source_1.appDataSource.getRepository(health_medication_summary_entity_1.HealthMedicationSummaryEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { date: 'DESC', updated_at: 'DESC' },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapSummary))));
    }));
    router.post('/summaries', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(summarySchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(health_medication_summary_entity_1.HealthMedicationSummaryEntity);
        const item = await repository.save(repository.create({
            user_id: payload.userId ?? authUserId,
            date: (0, date_1.normalizeDate)(payload.date),
            content: payload.content,
        }));
        response.json((0, response_1.successResponse)(mapSummary(item), 'create_medication_summary_success'));
    }));
    router.patch('/summaries/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(summarySchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(health_medication_summary_entity_1.HealthMedicationSummaryEntity);
        const current = await repository.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('medication_summary_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            date: payload.date ? (0, date_1.normalizeDate)(payload.date) : current.date,
            content: payload.content ?? current.content,
        });
        response.json((0, response_1.successResponse)(mapSummary(next), 'update_medication_summary_success'));
    }));
    router.delete('/summaries/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(health_medication_summary_entity_1.HealthMedicationSummaryEntity);
        const current = await repository.findOne({
            where: { id: entityId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('medication_summary_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_medication_summary_success'));
    }));
    router.get('/overview', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const [records, purchases] = await Promise.all([
            data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
        ]);
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const totalDosage = records.reduce((sum, item) => sum + Number(item.breakfast) + Number(item.lunch) + Number(item.dinner), 0);
        const trackedDays = new Set(records.map((item) => item.date)).size;
        response.json((0, response_1.successResponse)({
            totalRecords: records.length,
            totalDosage,
            trackedDays,
            avgDailyDosage: trackedDays ? Number((totalDosage / trackedDays).toFixed(1)) : 0,
            activeMedicineCount: new Set(records.map((item) => item.medicine_name)).size,
            purchaseCount: purchases.length,
            totalPurchaseAmount: Number(purchases.reduce((sum, item) => sum + Number(item.total_price), 0).toFixed(2)),
            latestRecordDate: records[0]?.date ?? null,
            todayDosage: records.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.breakfast) + Number(item.lunch) + Number(item.dinner), 0),
        }));
    }));
    router.get('/analysis', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const [records, purchases] = await Promise.all([
            data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
        ]);
        const stockTotal = purchases.reduce((sum, item) => sum + Number(item.quantity), 0)
            - records.reduce((sum, item) => sum + Number(item.breakfast) + Number(item.lunch) + Number(item.dinner), 0);
        const insights = [];
        if (stockTotal < 10) {
            insights.push({
                id: 'stock-low',
                title: '整体药品库存偏低',
                description: '当前累计剩余库存已经偏低，建议优先补齐常用药品。',
                tone: 'warning',
                metric: `${stockTotal.toFixed(1)}`,
            });
        }
        const recentDays = new Set(records.filter((item) => (0, dayjs_1.default)(item.date).isAfter((0, dayjs_1.default)().subtract(7, 'day'))).map((item) => item.date)).size;
        if (recentDays < 3) {
            insights.push({
                id: 'record-low',
                title: '近一周服药记录偏少',
                description: '最近 7 天记录不够完整，建议保持连续记录，便于库存和规律分析。',
                tone: 'neutral',
                metric: `${recentDays} 天`,
            });
        }
        if (!insights.length) {
            insights.push({
                id: 'stable',
                title: '当前用药记录较稳定',
                description: '近期记录和库存没有明显异常，可继续保持。',
                tone: 'positive',
            });
        }
        response.json((0, response_1.successResponse)(insights));
    }));
    router.get('/stock', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const settings = await settingService.getOrCreate(authUserId, {
            active_user_id: authUserId,
            records_user_id: authUserId,
            purchase_user_id: authUserId,
            analysis_user_id: authUserId,
            summary_user_id: authUserId,
            dose_reminder_enabled: true,
            stock_reminder_enabled: true,
            breakfast_reminder_time: '08:00',
            lunch_reminder_time: '12:00',
            dinner_reminder_time: '19:00',
            default_stock_threshold: 3,
        });
        const [records, purchases, thresholds] = await Promise.all([
            data_source_1.appDataSource.getRepository(health_medication_record_entity_1.HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_purchase_entity_1.HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(health_medication_threshold_entity_1.HealthMedicationThresholdEntity).find({ where: { user_id: userId } }),
        ]);
        response.json((0, response_1.successResponse)(buildStockSummary(records, purchases, thresholds, Number(settings.default_stock_threshold))));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            active_user_id: userId,
            records_user_id: userId,
            purchase_user_id: userId,
            analysis_user_id: userId,
            summary_user_id: userId,
            dose_reminder_enabled: true,
            stock_reminder_enabled: true,
            breakfast_reminder_time: '08:00',
            lunch_reminder_time: '12:00',
            dinner_reminder_time: '19:00',
            default_stock_threshold: 3,
        });
        const thresholds = await data_source_1.appDataSource.getRepository(health_medication_threshold_entity_1.HealthMedicationThresholdEntity).find({ where: { user_id: userId } });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
            purchaseUserId: settings.purchase_user_id ?? userId,
            analysisUserId: settings.analysis_user_id ?? userId,
            summaryUserId: settings.summary_user_id ?? userId,
            doseReminderEnabled: settings.dose_reminder_enabled,
            stockReminderEnabled: settings.stock_reminder_enabled,
            breakfastReminderTime: settings.breakfast_reminder_time,
            lunchReminderTime: settings.lunch_reminder_time,
            dinnerReminderTime: settings.dinner_reminder_time,
            defaultStockThreshold: Number(settings.default_stock_threshold),
            medicineThresholds: Object.fromEntries(thresholds.map((item) => [item.medicine_name, Number(item.threshold)])),
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            active_user_id: payload.activeUserId,
            records_user_id: payload.recordsUserId,
            purchase_user_id: payload.purchaseUserId,
            analysis_user_id: payload.analysisUserId,
            summary_user_id: payload.summaryUserId,
            dose_reminder_enabled: payload.doseReminderEnabled,
            stock_reminder_enabled: payload.stockReminderEnabled,
            breakfast_reminder_time: payload.breakfastReminderTime,
            lunch_reminder_time: payload.lunchReminderTime,
            dinner_reminder_time: payload.dinnerReminderTime,
            default_stock_threshold: payload.defaultStockThreshold,
        }, {
            active_user_id: userId,
            records_user_id: userId,
            purchase_user_id: userId,
            analysis_user_id: userId,
            summary_user_id: userId,
            dose_reminder_enabled: true,
            stock_reminder_enabled: true,
            breakfast_reminder_time: '08:00',
            lunch_reminder_time: '12:00',
            dinner_reminder_time: '19:00',
            default_stock_threshold: 3,
        });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
            purchaseUserId: settings.purchase_user_id ?? userId,
            analysisUserId: settings.analysis_user_id ?? userId,
            summaryUserId: settings.summary_user_id ?? userId,
            doseReminderEnabled: settings.dose_reminder_enabled,
            stockReminderEnabled: settings.stock_reminder_enabled,
            breakfastReminderTime: settings.breakfast_reminder_time,
            lunchReminderTime: settings.lunch_reminder_time,
            dinnerReminderTime: settings.dinner_reminder_time,
            defaultStockThreshold: Number(settings.default_stock_threshold),
        }, 'update_medication_settings_success'));
    }));
    router.get('/thresholds', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const items = await data_source_1.appDataSource.getRepository(health_medication_threshold_entity_1.HealthMedicationThresholdEntity).find({ where: { user_id: userId } });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map((item) => ({
            id: item.id,
            medicineName: item.medicine_name,
            threshold: Number(item.threshold),
            createdAt: item.created_at.toISOString(),
            updatedAt: item.updated_at.toISOString(),
        })))));
    }));
    router.post('/thresholds', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(thresholdSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(health_medication_threshold_entity_1.HealthMedicationThresholdEntity);
        const item = await repository.save(repository.create({
            user_id: userId,
            medicine_name: payload.medicineName,
            threshold: payload.threshold,
        }));
        response.json((0, response_1.successResponse)({
            id: item.id,
            medicineName: item.medicine_name,
            threshold: Number(item.threshold),
            createdAt: item.created_at.toISOString(),
            updatedAt: item.updated_at.toISOString(),
        }, 'create_medication_threshold_success'));
    }));
    router.patch('/thresholds/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(thresholdSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(health_medication_threshold_entity_1.HealthMedicationThresholdEntity);
        const current = await repository.findOne({ where: { id: entityId, user_id: userId } });
        if (!current) {
            throw new app_error_1.AppError('medication_threshold_not_found', 404, 404);
        }
        const item = await repository.save({
            ...current,
            medicine_name: payload.medicineName ?? current.medicine_name,
            threshold: payload.threshold ?? current.threshold,
        });
        response.json((0, response_1.successResponse)({
            id: item.id,
            medicineName: item.medicine_name,
            threshold: Number(item.threshold),
            createdAt: item.created_at.toISOString(),
            updatedAt: item.updated_at.toISOString(),
        }, 'update_medication_threshold_success'));
    }));
    router.delete('/thresholds/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const entityId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(health_medication_threshold_entity_1.HealthMedicationThresholdEntity);
        const current = await repository.findOne({ where: { id: entityId, user_id: userId } });
        if (!current) {
            throw new app_error_1.AppError('medication_threshold_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_medication_threshold_success'));
    }));
    router.post('/actions/trigger-dose-reminder', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(triggerSchema, request.body);
        const logs = await (0, notification_1.sendNotificationSceneLogs)({
            userId,
            sceneId: 'medication.dose_reminder',
            title: payload.title ?? '服药提醒',
            message: payload.message ?? '请按计划完成今天的服药安排。',
        });
        response.json((0, response_1.successResponse)(logs, 'trigger_medication_dose_reminder_success'));
    }));
    router.post('/actions/trigger-stock-reminder', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(triggerSchema, request.body);
        const logs = await (0, notification_1.sendNotificationSceneLogs)({
            userId,
            sceneId: 'medication.stock_low',
            title: payload.title ?? '药品低库存提醒',
            message: payload.message ?? '检测到药品库存已低于提醒阈值，请及时补货。',
        });
        response.json((0, response_1.successResponse)(logs, 'trigger_medication_stock_reminder_success'));
    }));
    return router;
}
