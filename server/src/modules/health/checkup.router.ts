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
import { HealthCheckupRecordEntity } from './entities/health-checkup-record.entity';
import { HealthCheckupSettingEntity } from './entities/health-checkup-setting.entity';
import { HealthCheckupTemplateItemEntity } from './entities/health-checkup-template-item.entity';
import { HealthCheckupTemplateEntity } from './entities/health-checkup-template.entity';

const recordSchema = z.object({
  userId: z.string().trim().optional(),
  testDate: z.string().min(1),
  testType: z.string().trim().min(1).max(128),
  testName: z.string().trim().min(1).max(128),
  value: z.number(),
  unit: z.string().trim().min(1).max(64),
  referenceRange: z.string().trim().min(1).max(255),
  notes: z.string().optional().default(''),
  followUpDate: z.string().optional().default(''),
  status: z.string().trim().optional(),
});

const templateItemSchema = z.object({
  id: z.string().optional(),
  testName: z.string().trim().min(1).max(128),
  unit: z.string().trim().min(1).max(64),
  referenceRange: z.string().trim().min(1).max(255),
});

const templateSchema = z.object({
  userId: z.string().trim().optional(),
  name: z.string().trim().min(1).max(128),
  testType: z.string().trim().min(1).max(128),
  items: z.array(templateItemSchema).default([]),
});

const batchCreateSchema = z.object({
  userId: z.string().trim().optional(),
  templateId: z.string().trim().min(1),
  testDate: z.string().min(1),
  followUpDate: z.string().optional().default(''),
  status: z.string().trim().optional(),
});

const settingsSchema = z.object({
  activeUserId: z.string().optional(),
  recordsUserId: z.string().optional(),
  trendUserId: z.string().optional(),
  insightUserId: z.string().optional(),
  reminderEnabled: z.boolean().optional(),
  abnormalAlertEnabled: z.boolean().optional(),
  followUpLeadDays: z.number().int().min(0).max(90).optional(),
});

const triggerSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  message: z.string().trim().optional(),
});

const settingService = new BaseUserSettingService(HealthCheckupSettingEntity);

