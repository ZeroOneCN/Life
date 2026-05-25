import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { parsePagination } from '../../shared/utils/pagination';
import { normalizeDate } from '../../shared/utils/date';
import { AppError } from '../../shared/errors/app-error';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { FinanceShoppingImportBatchEntity } from './entities/finance-shopping-import-batch.entity';
import { FinanceShoppingLedgerEntity } from './entities/finance-shopping-ledger.entity';
import { FinanceShoppingPlatformEntity } from './entities/finance-shopping-platform.entity';
import { FinanceShoppingRecordEntity } from './entities/finance-shopping-record.entity';
import { FinanceShoppingSettingEntity } from './entities/finance-shopping-setting.entity';

const recordSchema = z.object({
  userId: z.string().trim().optional(),
  ledgerId: z.string().trim().min(1),
  date: z.string().min(1),
  platform: z.string().trim().min(1).max(128),
  itemName: z.string().trim().min(1).max(255),
  spec: z.string().optional().default(''),
  price: z.number().min(0),
  unitPrice: z.number().nullable().optional(),
  orderNo: z.string().optional().default(''),
  note: z.string().optional().default(''),
});

const ledgerSchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().optional().default(''),
  startDate: z.string().min(1),
  endDate: z.string().optional().default(''),
  isActive: z.boolean().optional().default(false),
});

const platformSchema = z.object({
  name: z.string().trim().min(1).max(128),
  colorToken: z.string().trim().optional().nullable(),
  isBuiltIn: z.boolean().optional().default(false),
});

const settingsSchema = z.object({
  activeUserId: z.string().optional(),
  recordsUserId: z.string().optional(),
  dashboardUserId: z.string().optional(),
  activeLedgerId: z.string().optional(),
  recordsLedgerId: z.string().optional(),
  dashboardLedgerId: z.string().optional(),
  currencyMode: z.string().optional(),
  usdtRate: z.number().optional(),
});

const importRowSchema = z.object({
  userId: z.string().trim().optional(),
  ledgerId: z.string().trim().optional(),
  date: z.string().optional(),
  platform: z.string().trim().optional(),
  itemName: z.string().trim().optional(),
  spec: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  unitPrice: z.union([z.number(), z.string()]).nullable().optional(),
  orderNo: z.string().optional(),
  note: z.string().optional(),
});

const importSchema = z.object({
  fileName: z.string().trim().optional().default('shopping-import.json'),
  rows: z.array(importRowSchema).default([]),
});

const settingService = new BaseUserSettingService(FinanceShoppingSettingEntity);

