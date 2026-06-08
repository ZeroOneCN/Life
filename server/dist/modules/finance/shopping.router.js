"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShoppingRouter = createShoppingRouter;
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
const finance_shopping_import_batch_entity_1 = require("./entities/finance-shopping-import-batch.entity");
const finance_shopping_ledger_entity_1 = require("./entities/finance-shopping-ledger.entity");
const finance_shopping_platform_entity_1 = require("./entities/finance-shopping-platform.entity");
const finance_shopping_record_entity_1 = require("./entities/finance-shopping-record.entity");
const finance_shopping_setting_entity_1 = require("./entities/finance-shopping-setting.entity");
const life_storage_item_entity_1 = require("../life/entities/life-storage-item.entity");
const recordSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    ledgerId: zod_1.z.string().trim().min(1),
    date: zod_1.z.string().min(1),
    platform: zod_1.z.string().trim().min(1).max(128),
    itemName: zod_1.z.string().trim().min(1).max(255),
    spec: zod_1.z.string().optional().default(''),
    price: zod_1.z.number().min(0),
    unitPrice: zod_1.z.number().nullable().optional(),
    orderNo: zod_1.z.string().optional().default(''),
    note: zod_1.z.string().optional().default(''),
});
const ledgerSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(128),
    description: zod_1.z.string().optional().default(''),
    startDate: zod_1.z.string().min(1),
    endDate: zod_1.z.string().optional().default(''),
    isActive: zod_1.z.coerce.boolean().optional(),
});
const platformSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(128),
    colorToken: zod_1.z.string().trim().optional().nullable(),
    isBuiltIn: zod_1.z.boolean().optional().default(false),
});
const settingsSchema = zod_1.z.object({
    activeUserId: zod_1.z.string().optional().default(''),
    recordsUserId: zod_1.z.string().optional().default(''),
    dashboardUserId: zod_1.z.string().optional().default(''),
    activeLedgerId: zod_1.z.string().optional().default(''),
    recordsLedgerId: zod_1.z.string().optional().default('all'),
    dashboardLedgerId: zod_1.z.string().optional().default('all'),
    currencyMode: zod_1.z.enum(['CNY', 'USD', 'USDT']).optional().default('CNY'),
    usdtRate: zod_1.z.number().min(0).optional().default(7.2),
});
const importRowSchema = zod_1.z.object({
    userId: zod_1.z.string().trim().optional(),
    ledgerId: zod_1.z.string().trim().optional(),
    date: zod_1.z.string().optional(),
    platform: zod_1.z.string().trim().optional(),
    itemName: zod_1.z.string().trim().optional(),
    spec: zod_1.z.string().optional(),
    price: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    unitPrice: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).nullable().optional(),
    orderNo: zod_1.z.string().optional(),
    note: zod_1.z.string().optional(),
});
const importSchema = zod_1.z.object({
    fileName: zod_1.z.string().trim().optional().default('shopping-import.json'),
    rows: zod_1.z.array(importRowSchema).default([]),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(finance_shopping_setting_entity_1.FinanceShoppingSettingEntity);
function toMoney(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}
function mapRecord(entity) {
    return {
        id: entity.id,
        userId: entity.user_id,
        ledgerId: entity.ledger_id,
        date: (0, dayjs_1.default)(entity.date).format('YYYY-MM-DD'),
        platform: entity.platform,
        itemName: entity.item_name,
        spec: entity.spec,
        price: Number(entity.price),
        unitPrice: entity.unit_price === null ? null : Number(entity.unit_price),
        orderNo: entity.order_no,
        note: entity.note,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapLedger(entity) {
    return {
        id: entity.id,
        name: entity.name,
        description: entity.description,
        startDate: entity.start_date,
        endDate: entity.end_date ?? '',
        isActive: entity.is_active,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapPlatform(entity) {
    return {
        id: entity.id,
        name: entity.name,
        colorToken: entity.color_token ?? '',
        isBuiltIn: entity.is_built_in,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function buildRecordKey(item) {
    return [
        item.userId.trim().toLowerCase(),
        item.ledgerId.trim().toLowerCase(),
        item.date,
        item.platform.trim().toLowerCase(),
        item.itemName.trim().toLowerCase(),
        item.price.toFixed(2),
        item.orderNo.trim().toLowerCase(),
    ].join('|');
}
function createShoppingRouter() {
    const router = (0, express_1.Router)();
    router.get('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const ledgerId = String(request.query.ledgerId ?? 'all');
        const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_record_entity_1.FinanceShoppingRecordEntity);
        const items = await repository.find({
            where: { user_id: userId },
            order: { date: 'DESC', updated_at: 'DESC' },
        });
        const filtered = items
            .filter((item) => ledgerId === 'all' || item.ledger_id === ledgerId)
            .filter((item) => !keyword || [item.platform, item.item_name, item.spec, item.order_no, item.note].some((value) => value.toLowerCase().includes(keyword)));
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, filtered.length)));
    }));
    router.post('/records', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(recordSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_record_entity_1.FinanceShoppingRecordEntity);
        const item = await repository.save(repository.create({
            user_id: payload.userId ?? authUserId,
            ledger_id: payload.ledgerId,
            date: (0, date_1.normalizeDate)(payload.date),
            platform: payload.platform,
            item_name: payload.itemName,
            spec: payload.spec,
            price: payload.price,
            unit_price: payload.unitPrice ?? null,
            order_no: payload.orderNo,
            note: payload.note,
        }));
        response.json((0, response_1.successResponse)(mapRecord(item), 'create_shopping_record_success'));
    }));
    router.patch('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(recordSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_record_entity_1.FinanceShoppingRecordEntity);
        const current = await repository.findOne({
            where: { id: recordId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('shopping_record_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            user_id: payload.userId ?? current.user_id,
            ledger_id: payload.ledgerId ?? current.ledger_id,
            date: payload.date ? (0, date_1.normalizeDate)(payload.date) : current.date,
            platform: payload.platform ?? current.platform,
            item_name: payload.itemName ?? current.item_name,
            spec: payload.spec ?? current.spec,
            price: payload.price ?? current.price,
            unit_price: payload.unitPrice !== undefined ? payload.unitPrice : current.unit_price,
            order_no: payload.orderNo ?? current.order_no,
            note: payload.note ?? current.note,
        });
        response.json((0, response_1.successResponse)(mapRecord(next), 'update_shopping_record_success'));
    }));
    router.delete('/records/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const recordId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_record_entity_1.FinanceShoppingRecordEntity);
        const current = await repository.findOne({
            where: { id: recordId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('shopping_record_not_found', 404, 404);
        }
        await repository.remove(current);
        try {
            const storageRepo = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
            const linkedStorageItems = await storageRepo.find({
                where: {
                    shopping_record_id: recordId,
                    user_id: userId,
                    source: 'shopping',
                },
            });
            if (linkedStorageItems.length > 0) {
                await storageRepo.remove(linkedStorageItems);
            }
        }
        catch (error) {
            console.error('联动删除物品追踪记录失败:', error);
        }
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_shopping_record_success'));
    }));
    router.get('/ledgers', (0, async_handler_1.asyncHandler)(async (_request, response) => {
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_ledger_entity_1.FinanceShoppingLedgerEntity);
        const items = await repository.find({
            order: { is_active: 'DESC', updated_at: 'DESC' },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapLedger))));
    }));
    router.post('/ledgers', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const payload = (0, validation_1.validateBody)(ledgerSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_ledger_entity_1.FinanceShoppingLedgerEntity);
        if (payload.isActive) {
            const activeLedgers = await repository.find({ where: { is_active: true } });
            if (activeLedgers.length) {
                await repository.save(activeLedgers.map((item) => ({ ...item, is_active: false })));
            }
        }
        const item = await repository.save(repository.create({
            name: payload.name,
            description: payload.description,
            start_date: (0, date_1.normalizeDate)(payload.startDate),
            end_date: payload.endDate ? (0, date_1.normalizeDate)(payload.endDate) : null,
            is_active: payload.isActive ?? false,
        }));
        response.json((0, response_1.successResponse)(mapLedger(item), 'create_shopping_ledger_success'));
    }));
    router.patch('/ledgers/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const ledgerId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(ledgerSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_ledger_entity_1.FinanceShoppingLedgerEntity);
        const current = await repository.findOne({ where: { id: ledgerId } });
        if (!current) {
            throw new app_error_1.AppError('shopping_ledger_not_found', 404, 404);
        }
        if (payload.isActive) {
            const activeLedgers = await repository.find({ where: { is_active: true } });
            if (activeLedgers.length) {
                await repository.save(activeLedgers.map((item) => ({ ...item, is_active: item.id === current.id ? item.is_active : false })));
            }
        }
        const next = await repository.save({
            ...current,
            name: payload.name ?? current.name,
            description: payload.description ?? current.description,
            start_date: payload.startDate ? (0, date_1.normalizeDate)(payload.startDate) : current.start_date,
            end_date: payload.endDate !== undefined ? (payload.endDate ? (0, date_1.normalizeDate)(payload.endDate) : null) : current.end_date,
            is_active: !!payload.isActive,
        });
        response.json((0, response_1.successResponse)(mapLedger(next), 'update_shopping_ledger_success'));
    }));
    router.delete('/ledgers/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const ledgerId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_ledger_entity_1.FinanceShoppingLedgerEntity);
        const current = await repository.findOne({ where: { id: ledgerId } });
        if (!current) {
            throw new app_error_1.AppError('shopping_ledger_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_shopping_ledger_success'));
    }));
    router.get('/platforms', (0, async_handler_1.asyncHandler)(async (_request, response) => {
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_platform_entity_1.FinanceShoppingPlatformEntity);
        const items = await repository.find({
            order: { is_built_in: 'DESC', name: 'ASC' },
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapPlatform))));
    }));
    router.post('/platforms', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const payload = (0, validation_1.validateBody)(platformSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_platform_entity_1.FinanceShoppingPlatformEntity);
        const item = await repository.save(repository.create({
            name: payload.name,
            color_token: payload.colorToken ?? null,
            is_built_in: payload.isBuiltIn,
        }));
        response.json((0, response_1.successResponse)(mapPlatform(item), 'create_shopping_platform_success'));
    }));
    router.patch('/platforms/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const platformId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(platformSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_platform_entity_1.FinanceShoppingPlatformEntity);
        const current = await repository.findOne({ where: { id: platformId } });
        if (!current) {
            throw new app_error_1.AppError('shopping_platform_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            name: payload.name ?? current.name,
            color_token: payload.colorToken !== undefined ? payload.colorToken : current.color_token,
            is_built_in: payload.isBuiltIn ?? current.is_built_in,
        });
        response.json((0, response_1.successResponse)(mapPlatform(next), 'update_shopping_platform_success'));
    }));
    router.delete('/platforms/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const platformId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_platform_entity_1.FinanceShoppingPlatformEntity);
        const current = await repository.findOne({ where: { id: platformId } });
        if (!current) {
            throw new app_error_1.AppError('shopping_platform_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_shopping_platform_success'));
    }));
    router.get('/overview', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const ledgerId = String(request.query.ledgerId ?? 'all');
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_record_entity_1.FinanceShoppingRecordEntity);
        const records = await repository.find({ where: { user_id: userId } });
        const filtered = records.filter((item) => ledgerId === 'all' || item.ledger_id === ledgerId);
        const currentMonth = (0, dayjs_1.default)().format('YYYY-MM');
        response.json((0, response_1.successResponse)({
            currentMonthOrders: filtered.filter((item) => (0, dayjs_1.default)(item.date).format('YYYY-MM') === currentMonth).length,
            currentMonthAmount: Number(filtered.filter((item) => (0, dayjs_1.default)(item.date).format('YYYY-MM') === currentMonth).reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)),
            totalAmount: Number(filtered.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)),
            totalOrders: filtered.length,
            activePlatformCount: new Set(filtered.map((item) => item.platform)).size,
            trackedMonths: new Set(filtered.map((item) => (0, dayjs_1.default)(item.date).format('YYYY-MM'))).size,
        }));
    }));
    router.get('/monthly-trend', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const ledgerId = String(request.query.ledgerId ?? 'all');
        const repository = data_source_1.appDataSource.getRepository(finance_shopping_record_entity_1.FinanceShoppingRecordEntity);
        const records = (await repository.find({ where: { user_id: userId } }))
            .filter((item) => ledgerId === 'all' || item.ledger_id === ledgerId);
        const items = Array.from({ length: 12 }, (_, index) => {
            const month = (0, dayjs_1.default)().subtract(11 - index, 'month').format('YYYY-MM');
            const scoped = records.filter((item) => (0, dayjs_1.default)(item.date).format('YYYY-MM') === month);
            return {
                month,
                label: (0, dayjs_1.default)(`${month}-01`).format('MM月'),
                amount: Number(scoped.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)),
                orderCount: scoped.length,
            };
        });
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/platform-breakdown', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const ledgerId = String(request.query.ledgerId ?? 'all');
        const [records, platforms] = await Promise.all([
            data_source_1.appDataSource.getRepository(finance_shopping_record_entity_1.FinanceShoppingRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_shopping_platform_entity_1.FinanceShoppingPlatformEntity).find(),
        ]);
        const filtered = records.filter((item) => ledgerId === 'all' || item.ledger_id === ledgerId);
        const platformMap = new Map(platforms.map((item) => [item.name, item.color_token ?? '']));
        const grouped = new Map();
        filtered.forEach((item) => {
            const current = grouped.get(item.platform) ?? { amount: 0, count: 0 };
            current.amount += Number(item.price);
            current.count += 1;
            grouped.set(item.platform, current);
        });
        const items = Array.from(grouped.entries())
            .map(([name, value]) => ({
            name,
            amount: Number(value.amount.toFixed(2)),
            count: value.count,
            color: platformMap.get(name) ?? '',
        }))
            .sort((left, right) => right.amount - left.amount);
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/ledger-summary', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const userId = String(request.query.userId ?? authUserId);
        const [records, ledgers] = await Promise.all([
            data_source_1.appDataSource.getRepository(finance_shopping_record_entity_1.FinanceShoppingRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(finance_shopping_ledger_entity_1.FinanceShoppingLedgerEntity).find(),
        ]);
        const items = ledgers.map((ledger) => {
            const scoped = records.filter((item) => item.ledger_id === ledger.id);
            return {
                ledgerId: ledger.id,
                ledgerName: ledger.name,
                amount: Number(scoped.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)),
                count: scoped.length,
                startDate: ledger.start_date,
                endDate: ledger.end_date ?? '',
                isActive: ledger.is_active,
            };
        }).sort((left, right) => right.amount - left.amount);
        response.json((0, response_1.successResponse)(items));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            active_user_id: userId,
            records_user_id: userId,
            dashboard_user_id: userId,
            active_ledger_id: null,
            records_ledger_id: 'all',
            dashboard_ledger_id: 'all',
            currency_mode: 'CNY',
            usdt_rate: 7.2,
        });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
            dashboardUserId: settings.dashboard_user_id ?? userId,
            activeLedgerId: settings.active_ledger_id ?? '',
            recordsLedgerId: settings.records_ledger_id ?? 'all',
            dashboardLedgerId: settings.dashboard_ledger_id ?? 'all',
            currencyMode: settings.currency_mode,
            usdtRate: Number(settings.usdt_rate),
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            active_user_id: payload.activeUserId,
            records_user_id: payload.recordsUserId,
            dashboard_user_id: payload.dashboardUserId,
            active_ledger_id: payload.activeLedgerId,
            records_ledger_id: payload.recordsLedgerId,
            dashboard_ledger_id: payload.dashboardLedgerId,
            currency_mode: payload.currencyMode,
            usdt_rate: payload.usdtRate,
        }, {
            active_user_id: userId,
            records_user_id: userId,
            dashboard_user_id: userId,
            active_ledger_id: null,
            records_ledger_id: 'all',
            dashboard_ledger_id: 'all',
            currency_mode: 'CNY',
            usdt_rate: 7.2,
        });
        response.json((0, response_1.successResponse)({
            activeUserId: settings.active_user_id ?? userId,
            recordsUserId: settings.records_user_id ?? userId,
            dashboardUserId: settings.dashboard_user_id ?? userId,
            activeLedgerId: settings.active_ledger_id ?? '',
            recordsLedgerId: settings.records_ledger_id ?? 'all',
            dashboardLedgerId: settings.dashboard_ledger_id ?? 'all',
            currencyMode: settings.currency_mode,
            usdtRate: Number(settings.usdt_rate),
        }, 'update_shopping_settings_success'));
    }));
    router.post('/actions/import', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const authUserId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(importSchema, request.body);
        const rows = payload.rows ?? [];
        const recordRepo = data_source_1.appDataSource.getRepository(finance_shopping_record_entity_1.FinanceShoppingRecordEntity);
        const batchRepo = data_source_1.appDataSource.getRepository(finance_shopping_import_batch_entity_1.FinanceShoppingImportBatchEntity);
        const existing = await recordRepo.find({ where: { user_id: authUserId } });
        const seen = new Set(existing.map((item) => buildRecordKey({
            userId: item.user_id,
            ledgerId: item.ledger_id,
            date: item.date,
            platform: item.platform,
            itemName: item.item_name,
            price: Number(item.price),
            orderNo: item.order_no,
        })));
        let importedCount = 0;
        let duplicateCount = 0;
        let invalidCount = 0;
        const toSave = [];
        rows.forEach((row) => {
            const userId = row.userId ?? authUserId;
            const ledgerId = row.ledgerId ?? '';
            const date = row.date ? (0, date_1.normalizeDate)(row.date) : '';
            const platform = row.platform?.trim() ?? '';
            const itemName = row.itemName?.trim() ?? '';
            const price = toMoney(row.price, NaN);
            if (!ledgerId || !date || !platform || !itemName || !Number.isFinite(price) || price <= 0) {
                invalidCount += 1;
                return;
            }
            const key = buildRecordKey({
                userId,
                ledgerId,
                date,
                platform,
                itemName,
                price,
                orderNo: row.orderNo ?? '',
            });
            if (seen.has(key)) {
                duplicateCount += 1;
                return;
            }
            seen.add(key);
            importedCount += 1;
            toSave.push(recordRepo.create({
                user_id: userId,
                ledger_id: ledgerId,
                date,
                platform,
                item_name: itemName,
                spec: row.spec ?? '',
                price,
                unit_price: row.unitPrice === null || row.unitPrice === undefined || row.unitPrice === '' ? null : toMoney(row.unitPrice, 0),
                order_no: row.orderNo ?? '',
                note: row.note ?? '',
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
        }, 'import_shopping_records_success'));
    }));
    return router;
}
