import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { LifeStorageItemEntity } from './entities/life-storage-item.entity';
import { LifeStorageSettingEntity } from './entities/life-storage-setting.entity';
import { FinanceShoppingRecordEntity } from '../finance/entities/finance-shopping-record.entity';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { parsePagination } from '../../shared/utils/pagination';
import { normalizeDate, DATE_FORMAT } from '../../shared/utils/date';
import { AppError } from '../../shared/errors/app-error';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';

const itemSchema = z.object({
  itemName: z.string().trim().min(1).max(255),
  purchasePrice: z.number().positive(),
  purchaseDate: z.string().min(1),
  endDate: z.string().refine((val) => {
    if (!val || val.trim() === '') return true;
    return dayjs(val, 'YYYY-MM-DD', true).isValid() || dayjs(val, 'YYYY/MM/DD', true).isValid();
  }, { message: 'endDate 格式无效，应为 YYYY-MM-DD 或 YYYY/MM/DD' }).optional().default(''),
  notes: z.string().optional().default(''),
});

const settingsSchema = z.object({
  includeArchivedInDashboard: z.boolean().optional(),
  defaultSort: z.enum(['latest', 'purchasePrice', 'dailyCost']).optional(),
  defaultDashboardRange: z.enum(['30d', '90d', '365d', 'all']).optional(),
});

const archiveSchema = z.object({
  itemId: z.string().min(1),
  endDate: z.string().refine((val) => {
    if (!val || val.trim() === '') return true;
    return dayjs(val, 'YYYY-MM-DD', true).isValid() || dayjs(val, 'YYYY/MM/DD', true).isValid();
  }, { message: 'endDate 格式无效，应为 YYYY-MM-DD 或 YYYY/MM/DD' }).optional(),
});

const restoreSchema = z.object({
  itemId: z.string().min(1),
});



const settingService = new BaseUserSettingService(LifeStorageSettingEntity);

function mapStorageItem(entity: LifeStorageItemEntity) {
  return {
    id: entity.id,
    itemName: entity.item_name,
    purchasePrice: Number(entity.purchase_price),
    purchaseDate: entity.purchase_date,
    endDate: entity.end_date ?? '',
    notes: entity.notes,
    status: entity.status,
    archivedAt: entity.archived_at?.toISOString() ?? '',
    source: entity.source ?? 'manual',
    shoppingRecordId: entity.shopping_record_id ?? '',
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function calculateUsageDays(item: Pick<LifeStorageItemEntity, 'purchase_date' | 'end_date'>) {
  const purchase = dayjs(item.purchase_date);
  const reference = item.end_date ? dayjs(item.end_date) : dayjs().startOf('day');
  const safeReference = reference.isBefore(purchase, 'day') ? purchase : reference;
  return Math.max(1, safeReference.startOf('day').diff(purchase.startOf('day'), 'day') + 1);
}

function calculateDailyCost(item: Pick<LifeStorageItemEntity, 'purchase_price' | 'purchase_date' | 'end_date'>) {
  return Number((Number(item.purchase_price) / calculateUsageDays(item)).toFixed(2));
}

function buildOverview(items: LifeStorageItemEntity[], settings: LifeStorageSettingEntity) {
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
    currentMonthNewCount: items.filter((item) => dayjs(item.purchase_date).isSame(dayjs(), 'month')).length,
    highestDailyCostItemName: highest?.name ?? '',
    highestDailyCost: highest?.cost ?? 0,
  };
}

function buildPurchaseTrend(items: LifeStorageItemEntity[]) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = dayjs().subtract(11 - index, 'month');
    const matched = items.filter((item) => dayjs(item.purchase_date).format('YYYY-MM') === month.format('YYYY-MM'));
    return {
      month: month.format('YYYY-MM'),
      label: month.format('MM月'),
      amount: Number(matched.reduce((sum, item) => sum + Number(item.purchase_price), 0).toFixed(2)),
      count: matched.length,
    };
  });
}

