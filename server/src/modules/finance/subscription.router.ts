import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { FinanceSubscriptionRecordEntity } from './entities/finance-subscription-record.entity';
import { FinanceSubscriptionCategoryEntity } from './entities/finance-subscription-category.entity';
import { FinanceSubscriptionSettingEntity } from './entities/finance-subscription-setting.entity';
import { NotificationCenterLogEntity } from '../notifications/entities/notification-center-log.entity';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { parsePagination } from '../../shared/utils/pagination';
import { normalizeDate } from '../../shared/utils/date';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { AppError } from '../../shared/errors/app-error';

const recordSchema = z.object({
  serviceName: z.string().trim().min(1).max(255),
  planName: z.string().trim().optional().default(''),
  categoryId: z.string().trim().min(1),
  categoryName: z.string().trim().optional().default(''),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  billingCycle: z.enum(['monthly', 'quarterly', 'yearly', 'one_time']),
  cyclePrice: z.number().min(0),
  autoRenew: z.boolean().optional().default(false),
  notes: z.string().optional().default(''),
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(128),
  description: z.string().optional().default(''),
});

const settingsSchema = z.object({
  recordsKeyword: z.string().optional(),
  recordsCategoryId: z.string().optional(),
  recordsStatus: z.enum(['all', 'active', 'upcoming', 'expired']).optional(),
  recordsAutoRenewFilter: z.enum(['all', 'auto', 'manual']).optional(),
  recordsExpiryStartDate: z.string().optional(),
  recordsExpiryEndDate: z.string().optional(),
  dashboardRangeDays: z.union([z.literal(90), z.literal(180), z.literal(365)]).optional(),
  reminderEnabled: z.boolean().optional(),
  expiryDayReminderEnabled: z.boolean().optional(),
  leadDays: z.number().int().min(0).max(90).optional(),
  includeAutoRenewInReminders: z.boolean().optional(),
});

const triggerReminderSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
});

const settingService = new BaseUserSettingService(FinanceSubscriptionSettingEntity);

function getStatus(record: FinanceSubscriptionRecordEntity, leadDays: number) {
  const end = dayjs(record.end_date).startOf('day');
  const today = dayjs().startOf('day');
  if (today.isAfter(end)) {
    return 'expired';
  }
  const diff = end.diff(today, 'day');
  return diff <= leadDays ? 'upcoming' : 'active';
}

function toMonthly(record: FinanceSubscriptionRecordEntity) {
  const amount = Number(record.cycle_price);
  if (record.billing_cycle === 'quarterly') {
    return Number((amount / 3).toFixed(2));
  }
  if (record.billing_cycle === 'yearly') {
    return Number((amount / 12).toFixed(2));
  }
  if (record.billing_cycle === 'one_time') {
    const days = Math.max(1, dayjs(record.end_date).diff(dayjs(record.start_date), 'day') + 1);
    return Number((amount / Math.max(1, days / 30)).toFixed(2));
  }
  return Number(amount.toFixed(2));
}

function toAnnual(record: FinanceSubscriptionRecordEntity) {
  return Number((toMonthly(record) * 12).toFixed(2));
}