function evaluateStatus(value: number, referenceRange: string) {
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

function mapRecord(entity: HealthCheckupRecordEntity) {
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

function mapTemplate(template: HealthCheckupTemplateEntity, items: HealthCheckupTemplateItemEntity[]) {
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

function buildDueFollowUps(records: HealthCheckupRecordEntity[], leadDays: number) {
  const today = dayjs().startOf('day');
  return records
    .filter((item) => item.follow_up_date && (item.status === 'abnormal' || item.status === 'attention'))
    .map((item) => ({
      id: item.id,
      testName: item.test_name,
      testType: item.test_type,
      testDate: item.test_date,
      followUpDate: item.follow_up_date ?? '',
      status: item.status,
      daysUntilDue: dayjs(item.follow_up_date).startOf('day').diff(today, 'day'),
    }))
    .filter((item) => item.daysUntilDue <= leadDays)
    .sort((left, right) => dayjs(left.followUpDate).valueOf() - dayjs(right.followUpDate).valueOf());
}

export function createCheckupRouter() {
  const router = Router();

  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const keyword = String(request.query.keyword ?? '').trim().toLowerCase();
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(HealthCheckupRecordEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { test_date: 'DESC', updated_at: 'DESC' },
    });

    const filtered = items.filter((item) => !keyword || [item.test_type, item.test_name, item.notes, item.status].some((value) => value.toLowerCase().includes(keyword)));
    response.json(successResponse(buildListData(filtered.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, filtered.length)));
  }));

  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);
    const repository = appDataSource.getRepository(HealthCheckupRecordEntity);
    const status = payload.status || evaluateStatus(payload.value, payload.referenceRange);
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      test_date: normalizeDate(payload.testDate),
      test_type: payload.testType,
      test_name: payload.testName,
      value: payload.value,
      unit: payload.unit,
      reference_range: payload.referenceRange,
      notes: payload.notes,
      follow_up_date: payload.followUpDate ? normalizeDate(payload.followUpDate) : null,
      status,
      last_abnormal_alert_at: status === 'abnormal' ? new Date() : null,
      last_follow_up_reminder_at: null,
    }));

    response.json(successResponse(mapRecord(item), 'create_checkup_record_success'));
  }));

  router.patch('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const payload = validateBody(recordSchema.partial(), request.body);
    const repository = appDataSource.getRepository(HealthCheckupRecordEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('checkup_record_not_found', 404, 404);
    }

    const nextValue = payload.value ?? Number(current.value);
    const nextReferenceRange = payload.referenceRange ?? current.reference_range;
    const nextStatus = payload.status ?? evaluateStatus(nextValue, nextReferenceRange);
    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      test_date: payload.testDate ? normalizeDate(payload.testDate) : current.test_date,
      test_type: payload.testType ?? current.test_type,
      test_name: payload.testName ?? current.test_name,
      value: nextValue,
      unit: payload.unit ?? current.unit,
      reference_range: nextReferenceRange,
      notes: payload.notes ?? current.notes,
      follow_up_date: payload.followUpDate !== undefined ? (payload.followUpDate ? normalizeDate(payload.followUpDate) : null) : current.follow_up_date,
      status: nextStatus,
      last_abnormal_alert_at: nextStatus === 'abnormal' ? (current.last_abnormal_alert_at ?? new Date()) : current.last_abnormal_alert_at,
    });

    response.json(successResponse(mapRecord(next), 'update_checkup_record_success'));
  }));

  router.delete('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(HealthCheckupRecordEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('checkup_record_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_checkup_record_success'));
  }));

  router.get('/templates', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const [templates, items] = await Promise.all([
      appDataSource.getRepository(HealthCheckupTemplateEntity).find({ where: { user_id: userId }, order: { updated_at: 'DESC' } }),
      appDataSource.getRepository(HealthCheckupTemplateItemEntity).find(),
    ]);

    response.json(successResponse(buildListData(templates.map((template) => mapTemplate(template, items)))));
  }));

  router.post('/templates', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(templateSchema, request.body);
    const itemsInput = payload.items ?? [];
    const templateRepo = appDataSource.getRepository(HealthCheckupTemplateEntity);
    const itemRepo = appDataSource.getRepository(HealthCheckupTemplateItemEntity);
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

    response.json(successResponse(mapTemplate(template, items), 'create_checkup_template_success'));
  }));

  router.patch('/templates/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const payload = validateBody(templateSchema.partial(), request.body);
    const templateRepo = appDataSource.getRepository(HealthCheckupTemplateEntity);
    const itemRepo = appDataSource.getRepository(HealthCheckupTemplateItemEntity);
    const current = await templateRepo.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('checkup_template_not_found', 404, 404);
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
    response.json(successResponse(mapTemplate(template, items), 'update_checkup_template_success'));
  }));

  router.delete('/templates/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const templateRepo = appDataSource.getRepository(HealthCheckupTemplateEntity);
    const itemRepo = appDataSource.getRepository(HealthCheckupTemplateItemEntity);
    const current = await templateRepo.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('checkup_template_not_found', 404, 404);
    }

    await itemRepo.delete({ template_id: current.id });
    await templateRepo.remove(current);
    response.json(successResponse({ ok: true }, 'delete_checkup_template_success'));
  }));

  router.post('/actions/batch-create', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(batchCreateSchema, request.body);
    const templateRepo = appDataSource.getRepository(HealthCheckupTemplateEntity);
    const itemRepo = appDataSource.getRepository(HealthCheckupTemplateItemEntity);
    const recordRepo = appDataSource.getRepository(HealthCheckupRecordEntity);
    const template = await templateRepo.findOne({
      where: { id: payload.templateId, user_id: payload.userId ?? authUserId },
    });

    if (!template) {
      throw new AppError('checkup_template_not_found', 404, 404);
    }

    const items = await itemRepo.find({ where: { template_id: template.id } });
    const status = payload.status ?? 'unknown';
    const created = await recordRepo.save(items.map((item) => recordRepo.create({
      user_id: payload.userId ?? authUserId,
      test_date: normalizeDate(payload.testDate),
      test_type: template.test_type,
      test_name: item.test_name,
      value: 0,
      unit: item.unit,
      reference_range: item.reference_range,
      notes: '',
      follow_up_date: payload.followUpDate ? normalizeDate(payload.followUpDate) : null,
      status,
      last_abnormal_alert_at: null,
      last_follow_up_reminder_at: null,
    })));

    response.json(successResponse(created.map(mapRecord), 'batch_create_checkup_records_success'));
  }));

  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
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
    const records = await appDataSource.getRepository(HealthCheckupRecordEntity).find({ where: { user_id: userId } });
    const dueFollowUps = buildDueFollowUps(records, settings.follow_up_lead_days);

    response.json(successResponse({
      totalRecords: records.length,
      abnormalCount: records.filter((item) => item.status === 'abnormal').length,
      attentionCount: records.filter((item) => item.status === 'attention').length,
      dueFollowUpCount: dueFollowUps.length,
      uniqueIndicatorCount: new Set(records.map((item) => item.test_name)).size,
      recentTestDate: records[0]?.test_date ?? null,
    }));
  }));

  router.get('/trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const testName = String(request.query.testName ?? '').trim();
    const startDate = String(request.query.startDate ?? '');
    const endDate = String(request.query.endDate ?? '');
    const records = await appDataSource.getRepository(HealthCheckupRecordEntity).find({ where: { user_id: userId } });
    const items = records
      .filter((item) => !testName || item.test_name === testName)
      .filter((item) => !startDate || item.test_date >= startDate)
      .filter((item) => !endDate || item.test_date <= endDate)
      .sort((a, b) => dayjs(a.test_date).valueOf() - dayjs(b.test_date).valueOf())
      .map((item) => ({
        date: item.test_date,
        label: dayjs(item.test_date).format('MM-DD'),
        value: Number(item.value),
        status: item.status,
      }));

    response.json(successResponse(items));
  }));

  router.get('/insights', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
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
    const records = await appDataSource.getRepository(HealthCheckupRecordEntity).find({ where: { user_id: userId } });
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

    response.json(successResponse(insights));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      active_user_id: userId,
      records_user_id: userId,
      trend_user_id: userId,
      insight_user_id: userId,
      reminder_enabled: true,
      abnormal_alert_enabled: true,
      follow_up_lead_days: 7,
    });

    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      recordsUserId: settings.records_user_id ?? userId,
      trendUserId: settings.trend_user_id ?? userId,
      insightUserId: settings.insight_user_id ?? userId,
      reminderEnabled: settings.reminder_enabled,
      abnormalAlertEnabled: settings.abnormal_alert_enabled,
      followUpLeadDays: settings.follow_up_lead_days,
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
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

    response.json(successResponse({
      activeUserId: settings.active_user_id ?? userId,
      recordsUserId: settings.records_user_id ?? userId,
      trendUserId: settings.trend_user_id ?? userId,
      insightUserId: settings.insight_user_id ?? userId,
      reminderEnabled: settings.reminder_enabled,
      abnormalAlertEnabled: settings.abnormal_alert_enabled,
      followUpLeadDays: settings.follow_up_lead_days,
    }, 'update_checkup_settings_success'));
  }));

  router.post('/actions/trigger-reminders', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(triggerSchema, request.body);
    const [followUpLogs, abnormalLogs] = await Promise.all([
      sendNotificationSceneLogs({
        userId,
        sceneId: 'checkup.followup_reminder',
        title: payload.title ?? '体检复查提醒',
        message: payload.message ?? '检测到体检项目已进入复查窗口，请及时安排复查。',
      }),
      sendNotificationSceneLogs({
        userId,
        sceneId: 'checkup.abnormal_alert',
        title: payload.title ?? '体检异常指标提醒',
        message: payload.message ?? '检测到体检项目存在异常指标，请尽快查看并跟进。',
      }),
    ]);

    response.json(successResponse([...followUpLogs, ...abnormalLogs], 'trigger_checkup_reminders_success'));
  }));

  return router;
}
