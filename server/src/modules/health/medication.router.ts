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
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { AppError } from '../../shared/errors/app-error';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { HealthMedicationPurchaseEntity } from './entities/health-medication-purchase.entity';
import { HealthMedicationRecordEntity } from './entities/health-medication-record.entity';
import { HealthMedicationSettingEntity } from './entities/health-medication-setting.entity';
import { HealthMedicationSummaryEntity } from './entities/health-medication-summary.entity';
import { HealthMedicationThresholdEntity } from './entities/health-medication-threshold.entity';

const recordSchema = z.object({
  userId: z.string().trim().optional(),
  date: z.string().min(1),
  medicineName: z.string().trim().min(1).max(128),
  breakfast: z.number().min(0).max(100).optional().default(0),
  lunch: z.number().min(0).max(100).optional().default(0),
  dinner: z.number().min(0).max(100).optional().default(0),
});

const purchaseSchema = z.object({
  userId: z.string().trim().optional(),
  purchaseDate: z.string().min(1),
  medicineName: z.string().trim().min(1).max(128),
  quantity: z.number().min(0).int().max(10000),
  unit: z.string().trim().min(1).max(32),
  unitPrice: z.number().min(0).max(100000),
  totalPrice: z.number().min(0).max(1000000).optional(),
  channel: z.string().trim().min(1).max(128),
});

const summarySchema = z.object({
  userId: z.string().trim().optional(),
  date: z.string().min(1),
  content: z.string().trim().min(1),
});

const settingsSchema = z.object({
  activeUserId: z.string().optional(),
  recordsUserId: z.string().optional(),
  purchaseUserId: z.string().optional(),
  analysisUserId: z.string().optional(),
  summaryUserId: z.string().optional(),
  doseReminderEnabled: z.boolean().optional(),
  stockReminderEnabled: z.boolean().optional(),
  breakfastReminderTime: z.string().optional(),
  lunchReminderTime: z.string().optional(),
  dinnerReminderTime: z.string().optional(),
  defaultStockThreshold: z.number().min(0).optional(),
});

const thresholdSchema = z.object({
  medicineName: z.string().trim().min(1).max(128),
  threshold: z.number().min(0).int().max(1000),
});

const triggerSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  message: z.string().trim().optional(),
});

const settingService = new BaseUserSettingService(HealthMedicationSettingEntity);

