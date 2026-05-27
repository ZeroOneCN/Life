import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { Between } from 'typeorm';

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

export function createStepRouter() {
  const router = Router();

  // GET /records — paginated list
  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const hour = request.query.hour !== undefined ? Number(request.query.hour) : 'all';
    const month = String(request.query.month ?? '');
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(HealthStepRecordEntity);

    const where: Record<string, unknown> = { user_id: userId };
    if (hour !== 'all') {
      where.hour = hour;
    }
    if (month) {
      const monthStart = dayjs(`${month}-01`).startOf('month').toDate();
      const monthEnd = dayjs(`${month}-01`).endOf('month').toDate();
      where.record_time = Between(monthStart, monthEnd);
    }

    const [items, total] = await repository.findAndCount({
      where,
      order: { record_time: 'DESC', updated_at: 'DESC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items.map(mapRecord), page, pageSize, total)));
  }));

  // POST /records — create with duplicate check
  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);
    const repository = appDataSource.getRepository(HealthStepRecordEntity);
    const userId = payload.userId ?? authUserId;
    const recordTime = dayjs(payload.recordTime).isValid() ? dayjs(payload.recordTime) : dayjs();
    const dateStr = recordTime.format('YYYY-MM-DD');
    const hour = payload.hour ?? null;

    // Duplicate check: same user + same date + same hour (like Runrecord)
    const dateStart = dayjs(`${dateStr}T00:00:00`).toDate();
    const dateEnd = dayjs(`${dateStr}T23:59:59`).toDate();

    const existing = await repository
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.record_time BETWEEN :start AND :end', { start: dateStart, end: dateEnd })
      .andWhere(hour !== null ? 'r.hour = :hour' : 'r.hour IS NULL', hour !== null ? { hour } : {})
      .getOne();

    if (existing) {
      throw new AppError('step_record_duplicate', 409, 409);
    }

    const item = await repository.save(repository.create({
      user_id: userId,
      steps: payload.steps,
      hour,
      record_time: recordTime.toDate(),
    }));

    response.json(successResponse(mapRecord(item), 'create_step_record_success'));
  }));

  // PATCH /records/:id
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

  // DELETE /records/:id
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

  // GET /summary — daily totals use MAX(steps) for cumulative data model
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
    const today = dayjs().format('YYYY-MM-DD');
    const currentMonth = dayjs().format('YYYY-MM');
    const monthStart = dayjs(`${currentMonth}-01`).startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const monthEnd = dayjs(`${currentMonth}-01`).endOf('month').format('YYYY-MM-DD HH:mm:ss');

    const [todayResult, monthResult, totalCount] = await Promise.all([
      repository.query(
        'SELECT MAX(steps) as maxSteps FROM health_step_record WHERE user_id = ? AND record_time BETWEEN ? AND ?',
        [userId, `${today} 00:00:00`, `${today} 23:59:59`],
      ),
      repository.query(
        'SELECT SUM(daily.maxSteps) as totalSteps FROM (SELECT MAX(r2.steps) as maxSteps FROM health_step_record r2 WHERE r2.user_id = ? AND r2.record_time BETWEEN ? AND ? GROUP BY DATE(r2.record_time)) daily',
        [userId, monthStart, monthEnd],
      ),
      repository.count({ where: { user_id: userId } }),
    ]);

    const todaySteps = Number(todayResult?.[0]?.maxSteps) || 0;
    const monthSteps = Number(monthResult?.[0]?.totalSteps) || 0;

    response.json(successResponse({
      totalRecords: totalCount,
      todaySteps,
      todayDistanceKm: calculateDistanceKm(todaySteps, Number(settings.stride_length)),
      currentMonthSteps: monthSteps,
      currentMonthDistanceKm: calculateDistanceKm(monthSteps, Number(settings.stride_length)),
      strideLength: Number(settings.stride_length),
    }));
  }));

  // GET /trend — date buckets with MAX(steps) per day
  router.get('/trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = String(request.query.userId ?? authUserId);
    const month = String(request.query.month ?? dayjs().format('YYYY-MM'));
    const settings = await settingService.getOrCreate(authUserId, {
      stride_length: 0.7,
      active_user_id: authUserId,
      stats_user_id: authUserId,
      records_user_id: authUserId,
    });

    const monthStart = dayjs(`${month}-01`).startOf('month').toDate();
    const monthEnd = dayjs(`${month}-01`).endOf('month').toDate();

    const repository = appDataSource.getRepository(HealthStepRecordEntity);
    const rows = await repository.query(
      'SELECT DATE_FORMAT(record_time, \'%Y-%m-%d\') as date, MAX(steps) as totalSteps, COUNT(*) as recordCount FROM health_step_record WHERE user_id = ? AND record_time BETWEEN ? AND ? GROUP BY DATE_FORMAT(record_time, \'%Y-%m-%d\') ORDER BY date DESC',
      [userId, monthStart, monthEnd],
    );

    const stride = Number(settings.stride_length);
    const result = rows.map((row: Record<string, unknown>) => ({
      bucket: row.date,
      label: dayjs(String(row.date)).format('M月D日'),
      totalSteps: Number(row.totalSteps),
      recordCount: Number(row.recordCount),
      distanceKm: calculateDistanceKm(Number(row.totalSteps), stride),
    }));

    response.json(successResponse(result));
  }));

  // GET /month-compare — sum of daily MAX(steps) for each month
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

    async function getMonthSteps(m: dayjs.Dayjs) {
      const start = m.startOf('month').format('YYYY-MM-DD HH:mm:ss');
      const end = m.endOf('month').format('YYYY-MM-DD HH:mm:ss');
      const [rows] = await repository.query(
        'SELECT SUM(daily.maxSteps) as totalSteps FROM (SELECT MAX(r2.steps) as maxSteps FROM health_step_record r2 WHERE r2.user_id = ? AND r2.record_time BETWEEN ? AND ? GROUP BY DATE(r2.record_time)) daily',
        [userId, start, end],
      ) as Array<Array<{ totalSteps: number | null }>>;
      return Number(rows?.[0]?.totalSteps) || 0;
    }

    const [currentSteps, previousSteps] = await Promise.all([
      getMonthSteps(currentMonth),
      getMonthSteps(previousMonth),
    ]);

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

  // GET /settings
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

  // PATCH /settings
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
