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
import { AppError } from '../../shared/errors/app-error';
import { HealthSleepRecordEntity } from './entities/health-sleep-record.entity';

const recordSchema = z.object({
  userId: z.string().trim().optional(),
  date: z.string().min(1),
  bedtime: z.string().min(1),
  wakeTime: z.string().min(1),
  qualityScore: z.number().int().min(1).max(5).optional().nullable(),
  isNap: z.boolean().optional().default(false),
  notes: z.string().optional().default(''),
});

/**
 * 计算睡眠时长（分钟）。
 * @param bedtime - 就寝时间
 * @param wakeTime - 起床时间
 * @returns 分钟数
 */
function calcDuration(bedtime: Date, wakeTime: Date) {
  return Math.max(0, Math.round((wakeTime.getTime() - bedtime.getTime()) / 60000));
}

/**
 * 映射实体到 API 返回结构。
 * @param entity - 睡眠记录实体
 * @returns 前端可用的记录对象
 */
function mapRecord(entity: HealthSleepRecordEntity) {
  return {
    id: entity.id,
    userId: entity.user_id,
    date: entity.date,
    bedtime: dayjs(entity.bedtime).format('YYYY-MM-DD HH:mm'),
    wakeTime: dayjs(entity.wake_time).format('YYYY-MM-DD HH:mm'),
    durationMinutes: entity.duration_minutes,
    qualityScore: entity.quality_score,
    isNap: entity.is_nap,
    notes: entity.notes,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

/**
 * 格式化分钟为 "Xh Ym"。
 * @param minutes - 分钟数
 * @returns 格式化字符串
 */
function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

/**
 * 睡眠 Router
 *
 * 提供睡眠记录的增删改查、趋势分析。
 * 路径前缀：/api/health/sleep
 */
export function createHealthSleepRouter() {
  const router = Router();

  /**
   * 从请求中解析目标用户 ID。
   * @param request - 认证请求对象
   * @returns 目标用户 ID
   */
  function resolveUserId(request: AuthenticatedRequest) {
    const authUserId = requireAuthUser(request);
    const raw = String(request.query.userId ?? '').trim();
    return raw || authUserId;
  }

  /**
   * GET /api/health/sleep/records
   * 睡眠记录列表，支持按日期范围筛选。
   */
  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = resolveUserId(request);
    const startDate = String(request.query.startDate ?? '').trim();
    const endDate = String(request.query.endDate ?? '').trim();
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);

    const repository = appDataSource.getRepository(HealthSleepRecordEntity);
    const queryBuilder = repository
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId });

    if (startDate) {
      queryBuilder.andWhere('r.date >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('r.date <= :endDate', { endDate });
    }

    const [items, total] = await queryBuilder
      .orderBy('r.date', 'DESC')
      .addOrderBy('r.bedtime', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    response.json(successResponse(buildListData(items.map(mapRecord), page, pageSize, total)));
  }));

  /**
   * POST /api/health/sleep/records
   * 新增睡眠记录。
   */
  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);

    const bedtime = new Date(payload.bedtime);
    const wakeTime = new Date(payload.wakeTime);

    if (wakeTime <= bedtime) {
      throw new AppError('invalid_time_range', 400, 400, '起床时间必须晚于就寝时间。');
    }

    const repository = appDataSource.getRepository(HealthSleepRecordEntity);
    const record = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      date: payload.date,
      bedtime,
      wake_time: wakeTime,
      duration_minutes: calcDuration(bedtime, wakeTime),
      quality_score: payload.qualityScore ?? null,
      is_nap: payload.isNap ?? false,
      notes: payload.notes ?? '',
    }));

    response.json(successResponse(mapRecord(record), 'create_sleep_record_success'));
  }));

  /**
   * PATCH /api/health/sleep/records/:id
   * 更新睡眠记录。
   */
  router.patch('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const payload = validateBody(recordSchema.partial(), request.body);
    const repository = appDataSource.getRepository(HealthSleepRecordEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('sleep_record_not_found', 404, 404);
    }

    const nextBedtime = payload.bedtime ? new Date(payload.bedtime) : current.bedtime;
    const nextWakeTime = payload.wakeTime ? new Date(payload.wakeTime) : current.wake_time;

    if (nextWakeTime <= nextBedtime) {
      throw new AppError('invalid_time_range', 400, 400, '起床时间必须晚于就寝时间。');
    }

    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      date: payload.date ?? current.date,
      bedtime: nextBedtime,
      wake_time: nextWakeTime,
      duration_minutes: calcDuration(nextBedtime, nextWakeTime),
      quality_score: payload.qualityScore !== undefined ? payload.qualityScore : current.quality_score,
      is_nap: payload.isNap !== undefined ? payload.isNap : current.is_nap,
      notes: payload.notes !== undefined ? payload.notes : current.notes,
    });

    response.json(successResponse(mapRecord(next), 'update_sleep_record_success'));
  }));

  /**
   * DELETE /api/health/sleep/records/:id
   * 删除睡眠记录。
   */
  router.delete('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(HealthSleepRecordEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('sleep_record_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_sleep_record_success'));
  }));

  /**
   * GET /api/health/sleep/trend?period=week|month|year&date=2026-07
   * 趋势分析：按天聚合最近 N 天的睡眠数据。
   */
  router.get('/trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = resolveUserId(request);
    const period = String(request.query.period ?? 'week');
    const dateStr = String(request.query.date ?? dayjs().format('YYYY-MM-DD'));

    const base = dayjs(dateStr.slice(0, 10));
    let days = 7;
    if (period === 'month') days = 30;
    if (period === 'year') days = 365;

    const start = base.subtract(days - 1, 'day').startOf('day');
    const end = base.endOf('day');

    const repository = appDataSource.getRepository(HealthSleepRecordEntity);
    const rows = await repository
      .createQueryBuilder('r')
      .select('r.date', 'date')
      .addSelect('SUM(r.duration_minutes)', 'totalMinutes')
      .addSelect('AVG(r.quality_score)', 'avgQuality')
      .addSelect('COUNT(*)', 'count')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.date BETWEEN :start AND :end', {
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
      })
      .andWhere('r.is_nap = :isNap', { isNap: false })
      .groupBy('r.date')
      .orderBy('r.date', 'ASC')
      .getRawMany();

    const dataMap = new Map<string, { totalMinutes: number; avgQuality: number | null; count: number }>();
    rows.forEach((row) => {
      const dateKey = dayjs(row.date).format('YYYY-MM-DD');
      dataMap.set(dateKey, {
        totalMinutes: Number(row.totalMinutes),
        avgQuality: row.avgQuality ? Number(row.avgQuality) : null,
        count: Number(row.count),
      });
    });

    const items: Array<{
      date: string;
      label: string;
      durationMinutes: number | null;
      avgQuality: number | null;
      count: number;
    }> = [];

    for (let i = 0; i < days; i += 1) {
      const d = start.add(i, 'day');
      const dateKey = d.format('YYYY-MM-DD');
      const label = period === 'year' ? d.format('M月') : d.format('M月D日');
      const data = dataMap.get(dateKey);
      items.push({
        date: dateKey,
        label,
        durationMinutes: data ? Number(data.totalMinutes.toFixed(0)) : null,
        avgQuality: data && data.avgQuality !== null ? Number(data.avgQuality.toFixed(1)) : null,
        count: data ? data.count : 0,
      });
    }

    const validItems = items.filter((i) => i.durationMinutes !== null);
    const avgDuration = validItems.length > 0
      ? Math.round(validItems.reduce((sum, i) => sum + (i.durationMinutes ?? 0), 0) / validItems.length)
      : 0;
    const avgQuality = validItems.filter((i) => i.avgQuality !== null).length > 0
      ? Number((
        validItems.filter((i) => i.avgQuality !== null).reduce((sum, i) => sum + (i.avgQuality ?? 0), 0) /
        validItems.filter((i) => i.avgQuality !== null).length
      ).toFixed(1))
      : null;

    response.json(successResponse({
      period,
      days,
      items,
      avgDuration,
      avgDurationLabel: formatDuration(avgDuration),
      avgQuality,
      totalRecords: validItems.length,
    }));
  }));

  /**
   * GET /api/health/sleep/overview
   * 概览统计：最近 7 天平均时长、平均质量、记录总数。
   */
  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = resolveUserId(request);
    const repository = appDataSource.getRepository(HealthSleepRecordEntity);

    const start = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
    const end = dayjs().format('YYYY-MM-DD');

    const recentRows = await repository
      .createQueryBuilder('r')
      .select('r.date', 'date')
      .addSelect('SUM(r.duration_minutes)', 'totalMinutes')
      .addSelect('AVG(r.quality_score)', 'avgQuality')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.date BETWEEN :start AND :end', { start, end })
      .andWhere('r.is_nap = :isNap', { isNap: false })
      .groupBy('r.date')
      .orderBy('r.date', 'DESC')
      .getRawMany();

    const totalRecords = await repository.count({ where: { user_id: userId } });

    const validDays = recentRows.length;
    const avgDuration = validDays > 0
      ? Math.round(recentRows.reduce((sum, r) => sum + Number(r.totalMinutes), 0) / validDays)
      : 0;
    const qualityRows = recentRows.filter((r) => r.avgQuality !== null);
    const avgQuality = qualityRows.length > 0
      ? Number((qualityRows.reduce((sum, r) => sum + Number(r.avgQuality), 0) / qualityRows.length).toFixed(1))
      : null;

    const latest = await repository.findOne({
      where: { user_id: userId },
      order: { date: 'DESC', bedtime: 'DESC' },
    });

    response.json(successResponse({
      avgDuration7d: avgDuration,
      avgDuration7dLabel: formatDuration(avgDuration),
      avgQuality7d: avgQuality,
      totalRecords,
      latestRecord: latest ? mapRecord(latest) : null,
    }));
  }));

  return router;
}
