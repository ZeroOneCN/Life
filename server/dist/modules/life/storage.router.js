"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStorageRouter = createStorageRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const data_source_1 = require("../../db/data-source");
const life_storage_item_entity_1 = require("./entities/life-storage-item.entity");
const life_storage_setting_entity_1 = require("./entities/life-storage-setting.entity");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const pagination_1 = require("../../shared/utils/pagination");
const date_1 = require("../../shared/utils/date");
const app_error_1 = require("../../shared/errors/app-error");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const itemSchema = zod_1.z.object({
    itemName: zod_1.z.string().trim().min(1).max(255),
    purchasePrice: zod_1.z.number().positive(),
    purchaseDate: zod_1.z.string().min(1),
    endDate: zod_1.z.string().optional().default(''),
    notes: zod_1.z.string().optional().default(''),
});
const settingsSchema = zod_1.z.object({
    includeArchivedInDashboard: zod_1.z.boolean().optional(),
    defaultSort: zod_1.z.enum(['latest', 'purchasePrice', 'dailyCost']).optional(),
    defaultDashboardRange: zod_1.z.enum(['30d', '90d', '365d', 'all']).optional(),
});
const archiveSchema = zod_1.z.object({
    itemId: zod_1.z.string().min(1),
    endDate: zod_1.z.string().optional(),
});
const restoreSchema = zod_1.z.object({
    itemId: zod_1.z.string().min(1),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(life_storage_setting_entity_1.LifeStorageSettingEntity);
function mapStorageItem(entity) {
    return {
        id: entity.id,
        itemName: entity.item_name,
        purchasePrice: Number(entity.purchase_price),
        purchaseDate: entity.purchase_date,
        endDate: entity.end_date ?? '',
        notes: entity.notes,
        status: entity.status,
        archivedAt: entity.archived_at?.toISOString() ?? '',
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function calculateUsageDays(item) {
    const purchase = (0, dayjs_1.default)(item.purchase_date);
    const reference = item.end_date ? (0, dayjs_1.default)(item.end_date) : (0, dayjs_1.default)().startOf('day');
    const safeReference = reference.isBefore(purchase, 'day') ? purchase : reference;
    return Math.max(1, safeReference.startOf('day').diff(purchase.startOf('day'), 'day') + 1);
}
function calculateDailyCost(item) {
    return Number((Number(item.purchase_price) / calculateUsageDays(item)).toFixed(2));
}
function buildOverview(items, settings) {
    const dashboardItems = settings.include_archived_in_dashboard
        ? items
        : items.filter((item) => item.status === 'active');
    const highest = dashboardItems
        .map((item) => ({
        name: item.item_name,
        cost: calculateDailyCost(item),
    }))
        .sort((left, right) => right.cost - left.cost)[0];
    const totalUsageDays = dashboardItems.reduce((sum, item) => sum + calculateUsageDays(item), 0);
    return {
        totalCount: items.length,
        activeCount: items.filter((item) => item.status === 'active').length,
        archivedCount: items.filter((item) => item.status === 'archived').length,
        totalPurchaseAmount: Number(dashboardItems.reduce((sum, item) => sum + Number(item.purchase_price), 0).toFixed(2)),
        currentDailyCostTotal: Number(dashboardItems.reduce((sum, item) => sum + calculateDailyCost(item), 0).toFixed(2)),
        averageUsageDays: dashboardItems.length ? Math.round(totalUsageDays / dashboardItems.length) : 0,
        currentMonthNewCount: items.filter((item) => (0, dayjs_1.default)(item.purchase_date).isSame((0, dayjs_1.default)(), 'month')).length,
        highestDailyCostItemName: highest?.name ?? '',
        highestDailyCost: highest?.cost ?? 0,
    };
}
function buildPurchaseTrend(items) {
    return Array.from({ length: 12 }, (_, index) => {
        const month = (0, dayjs_1.default)().subtract(11 - index, 'month');
        const matched = items.filter((item) => (0, dayjs_1.default)(item.purchase_date).format('YYYY-MM') === month.format('YYYY-MM'));
        return {
            month: month.format('YYYY-MM'),
            label: month.format('MM月'),
            amount: Number(matched.reduce((sum, item) => sum + Number(item.purchase_price), 0).toFixed(2)),
            count: matched.length,
        };
    });
}
function buildCostRanking(items) {
    return items
        .map((item) => ({
        id: item.id,
        itemName: item.item_name,
        purchasePrice: Number(item.purchase_price),
        usageDays: calculateUsageDays(item),
        dailyCost: calculateDailyCost(item),
        purchaseDate: item.purchase_date,
        endDate: item.end_date ?? '',
        status: item.status,
    }))
        .sort((left, right) => right.dailyCost - left.dailyCost);
}
function createStorageRouter() {
    const router = (0, express_1.Router)();
    router.get('/items', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
        const status = String(request.query.status ?? '').trim();
        const purchaseStartDate = String(request.query.purchaseStartDate ?? '').trim();
        const purchaseEndDate = String(request.query.purchaseEndDate ?? '').trim();
        const minPrice = Number(request.query.minPrice ?? '');
        const maxPrice = Number(request.query.maxPrice ?? '');
        const repository = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
        const items = await repository.find({
            where: {
                user_id: userId,
            },
            order: {
                updated_at: 'DESC',
            },
        });
        const filtered = items.filter((item) => {
            if (status && status !== 'all' && item.status !== status) {
                return false;
            }
            if (keyword) {
                const haystack = [item.item_name, item.notes].join(' ').toLowerCase();
                if (!haystack.includes(keyword)) {
                    return false;
                }
            }
            if (purchaseStartDate && (0, dayjs_1.default)(item.purchase_date).isBefore(purchaseStartDate, 'day')) {
                return false;
            }
            if (purchaseEndDate && (0, dayjs_1.default)(item.purchase_date).isAfter(purchaseEndDate, 'day')) {
                return false;
            }
            if (Number.isFinite(minPrice) && Number(item.purchase_price) < minPrice) {
                return false;
            }
            if (Number.isFinite(maxPrice) && Number(item.purchase_price) > maxPrice) {
                return false;
            }
            return true;
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(filtered.slice(skip, skip + pageSize).map(mapStorageItem), page, pageSize, filtered.length)));
    }));
    router.post('/items', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(itemSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
        const endDate = payload.endDate ? (0, date_1.normalizeDate)(payload.endDate, (0, date_1.normalizeDate)(payload.purchaseDate)) : null;
        const item = await repository.save(repository.create({
            user_id: userId,
            item_name: payload.itemName,
            purchase_price: payload.purchasePrice,
            purchase_date: (0, date_1.normalizeDate)(payload.purchaseDate),
            end_date: endDate,
            notes: payload.notes,
            status: endDate ? 'archived' : 'active',
            archived_at: endDate ? new Date() : null,
        }));
        response.json((0, response_1.successResponse)(mapStorageItem(item), 'create_storage_item_success'));
    }));
    router.patch('/items/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const itemId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(itemSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
        const current = await repository.findOne({
            where: {
                id: itemId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('storage_item_not_found', 404, 404);
        }
        const purchaseDate = payload.purchaseDate ? (0, date_1.normalizeDate)(payload.purchaseDate) : current.purchase_date;
        const endDate = payload.endDate !== undefined
            ? (payload.endDate ? (0, date_1.normalizeDate)(payload.endDate, purchaseDate) : null)
            : current.end_date;
        const next = await repository.save({
            ...current,
            item_name: payload.itemName ?? current.item_name,
            purchase_price: payload.purchasePrice ?? current.purchase_price,
            purchase_date: purchaseDate,
            end_date: endDate,
            notes: payload.notes ?? current.notes,
            status: endDate ? 'archived' : 'active',
            archived_at: endDate ? (current.archived_at ?? new Date()) : null,
        });
        response.json((0, response_1.successResponse)(mapStorageItem(next), 'update_storage_item_success'));
    }));
    router.delete('/items/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const itemId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
        const current = await repository.findOne({
            where: {
                id: itemId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('storage_item_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_storage_item_success'));
    }));
    router.get('/overview', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const itemRepo = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
        const items = await itemRepo.find({
            where: {
                user_id: userId,
            },
        });
        const settings = await settingService.getOrCreate(userId, {
            include_archived_in_dashboard: true,
            default_sort: 'latest',
            default_dashboard_range: 'all',
        });
        response.json((0, response_1.successResponse)(buildOverview(items, settings)));
    }));
    router.get('/purchase-trend', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const itemRepo = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
        const items = await itemRepo.find({
            where: {
                user_id: userId,
            },
        });
        response.json((0, response_1.successResponse)(buildPurchaseTrend(items)));
    }));
    router.get('/cost-ranking', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const itemRepo = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
        const items = await itemRepo.find({
            where: {
                user_id: userId,
            },
        });
        response.json((0, response_1.successResponse)(buildCostRanking(items)));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            include_archived_in_dashboard: true,
            default_sort: 'latest',
            default_dashboard_range: 'all',
        });
        response.json((0, response_1.successResponse)({
            includeArchivedInDashboard: settings.include_archived_in_dashboard,
            defaultSort: settings.default_sort,
            defaultDashboardRange: settings.default_dashboard_range,
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            include_archived_in_dashboard: payload.includeArchivedInDashboard,
            default_sort: payload.defaultSort,
            default_dashboard_range: payload.defaultDashboardRange,
        }, {
            include_archived_in_dashboard: true,
            default_sort: 'latest',
            default_dashboard_range: 'all',
        });
        response.json((0, response_1.successResponse)({
            includeArchivedInDashboard: settings.include_archived_in_dashboard,
            defaultSort: settings.default_sort,
            defaultDashboardRange: settings.default_dashboard_range,
        }, 'update_storage_settings_success'));
    }));
    router.post('/actions/archive', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(archiveSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
        const current = await repository.findOne({
            where: {
                id: payload.itemId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('storage_item_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            end_date: (0, date_1.normalizeDate)(payload.endDate, (0, dayjs_1.default)().format(date_1.DATE_FORMAT)),
            status: 'archived',
            archived_at: new Date(),
        });
        response.json((0, response_1.successResponse)(mapStorageItem(next), 'archive_storage_item_success'));
    }));
    router.post('/actions/restore', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(restoreSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(life_storage_item_entity_1.LifeStorageItemEntity);
        const current = await repository.findOne({
            where: {
                id: payload.itemId,
                user_id: userId,
            },
        });
        if (!current) {
            throw new app_error_1.AppError('storage_item_not_found', 404, 404);
        }
        const next = await repository.save({
            ...current,
            end_date: null,
            status: 'active',
            archived_at: null,
        });
        response.json((0, response_1.successResponse)(mapStorageItem(next), 'restore_storage_item_success'));
    }));
    return router;
}