function buildCostRanking(items: LifeStorageItemEntity[]) {
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

export function createStorageRouter() {
  const router = Router();

  router.get('/items', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
    const status = String(request.query.status ?? '').trim();
    const source = String(request.query.source ?? '').trim();
    const purchaseStartDate = String(request.query.purchaseStartDate ?? '').trim();
    const purchaseEndDate = String(request.query.purchaseEndDate ?? '').trim();
    const minPrice = Number(request.query.minPrice ?? '');
    const maxPrice = Number(request.query.maxPrice ?? '');

    const validMinPrice = Number.isFinite(minPrice) && minPrice >= 0 ? minPrice : null;
    const validMaxPrice = Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : null;

    const repository = appDataSource.getRepository(LifeStorageItemEntity);
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

      if (source && source !== 'all' && item.source !== source) {
        return false;
      }

      if (keyword) {
        const haystack = [item.item_name, item.notes].join(' ').toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }

      if (purchaseStartDate && dayjs(item.purchase_date).isBefore(purchaseStartDate, 'day')) {
        return false;
      }

      if (purchaseEndDate && dayjs(item.purchase_date).isAfter(purchaseEndDate, 'day')) {
        return false;
      }

      if (validMinPrice !== null && Number(item.purchase_price) < validMinPrice) {
        return false;
      }

      if (validMaxPrice !== null && Number(item.purchase_price) > validMaxPrice) {
        return false;
      }

      return true;
    });

    response.json(successResponse(buildListData(
      filtered.slice(skip, skip + pageSize).map(mapStorageItem),
      page,
      pageSize,
      filtered.length,
    )));
  }));

  router.post('/items', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(itemSchema, request.body);
    const repository = appDataSource.getRepository(LifeStorageItemEntity);
    const endDate = payload.endDate ? normalizeDate(payload.endDate, normalizeDate(payload.purchaseDate)) : null;

    const item = await repository.save(repository.create({
      user_id: userId,
      item_name: payload.itemName,
      purchase_price: payload.purchasePrice,
      purchase_date: normalizeDate(payload.purchaseDate),
      end_date: endDate,
      notes: payload.notes,
      status: endDate ? 'archived' : 'active',
      archived_at: endDate ? new Date() : null,
    }));

    response.json(successResponse(mapStorageItem(item), 'create_storage_item_success'));
  }));

  router.patch('/items/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const itemId = String(request.params.id ?? '');
    const payload = validateBody(itemSchema.partial(), request.body);
    const repository = appDataSource.getRepository(LifeStorageItemEntity);
    const current = await repository.findOne({
      where: {
        id: itemId,
        user_id: userId,
      },
    });

    if (!current) {
      throw new AppError('storage_item_not_found', 404, 404);
    }

    if (current.source === 'shopping') {
      const allowedFields = ['endDate', 'notes'];
      const attemptedChanges = Object.keys(payload).filter((key) => !allowedFields.includes(key));

      if (attemptedChanges.length > 0) {
        throw new AppError('shopping_source_item_restricted', 400, 400, '购物来源物品只能修改结束日期和备注');
      }
    }

    const purchaseDate = payload.purchaseDate ? normalizeDate(payload.purchaseDate) : current.purchase_date;
    const endDate = payload.endDate !== undefined
      ? (payload.endDate ? normalizeDate(payload.endDate, purchaseDate) : null)
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

    response.json(successResponse(mapStorageItem(next), 'update_storage_item_success'));
  }));

  router.delete('/items/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const itemId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(LifeStorageItemEntity);
    const current = await repository.findOne({
      where: {
        id: itemId,
        user_id: userId,
      },
    });

    if (!current) {
      throw new AppError('storage_item_not_found', 404, 404);
    }

    const shoppingRecordId = current.shopping_record_id;

    await repository.remove(current);

    if (shoppingRecordId && current.source === 'shopping') {
      try {
        const shoppingRepo = appDataSource.getRepository(FinanceShoppingRecordEntity);
        const shoppingRecord = await shoppingRepo.findOne({
          where: { id: shoppingRecordId, user_id: userId },
        });
        if (shoppingRecord) {
          await shoppingRepo.remove(shoppingRecord);
        }
      } catch (error) {
        console.error('联动删除购物记录失败:', error);
      }
    }

    response.json(successResponse({ ok: true }, 'delete_storage_item_success'));
  }));

  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const itemRepo = appDataSource.getRepository(LifeStorageItemEntity);
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

    response.json(successResponse(buildOverview(items, settings)));
  }));

  router.get('/purchase-trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const itemRepo = appDataSource.getRepository(LifeStorageItemEntity);
    const items = await itemRepo.find({
      where: {
        user_id: userId,
      },
    });

    response.json(successResponse(buildPurchaseTrend(items)));
  }));

  router.get('/cost-ranking', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const itemRepo = appDataSource.getRepository(LifeStorageItemEntity);
    const items = await itemRepo.find({
      where: {
        user_id: userId,
      },
    });

    response.json(successResponse(buildCostRanking(items)));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      include_archived_in_dashboard: true,
      default_sort: 'latest',
      default_dashboard_range: 'all',
    });

    response.json(successResponse({
      includeArchivedInDashboard: settings.include_archived_in_dashboard,
      defaultSort: settings.default_sort,
      defaultDashboardRange: settings.default_dashboard_range,
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      include_archived_in_dashboard: payload.includeArchivedInDashboard,
      default_sort: payload.defaultSort,
      default_dashboard_range: payload.defaultDashboardRange,
    }, {
      include_archived_in_dashboard: true,
      default_sort: 'latest',
      default_dashboard_range: 'all',
    });

    response.json(successResponse({
      includeArchivedInDashboard: settings.include_archived_in_dashboard,
      defaultSort: settings.default_sort,
      defaultDashboardRange: settings.default_dashboard_range,
    }, 'update_storage_settings_success'));
  }));

  router.post('/actions/archive', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(archiveSchema, request.body);
    const repository = appDataSource.getRepository(LifeStorageItemEntity);
    const current = await repository.findOne({
      where: {
        id: payload.itemId,
        user_id: userId,
      },
    });

    if (!current) {
      throw new AppError('storage_item_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      end_date: normalizeDate(payload.endDate, dayjs().format(DATE_FORMAT)),
      status: 'archived',
      archived_at: new Date(),
    });

    response.json(successResponse(mapStorageItem(next), 'archive_storage_item_success'));
  }));

  router.post('/actions/restore', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(restoreSchema, request.body);
    const repository = appDataSource.getRepository(LifeStorageItemEntity);
    const current = await repository.findOne({
      where: {
        id: payload.itemId,
        user_id: userId,
      },
    });

    if (!current) {
      throw new AppError('storage_item_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      end_date: null,
      status: 'active',
      archived_at: null,
    });

    response.json(successResponse(mapStorageItem(next), 'restore_storage_item_success'));
  }));

  // 一键同步：自动将购物记录与存储物品双向同步
  router.post('/actions/sync-from-shopping', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const shoppingRepo = appDataSource.getRepository(FinanceShoppingRecordEntity);
    const storageRepo = appDataSource.getRepository(LifeStorageItemEntity);

    // 查询该用户所有购物记录
    const allShoppingRecords = await shoppingRepo.find({
      where: { user_id: userId },
    });

    // 查询该用户所有来源为 'shopping' 的存储记录
    const allShoppingStorageItems = await storageRepo.find({
      where: {
        user_id: userId,
        source: 'shopping',
      },
    });

    // 构建购物记录 ID 集合（用于快速查找）
    const shoppingRecordIdSet = new Set(allShoppingRecords.map((r) => r.id));
    // 构建已同步的存储条目映射（shopping_record_id -> storage item）
    const storageByShoppingId = new Map<string, LifeStorageItemEntity>();
    for (const item of allShoppingStorageItems) {
      if (item.shopping_record_id) {
        storageByShoppingId.set(item.shopping_record_id, item);
      }
    }

    let addedCount = 0;
    let removedCount = 0;
    const toAdd: LifeStorageItemEntity[] = [];
    const toRemove: LifeStorageItemEntity[] = [];

    // 1. 遍历购物记录，找出需要新增的存储条目（购物记录存在但存储中没有）
    for (const record of allShoppingRecords) {
      if (!storageByShoppingId.has(record.id)) {
        // 组合备注信息（平台、订单号、规格、备注）
        const notes = [
          '来自购物记录',
          `平台: ${record.platform}`,
          record.order_no ? `订单号: ${record.order_no}` : '',
          record.spec ? `规格: ${record.spec}` : '',
          record.note ? `备注: ${record.note}` : '',
        ].filter(Boolean).join(' | ');

        const item = storageRepo.create({
          user_id: userId,
          item_name: record.item_name,
          purchase_price: record.price,
          purchase_date: record.date,
          end_date: null,
          notes,
          status: 'active',
          archived_at: null,
          source: 'shopping',
          shopping_record_id: record.id,
        });

        toAdd.push(item);
        addedCount += 1;
      }
      // 已存在且匹配 → 跳过（已同步）
    }

    // 2. 遍历存储条目，找出需要删除的（存储中有但购物记录已被删除）
    for (const item of allShoppingStorageItems) {
      if (item.shopping_record_id && !shoppingRecordIdSet.has(item.shopping_record_id)) {
        toRemove.push(item);
        removedCount += 1;
      }
    }

    // 批量执行新增和删除
    if (toAdd.length > 0) {
      await storageRepo.save(toAdd);
    }

    if (toRemove.length > 0) {
      await storageRepo.remove(toRemove);
    }

    // 返回同步统计结果
    response.json(successResponse({
      addedCount,
      removedCount,
      totalCount: addedCount + removedCount,
    }, 'sync_from_shopping_success'));
  }));

  return router;
}