function mapRecord(entity: FinanceSubscriptionRecordEntity) {
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

function mapCategory(entity: FinanceSubscriptionCategoryEntity) {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function buildOverview(records: FinanceSubscriptionRecordEntity[], leadDays: number) {
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
    } else if (status === 'upcoming') {
      summary.upcomingCount += 1;
    } else {
      summary.expiredCount += 1;
    }
    if (!summary.nearestExpiryDate || dayjs(record.end_date).isBefore(dayjs(summary.nearestExpiryDate), 'day')) {
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

export function createSubscriptionRouter() {
  const router = Router();

  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
    const [items, total] = await repository.findAndCount({
      where: { user_id: userId },
      order: { end_date: 'ASC', updated_at: 'DESC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items.map(mapRecord), page, pageSize, total)));
  }));

  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);
    const categoryRepo = appDataSource.getRepository(FinanceSubscriptionCategoryEntity);
    const recordRepo = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
    const category = await categoryRepo.findOne({
      where: { id: payload.categoryId, user_id: userId },
    });

    const item = await recordRepo.save(recordRepo.create({
      user_id: userId,
      service_name: payload.serviceName,
      plan_name: payload.planName,
      category_id: payload.categoryId,
      category_name: payload.categoryName || category?.name || '',
      start_date: normalizeDate(payload.startDate),
      end_date: normalizeDate(payload.endDate),
      billing_cycle: payload.billingCycle,
      cycle_price: payload.cyclePrice,
      auto_renew: payload.autoRenew,
      notes: payload.notes,
      last_upcoming_reminder_marker: null,
      last_expired_reminder_marker: null,
    }));

    response.json(successResponse(mapRecord(item), 'create_subscription_record_success'));
  }));

  router.patch('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const payload = validateBody(recordSchema.partial(), request.body);
    const recordRepo = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
    const categoryRepo = appDataSource.getRepository(FinanceSubscriptionCategoryEntity);
    const current = await recordRepo.findOne({
      where: { id: recordId, user_id: userId },
    });

    if (!current) {
      throw new AppError('subscription_record_not_found', 404, 404);
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
      start_date: payload.startDate ? normalizeDate(payload.startDate) : current.start_date,
      end_date: payload.endDate ? normalizeDate(payload.endDate) : current.end_date,
      billing_cycle: payload.billingCycle ?? current.billing_cycle,
      cycle_price: payload.cyclePrice ?? current.cycle_price,
      auto_renew: payload.autoRenew ?? current.auto_renew,
      notes: payload.notes ?? current.notes,
    });

    response.json(successResponse(mapRecord(next), 'update_subscription_record_success'));
  }));

  router.delete('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
    const current = await repository.findOne({
      where: { id: recordId, user_id: userId },
    });

    if (!current) {
      throw new AppError('subscription_record_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_subscription_record_success'));
  }));

  router.get('/categories', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(FinanceSubscriptionCategoryEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { name: 'ASC' },
    });

    response.json(successResponse(buildListData(items.map(mapCategory))));
  }));

  router.post('/categories', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(categorySchema, request.body);
    const repository = appDataSource.getRepository(FinanceSubscriptionCategoryEntity);
    const item = await repository.save(repository.create({
      user_id: userId,
      name: payload.name,
      description: payload.description,
    }));

    response.json(successResponse(mapCategory(item), 'create_subscription_category_success'));
  }));

  router.patch('/categories/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const categoryId = String(request.params.id ?? '');
    const payload = validateBody(categorySchema.partial(), request.body);
    const repository = appDataSource.getRepository(FinanceSubscriptionCategoryEntity);
    const current = await repository.findOne({
      where: { id: categoryId, user_id: userId },
    });

    if (!current) {
      throw new AppError('subscription_category_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      name: payload.name ?? current.name,
      description: payload.description ?? current.description,
    });

    response.json(successResponse(mapCategory(next), 'update_subscription_category_success'));
  }));

  router.delete('/categories/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const categoryId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(FinanceSubscriptionCategoryEntity);
    const current = await repository.findOne({
      where: { id: categoryId, user_id: userId },
    });

    if (!current) {
      throw new AppError('subscription_category_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_subscription_category_success'));
  }));

  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
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
    response.json(successResponse(buildOverview(records, settings.lead_days)));
  }));

  router.get('/category-breakdown', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
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

    const grouped = new Map<string, { categoryId: string; categoryName: string; count: number; monthlyAmount: number; annualAmount: number }>();
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

    response.json(successResponse(Array.from(grouped.values()).map((item) => ({
      ...item,
      monthlyAmount: Number(item.monthlyAmount.toFixed(2)),
      annualAmount: Number(item.annualAmount.toFixed(2)),
    })).sort((left, right) => right.annualAmount - left.annualAmount)));
  }));

  router.get('/expiry-timeline', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
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
    const today = dayjs().startOf('day');
    const end = today.add(settings.dashboard_range_days, 'day');
    const bucket = new Map<string, { date: string; label: string; count: number; annualAmount: number; monthlyAmount: number; services: string[] }>();

    records.forEach((record) => {
      const date = dayjs(record.end_date).startOf('day');
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

    response.json(successResponse(Array.from(bucket.values()).map((item) => ({
      ...item,
      annualAmount: Number(item.annualAmount.toFixed(2)),
      monthlyAmount: Number(item.monthlyAmount.toFixed(2)),
    })).sort((left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf())));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
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

    response.json(successResponse({
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

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      records_keyword: payload.recordsKeyword,
      records_category_id: payload.recordsCategoryId,
      records_status: payload.recordsStatus,
      records_auto_renew_filter: payload.recordsAutoRenewFilter,
      records_expiry_start_date: payload.recordsExpiryStartDate ? normalizeDate(payload.recordsExpiryStartDate) : undefined,
      records_expiry_end_date: payload.recordsExpiryEndDate ? normalizeDate(payload.recordsExpiryEndDate) : undefined,
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

    response.json(successResponse({
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

  router.get('/reminders', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
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
    const today = dayjs().startOf('day');

    const items = records.flatMap((record) => {
      const end = dayjs(record.end_date).startOf('day');
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

    response.json(successResponse(items));
  }));

  router.post('/actions/trigger-reminders', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(triggerReminderSchema, request.body);
    const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);
    const logs = await Promise.all([
      logRepo.save(logRepo.create({
        user_id: userId,
        channel: 'email',
        scene_id: 'subscription.renewal_upcoming',
        kind: 'scene',
        status: 'success',
        title: payload.title ?? '订阅即将到期',
        message: '已手动触发订阅即将到期提醒。',
      })),
      logRepo.save(logRepo.create({
        user_id: userId,
        channel: 'email',
        scene_id: 'subscription.expired',
        kind: 'scene',
        status: 'success',
        title: payload.title ?? '订阅到期提醒',
        message: '已手动触发订阅到期或逾期提醒。',
      })),
    ]);

    response.json(successResponse(logs, 'trigger_subscription_reminders_success'));
  }));

  return router;
}