function toMoney(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function mapRecord(entity: FinanceShoppingRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    ledgerId: entity.ledger_id,
    date: entity.date,
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

function mapLedger(entity: FinanceShoppingLedgerEntity) {
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

function mapPlatform(entity: FinanceShoppingPlatformEntity) {
  return {
    id: entity.id,
    name: entity.name,
    colorToken: entity.color_token ?? '',
    isBuiltIn: entity.is_built_in,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function buildRecordKey(item: {
  userId: string;
  ledgerId: string;
  date: string;
  platform: string;
  itemName: string;
  price: number;
  orderNo: string;
}) {
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

export function createShoppingRouter() {
  const router = Router();

  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const ledgerId = String(request.query.ledgerId ?? 'all');
    const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(FinanceShoppingRecordEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { date: 'DESC', updated_at: 'DESC' },
    });

    const filtered = items
      .filter((item) => ledgerId === 'all' || item.ledger_id === ledgerId)
      .filter((item) => !keyword || [item.platform, item.item_name, item.spec, item.order_no, item.note].some((value) => value.toLowerCase().includes(keyword)));

    response.json(successResponse(buildListData(filtered.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, filtered.length)));
  }));

  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);
    const repository = appDataSource.getRepository(FinanceShoppingRecordEntity);
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      ledger_id: payload.ledgerId,
      date: normalizeDate(payload.date),
      platform: payload.platform,
      item_name: payload.itemName,
      spec: payload.spec,
      price: payload.price,
      unit_price: payload.unitPrice ?? null,
      order_no: payload.orderNo,
      note: payload.note,
    }));

    response.json(successResponse(mapRecord(item), 'create_shopping_record_success'));
  }));

  router.patch('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const payload = validateBody(recordSchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceShoppingRecordEntity);
    const current = await repository.findOne({
      where: { id: recordId, user_id: userId },
    });

    if (!current) {
      throw new AppError('shopping_record_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      ledger_id: payload.ledgerId ?? current.ledger_id,
      date: payload.date ? normalizeDate(payload.date) : current.date,
      platform: payload.platform ?? current.platform,
      item_name: payload.itemName ?? current.item_name,
      spec: payload.spec ?? current.spec,
      price: payload.price ?? current.price,
      unit_price: payload.unitPrice !== undefined ? payload.unitPrice : current.unit_price,
      order_no: payload.orderNo ?? current.order_no,
      note: payload.note ?? current.note,
    });

    response.json(successResponse(mapRecord(next), 'update_shopping_record_success'));
  }));

  router.delete('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceShoppingRecordEntity);
    const current = await repository.findOne({
      where: { id: recordId, user_id: userId },
    });

    if (!current) {
      throw new AppError('shopping_record_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_shopping_record_success'));
  }));

  router.get('/ledgers', asyncHandler(async (_request: AuthenticatedRequest, response) => {
    const repository = appDataSource.getRepository(FinanceShoppingLedgerEntity);
    const items = await repository.find({
      order: { is_active: 'DESC', updated_at: 'DESC' },
    });
    response.json(successResponse(buildListData(items.map(mapLedger))));
  }));

  router.post('/ledgers', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = validateBody(ledgerSchema, request.body);
    const repository = appDataSource.getRepository(FinanceShoppingLedgerEntity);

    if (payload.isActive) {
      const activeLedgers = await repository.find({ where: { is_active: true } });
      if (activeLedgers.length) {
        await repository.save(activeLedgers.map((item) => ({ ...item, is_active: false })));
      }
    }

    const item = await repository.save(repository.create({
      name: payload.name,
      description: payload.description,
      start_date: normalizeDate(payload.startDate),
      end_date: payload.endDate ? normalizeDate(payload.endDate) : null,
      is_active: payload.isActive,
    }));

    response.json(successResponse(mapLedger(item), 'create_shopping_ledger_success'));
  }));

  router.patch('/ledgers/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const ledgerId = String(request.params.id ?? '');
    const payload = validateBody(ledgerSchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceShoppingLedgerEntity);
    const current = await repository.findOne({ where: { id: ledgerId } });

    if (!current) {
      throw new AppError('shopping_ledger_not_found', 404, 404);
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
      start_date: payload.startDate ? normalizeDate(payload.startDate) : current.start_date,
      end_date: payload.endDate !== undefined ? (payload.endDate ? normalizeDate(payload.endDate) : null) : current.end_date,
      is_active: payload.isActive ?? current.is_active,
    });

    response.json(successResponse(mapLedger(next), 'update_shopping_ledger_success'));
  }));

  router.delete('/ledgers/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const ledgerId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceShoppingLedgerEntity);
    const current = await repository.findOne({ where: { id: ledgerId } });

    if (!current) {
      throw new AppError('shopping_ledger_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_shopping_ledger_success'));
  }));

  router.get('/platforms', asyncHandler(async (_request: AuthenticatedRequest, response) => {
    const repository = appDataSource.getRepository(FinanceShoppingPlatformEntity);
    const items = await repository.find({
      order: { is_built_in: 'DESC', name: 'ASC' },
    });
    response.json(successResponse(buildListData(items.map(mapPlatform))));
  }));

  router.post('/platforms', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = validateBody(platformSchema, request.body);
    const repository = appDataSource.getRepository(FinanceShoppingPlatformEntity);
    const item = await repository.save(repository.create({
      name: payload.name,
      color_token: payload.colorToken ?? null,
      is_built_in: payload.isBuiltIn,
    }));

    response.json(successResponse(mapPlatform(item), 'create_shopping_platform_success'));
  }));

  router.patch('/platforms/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const platformId = String(request.params.id ?? '');
    const payload = validateBody(platformSchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceShoppingPlatformEntity);
    const current = await repository.findOne({ where: { id: platformId } });

    if (!current) {
      throw new AppError('shopping_platform_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      name: payload.name ?? current.name,
      color_token: payload.colorToken !== undefined ? payload.colorToken : current.color_token,
      is_built_in: payload.isBuiltIn ?? current.is_built_in,
    });

    response.json(successResponse(mapPlatform(next), 'update_shopping_platform_success'));
  }));

  router.delete('/platforms/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const platformId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceShoppingPlatformEntity);
    const current = await repository.findOne({ where: { id: platformId } });

    if (!current) {
      throw new AppError('shopping_platform_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_shopping_platform_success'));
  }));

  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const ledgerId = String(request.query.ledgerId ?? 'all');
    const repository = appDataSource.getRepository(FinanceShoppingRecordEntity);
    const records = await repository.find({ where: { user_id: userId } });
    const filtered = records.filter((item) => ledgerId === 'all' || item.ledger_id === ledgerId);
    const currentMonth = dayjs().format('YYYY-MM');

    response.json(successResponse({
      currentMonthOrders: filtered.filter((item) => dayjs(item.date).format('YYYY-MM') === currentMonth).length,
      currentMonthAmount: Number(filtered.filter((item) => dayjs(item.date).format('YYYY-MM') === currentMonth).reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)),
      totalAmount: Number(filtered.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)),
      totalOrders: filtered.length,
      activePlatformCount: new Set(filtered.map((item) => item.platform)).size,
      trackedMonths: new Set(filtered.map((item) => dayjs(item.date).format('YYYY-MM'))).size,
    }));
  }));

  router.get('/monthly-trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const ledgerId = String(request.query.ledgerId ?? 'all');
    const repository = appDataSource.getRepository(FinanceShoppingRecordEntity);
    const records = (await repository.find({ where: { user_id: userId } }))
      .filter((item) => ledgerId === 'all' || item.ledger_id === ledgerId);

    const items = Array.from({ length: 12 }, (_, index) => {
      const month = dayjs().subtract(11 - index, 'month').format('YYYY-MM');
      const scoped = records.filter((item) => dayjs(item.date).format('YYYY-MM') === month);
      return {
        month,
        label: dayjs(`${month}-01`).format('MM月'),
        amount: Number(scoped.reduce((sum, item) => sum + Number(item.price), 0).toFixed(2)),
        orderCount: scoped.length,
      };
    });

    response.json(successResponse(items));
  }));

  router.get('/platform-breakdown', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const ledgerId = String(request.query.ledgerId ?? 'all');
    const [records, platforms] = await Promise.all([
      appDataSource.getRepository(FinanceShoppingRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceShoppingPlatformEntity).find(),
    ]);
    const filtered = records.filter((item) => ledgerId === 'all' || item.ledger_id === ledgerId);
    const platformMap = new Map(platforms.map((item) => [item.name, item.color_token ?? '']));
    const grouped = new Map<string, { amount: number; count: number }>();

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

    response.json(successResponse(items));
  }));

  router.get('/ledger-summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const [records, ledgers] = await Promise.all([
      appDataSource.getRepository(FinanceShoppingRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(FinanceShoppingLedgerEntity).find(),
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

    response.json(successResponse(items));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
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

    response.json(successResponse({
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

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
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

    response.json(successResponse({
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

  router.post('/actions/import', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(importSchema, request.body);
    const rows = payload.rows ?? [];
    const recordRepo = appDataSource.getRepository(FinanceShoppingRecordEntity);
    const batchRepo = appDataSource.getRepository(FinanceShoppingImportBatchEntity);
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
    const toSave: FinanceShoppingRecordEntity[] = [];

    rows.forEach((row) => {
      const userId = row.userId ?? authUserId;
      const ledgerId = row.ledgerId ?? '';
      const date = row.date ? normalizeDate(row.date) : '';
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

    response.json(successResponse({
      total_rows: rows.length,
      imported_count: importedCount,
      duplicate_count: duplicateCount,
      invalid_count: invalidCount,
    }, 'import_shopping_records_success'));
  }));

  return router;
}