function mapRecord(entity: HealthMedicationRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    date: dayjs(entity.date).format('YYYY-MM-DD'),
    medicineName: entity.medicine_name,
    breakfast: Number(entity.breakfast),
    lunch: Number(entity.lunch),
    dinner: Number(entity.dinner),
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function mapPurchase(entity: HealthMedicationPurchaseEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    purchaseDate: dayjs(entity.purchase_date).format('YYYY-MM-DD'),
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

function mapSummary(entity: HealthMedicationSummaryEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    date: dayjs(entity.date).format('YYYY-MM-DD'),
    content: entity.content,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function buildStockSummary(
  records: HealthMedicationRecordEntity[],
  purchases: HealthMedicationPurchaseEntity[],
  thresholds: HealthMedicationThresholdEntity[],
  defaultThreshold: number,
) {
  const usedMap = new Map<string, number>();
  const purchasedMap = new Map<string, { quantity: number; unit: string | null; mixedUnit: boolean }>();
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
    const priority = { low: 0, mixed_unit: 1, no_purchase: 2, ok: 3 } as const;
    return priority[left.status as keyof typeof priority] - priority[right.status as keyof typeof priority];
  });
}

export function createMedicationRouter() {
  const router = Router();

  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(HealthMedicationRecordEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { date: 'DESC', updated_at: 'DESC' },
    });

    response.json(successResponse(buildListData(items.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, items.length)));
  }));

  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);
    const repository = appDataSource.getRepository(HealthMedicationRecordEntity);
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      date: normalizeDate(payload.date),
      medicine_name: payload.medicineName,
      breakfast: payload.breakfast,
      lunch: payload.lunch,
      dinner: payload.dinner,
    }));

    response.json(successResponse(mapRecord(item), 'create_medication_record_success'));
  }));

  router.patch('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const payload = validateBody(recordSchema.partial(), request.body);
    const repository = appDataSource.getRepository(HealthMedicationRecordEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('medication_record_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      date: payload.date ? normalizeDate(payload.date) : current.date,
      medicine_name: payload.medicineName ?? current.medicine_name,
      breakfast: payload.breakfast ?? current.breakfast,
      lunch: payload.lunch ?? current.lunch,
      dinner: payload.dinner ?? current.dinner,
    });

    response.json(successResponse(mapRecord(next), 'update_medication_record_success'));
  }));

  router.delete('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(HealthMedicationRecordEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('medication_record_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_medication_record_success'));
  }));

  router.get('/purchases', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(HealthMedicationPurchaseEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { purchase_date: 'DESC', updated_at: 'DESC' },
    });

    response.json(successResponse(buildListData(items.slice(skip, skip + pageSize).map(mapPurchase), page, pageSize, items.length)));
  }));

  router.post('/purchases', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(purchaseSchema, request.body);
    const repository = appDataSource.getRepository(HealthMedicationPurchaseEntity);
    const totalPrice = payload.totalPrice ?? Number((payload.quantity * payload.unitPrice).toFixed(2));
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      purchase_date: normalizeDate(payload.purchaseDate),
      medicine_name: payload.medicineName,
      quantity: payload.quantity,
      unit: payload.unit,
      unit_price: payload.unitPrice,
      total_price: totalPrice,
      channel: payload.channel,
    }));

    response.json(successResponse(mapPurchase(item), 'create_medication_purchase_success'));
  }));

  router.patch('/purchases/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const payload = validateBody(purchaseSchema.partial(), request.body);
    const repository = appDataSource.getRepository(HealthMedicationPurchaseEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('medication_purchase_not_found', 404, 404);
    }

    const nextQuantity = payload.quantity ?? Number(current.quantity);
    const nextUnitPrice = payload.unitPrice ?? Number(current.unit_price);
    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      purchase_date: payload.purchaseDate ? normalizeDate(payload.purchaseDate) : current.purchase_date,
      medicine_name: payload.medicineName ?? current.medicine_name,
      quantity: nextQuantity,
      unit: payload.unit ?? current.unit,
      unit_price: nextUnitPrice,
      total_price: payload.totalPrice ?? Number((nextQuantity * nextUnitPrice).toFixed(2)),
      channel: payload.channel ?? current.channel,
    });

    response.json(successResponse(mapPurchase(next), 'update_medication_purchase_success'));
  }));

  router.delete('/purchases/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(HealthMedicationPurchaseEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('medication_purchase_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_medication_purchase_success'));
  }));

  router.get('/summaries', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const repository = appDataSource.getRepository(HealthMedicationSummaryEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { date: 'DESC', updated_at: 'DESC' },
    });

    response.json(successResponse(buildListData(items.map(mapSummary))));
  }));

  router.post('/summaries', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(summarySchema, request.body);
    const repository = appDataSource.getRepository(HealthMedicationSummaryEntity);
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      date: normalizeDate(payload.date),
      content: payload.content,
    }));

    response.json(successResponse(mapSummary(item), 'create_medication_summary_success'));
  }));

  router.patch('/summaries/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const payload = validateBody(summarySchema.partial(), request.body);
    const repository = appDataSource.getRepository(HealthMedicationSummaryEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('medication_summary_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      date: payload.date ? normalizeDate(payload.date) : current.date,
      content: payload.content ?? current.content,
    });

    response.json(successResponse(mapSummary(next), 'update_medication_summary_success'));
  }));

  router.delete('/summaries/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(HealthMedicationSummaryEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('medication_summary_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_medication_summary_success'));
  }));

  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const [records, purchases] = await Promise.all([
      appDataSource.getRepository(HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
    ]);
    const today = dayjs().format('YYYY-MM-DD');
    const totalDosage = records.reduce((sum, item) => sum + Number(item.breakfast) + Number(item.lunch) + Number(item.dinner), 0);
    const trackedDays = new Set(records.map((item) => dayjs(item.date).format('YYYY-MM-DD'))).size;

    response.json(successResponse({
      totalRecords: records.length,
      totalDosage,
      trackedDays,
      avgDailyDosage: trackedDays ? Number((totalDosage / trackedDays).toFixed(1)) : 0,
      activeMedicineCount: new Set(records.map((item) => item.medicine_name)).size,
      purchaseCount: purchases.length,
      totalPurchaseAmount: Number(purchases.reduce((sum, item) => sum + Number(item.total_price), 0).toFixed(2)),
      latestRecordDate: records[0] ? dayjs(records[0].date).format('YYYY-MM-DD') : null,
      todayDosage: records.filter((item) => dayjs(item.date).format('YYYY-MM-DD') === today).reduce((sum, item) => sum + Number(item.breakfast) + Number(item.lunch) + Number(item.dinner), 0),
    }));
  }));

  router.get('/analysis', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const [records, purchases] = await Promise.all([
      appDataSource.getRepository(HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
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

    const recentDays = new Set(records.filter((item) => dayjs(item.date).isAfter(dayjs().subtract(7, 'day'))).map((item) => item.date)).size;
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

    response.json(successResponse(insights));
  }));

  router.get('/stock', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
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
      appDataSource.getRepository(HealthMedicationRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationPurchaseEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(HealthMedicationThresholdEntity).find({ where: { user_id: userId } }),
    ]);

    response.json(successResponse(buildStockSummary(records, purchases, thresholds, Number(settings.default_stock_threshold))));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
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
    const thresholds = await appDataSource.getRepository(HealthMedicationThresholdEntity).find({ where: { user_id: userId } });

    response.json(successResponse({
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

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
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

    response.json(successResponse({
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

  router.get('/thresholds', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const items = await appDataSource.getRepository(HealthMedicationThresholdEntity).find({ where: { user_id: userId } });
    response.json(successResponse(buildListData(items.map((item) => ({
      id: item.id,
      medicineName: item.medicine_name,
      threshold: Number(item.threshold),
      createdAt: item.created_at.toISOString(),
      updatedAt: item.updated_at.toISOString(),
    })))));
  }));

  router.post('/thresholds', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(thresholdSchema, request.body);
    const repository = appDataSource.getRepository(HealthMedicationThresholdEntity);
    const item = await repository.save(repository.create({
      user_id: userId,
      medicine_name: payload.medicineName,
      threshold: payload.threshold,
    }));
    response.json(successResponse({
      id: item.id,
      medicineName: item.medicine_name,
      threshold: Number(item.threshold),
      createdAt: item.created_at.toISOString(),
      updatedAt: item.updated_at.toISOString(),
    }, 'create_medication_threshold_success'));
  }));

  router.patch('/thresholds/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const payload = validateBody(thresholdSchema.partial(), request.body);
    const repository = appDataSource.getRepository(HealthMedicationThresholdEntity);
    const current = await repository.findOne({ where: { id: entityId, user_id: userId } });

    if (!current) {
      throw new AppError('medication_threshold_not_found', 404, 404);
    }

    const item = await repository.save({
      ...current,
      medicine_name: payload.medicineName ?? current.medicine_name,
      threshold: payload.threshold ?? current.threshold,
    });

    response.json(successResponse({
      id: item.id,
      medicineName: item.medicine_name,
      threshold: Number(item.threshold),
      createdAt: item.created_at.toISOString(),
      updatedAt: item.updated_at.toISOString(),
    }, 'update_medication_threshold_success'));
  }));

  router.delete('/thresholds/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(HealthMedicationThresholdEntity);
    const current = await repository.findOne({ where: { id: entityId, user_id: userId } });

    if (!current) {
      throw new AppError('medication_threshold_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_medication_threshold_success'));
  }));

  router.post('/actions/trigger-dose-reminder', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(triggerSchema, request.body);
    const logs = await sendNotificationSceneLogs({
      userId,
      sceneId: 'medication.dose_reminder',
      title: payload.title ?? '服药提醒',
      message: payload.message ?? '请按计划完成今天的服药安排。',
    });

    response.json(successResponse(logs, 'trigger_medication_dose_reminder_success'));
  }));

  router.post('/actions/trigger-stock-reminder', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(triggerSchema, request.body);
    const logs = await sendNotificationSceneLogs({
      userId,
      sceneId: 'medication.stock_low',
      title: payload.title ?? '药品低库存提醒',
      message: payload.message ?? '检测到药品库存已低于提醒阈值，请及时补货。',
    });

    response.json(successResponse(logs, 'trigger_medication_stock_reminder_success'));
  }));

  return router;
}
