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
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { AppError } from '../../shared/errors/app-error';
import { HealthStepRecordEntity } from './entities/health-step-record.entity';
import { HealthStepSettingEntity } from './entities/health-step-setting.entity';

const recordSchema = z.object({
  userId: z.string().trim().optional(),
  steps: z.number().int().min(0),
  hour: z.number().int().min(0).max(23).nullable().optional(),
  recordTime: z.string().min(1),
});

const settingsSchema = z.object({
  strideLength: z.number().min(0.1).optional(),
  activeUserId: z.string().optional(),
  statsUserId: z.string().optional(),
  recordsUserId: z.string().optional(),
});

const settingService = new BaseUserSettingService(HealthStepSettingEntity);

function mapRecord(entity: HealthStepRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    steps: entity.steps,
    hour: entity.hour,
    recordTime: dayjs(entity.record_time).toISOString(),
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function calculateDistanceKm(steps: number, strideLength: number) {
  return Number(((steps * strideLength) / 1000).toFixed(2));
}

function aggregateByBucket(records: HealthStepRecordEntity[], bucket: 'date' | 'month', strideLength: number) {
  const grouped = new Map<string, { totalSteps: number; recordCount: number }>();
  records.forEach((record) => {
    const key = bucket === 'date'
      ? dayjs(record.record_time).format('YYYY-MM-DD')
      : dayjs(record.record_time).format('YYYY-MM');
    const current = grouped.get(key) ?? { totalSteps: 0, recordCount: 0 };
    current.totalSteps += record.steps;
    current.recordCount += 1;
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .map(([key, value]) => ({
      bucket: key,
      label: bucket === 'date' ? dayjs(key).format('M月D日') : dayjs(`${key}-01`).format('M月'),
      totalSteps: value.totalSteps,
      recordCount: value.recordCount,
      distanceKm: calculateDistanceKm(value.totalSteps, strideLength),
    }))
    .sort((left, right) => left.bucket.localeCompare(right.bucket));
}

export function createStepRouter() {
  const router = Router();

  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const hour = request.query.hour !== undefined ? Number(request.query.hour) : 'all';
    const month = String(request.query.month ?? '');
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(HealthStepRecordEntity);
    const items = await repository.find({
      where: { user_id: userId },
      order: { record_time: 'DESC', updated_at: 'DESC' },
    });

    const filtered = items
      .filter((item) => hour === 'all' || item.hour === hour)
      .filter((item) => !month || dayjs(item.record_time).format('YYYY-MM') === month);

    response.json(successResponse(buildListData(filtered.slice(skip, skip + pageSize).map(mapRecord), page, pageSize, filtered.length)));
  }));

  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);
    const repository = appDataSource.getRepository(HealthStepRecordEntity);
    const item = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      steps: payload.steps,
      hour: payload.hour ?? null,
      record_time: dayjs(payload.recordTime).isValid() ? dayjs(payload.recordTime).toDate() : new Date(),
    }));

    response.json(successResponse(mapRecord(item), 'create_step_record_success'));
  }));

  router.patch('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const payload = validateBody(recordSchema.partial(), request.body);
    const repository = appDataSource.getRepository(HealthStepRecordEntity);
    const current = await repository.findOne({
      where: { id: recordId, user_id: userId },
    });

    if (!current) {
      throw new AppError('step_record_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      steps: payload.steps ?? current.steps,
      hour: payload.hour !== undefined ? payload.hour : current.hour,
      record_time: payload.recordTime ? (dayjs(payload.recordTime).isValid() ? dayjs(payload.recordTime).toDate() : current.record_time) : current.record_time,
    });

    response.json(successResponse(mapRecord(next), 'update_step_record_success'));
  }));

  router.delete('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const recordId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(HealthStepRecordEntity);
    const current = await repository.findOne({
      where: { id: recordId, user_id: userId },
    });

    if (!current) {
      throw new AppError('step_record_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_step_record_success'));
  }));

  router.get('/summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const settings = await settingService.getOrCreate(authUserId, {
      stride_length: 0.7,
      active_user_id: authUserId,
      stats_user_id: authUserId,
      records_user_id: authUserId,
    });
    const repository = appDataSource.getRepository(HealthStepRecordEntity);
    const records = await repository.find({ where: { user_id: userId } });
    const today = dayjs().format('YYYY-MM-DD');
    const currentMonth = dayjs().format('YYYY-MM');
    const todaySteps = records.filter((item) => dayjs(item.record_time).format('YYYY-MM-DD') === today).reduce((sum, item) => sum + item.steps, 0);
    const monthSteps = records.filter((item) => dayjs(item.record_time).format('YYYY-MM') === currentMonth).reduce((sum, item) => sum + item.steps, 0);

    response.json(successResponse({
      totalRecords: records.length,
      todaySteps,
      todayDistanceKm: calculateDistanceKm(todaySteps, Number(settings.stride_length)),
      currentMonthSteps: monthSteps,
      currentMonthDistanceKm: calculateDistanceKm(monthSteps, Number(settings.stride_length)),
      strideLength: Number(settings.stride_length),
    }));
  }));

  router.get('/trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const month = String(request.query.month ?? dayjs().format('YYYY-MM'));
    const hour = request.query.hour !== undefined ? Number(request.query.hour) : 'all';
    const settings = await settingService.getOrCreate(authUserId, {
      stride_length: 0.7,
      active_user_id: authUserId,
      stats_user_id: authUserId,
      records_user_id: authUserId,
    });
    const repository = appDataSource.getRepository(HealthStepRecordEntity);
    const records = (await repository.find({ where: { user_id: userId } }))
      .filter((item) => dayjs(item.record_time).format('YYYY-MM') === month)
      .filter((item) => hour === 'all' || item.hour === hour);

    response.json(successResponse(aggregateByBucket(records, 'date', Number(settings.stride_length))));
  }));

  router.get('/month-compare', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const month = String(request.query.month ?? dayjs().format('YYYY-MM'));
    const currentMonth = dayjs(`${month}-01`);
    const previousMonth = currentMonth.subtract(1, 'month');
    const settings = await settingService.getOrCreate(authUserId, {
      stride_length: 0.7,
      active_user_id: authUserId,
      stats_user_id: authUserId,
      records_user_id: authUserId,
    });
    const repository = appDataSource.getRepository(HealthStepRecordEntity);
    const records = await repository.find({ where: { user_id: userId } });
    const currentSteps = records.filter((item) => dayjs(item.record_time).format('YYYY-MM') === currentMonth.format('YYYY-MM')).reduce((sum, item) => sum + item.steps, 0);
    const previousSteps = records.filter((item) => dayjs(item.record_time).format('YYYY-MM') === previousMonth.format('YYYY-MM')).reduce((sum, item) => sum + item.steps, 0);
    const changePercentage = previousSteps === 0 ? null : Number((((currentSteps - previousSteps) / previousSteps) * 100).toFixed(1));

    response.json(successResponse({
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

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      stride_length: 0.7,
      active_user_id: userId,
      stats_user_id: userId,
      records_user_id: userId,
    });

    response.json(successResponse({
      strideLength: Number(settings.stride_length),
      activeUserId: settings.active_user_id ?? userId,
      statsUserId: settings.stats_user_id ?? userId,
      recordsUserId: settings.records_user_id ?? userId,
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
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

    response.json(successResponse({
      strideLength: Number(settings.stride_length),
      activeUserId: settings.active_user_id ?? userId,
      statsUserId: settings.stats_user_id ?? userId,
      recordsUserId: settings.records_user_id ?? userId,
    }, 'update_step_settings_success'));
  }));

  return router;
}
