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
import { HealthVitalRecordEntity } from './entities/health-vital-record.entity';

/**
 * 内置体征指标定义：名称、单位、参考范围。
 * 血压拆为收缩压（systolic_bp）和舒张压（diastolic_bp）两条记录。
 */
const VITAL_METRICS = {
  heart_rate: {
    label: '心率',
    unit: '次/分',
    referenceRange: '60-100',
  },
  systolic_bp: {
    label: '收缩压',
    unit: 'mmHg',
    referenceRange: '90-139',
  },
  diastolic_bp: {
    label: '舒张压',
    unit: 'mmHg',
    referenceRange: '60-89',
  },
  blood_oxygen: {
    label: '血氧',
    unit: '%',
    referenceRange: '95-100',
  },
  blood_sugar: {
    label: '血糖',
    unit: 'mmol/L',
    referenceRange: '3.9-6.1',
  },
  body_temp: {
    label: '体温',
    unit: '℃',
    referenceRange: '36.0-37.3',
  },
} as const;

type VitalMetricKey = keyof typeof VITAL_METRICS;

const METRIC_KEYS = Object.keys(VITAL_METRICS) as VitalMetricKey[];

const recordSchema = z.object({
  userId: z.string().trim().optional(),
  recordTime: z.string().min(1),
  metric: z.enum(METRIC_KEYS as unknown as [string, ...string[]]),
  value: z.number(),
  notes: z.string().optional().default(''),
});

/**
 * 根据参考范围评估状态（复用体检模块的评估逻辑）。
 * @param value - 指标值
 * @param referenceRange - 参考范围字符串
 * @returns 状态：normal / abnormal / attention / unknown
 */
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

/**
 * 映射实体到 API 返回结构。
 * @param entity - 体征记录实体
 * @returns 前端可用的记录对象
 */
function mapRecord(entity: HealthVitalRecordEntity) {
  const metricInfo = VITAL_METRICS[entity.metric as VitalMetricKey];
  return {
    id: entity.id,
    userId: entity.user_id,
    recordTime: dayjs(entity.record_time).format('YYYY-MM-DD HH:mm'),
    metric: entity.metric,
    metricLabel: metricInfo?.label ?? entity.metric,
    value: Number(entity.value),
    unit: entity.unit,
    referenceRange: entity.reference_range,
    status: entity.status,
    notes: entity.notes,
    lastAbnormalAlertAt: entity.last_abnormal_alert_at?.toISOString() ?? '',
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

/**
 * 日常体征 Router
 *
 * 提供日常体征（心率/血压/血氧/血糖/体温）的记录、查询、趋势分析与异常识别。
 * 路径前缀：/api/health/vital
 */
export function createHealthVitalRouter() {
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
   * GET /api/health/vital/metrics
   * 获取内置体征指标列表（名称、单位、参考范围）。
   */
  router.get('/metrics', asyncHandler(async (_request, response) => {
    const metrics = METRIC_KEYS.map((key) => ({
      key,
      label: VITAL_METRICS[key].label,
      unit: VITAL_METRICS[key].unit,
      referenceRange: VITAL_METRICS[key].referenceRange,
    }));
    response.json(successResponse(metrics));
  }));

  /**
   * GET /api/health/vital/records
   * 体征记录列表，支持按指标、日期范围筛选。
   */
  router.get('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = resolveUserId(request);
    const metric = String(request.query.metric ?? '').trim();
    const startDate = String(request.query.startDate ?? '').trim();
    const endDate = String(request.query.endDate ?? '').trim();
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);

    const repository = appDataSource.getRepository(HealthVitalRecordEntity);
    const queryBuilder = repository
      .createQueryBuilder('r')
      .where('r.user_id = :userId', { userId });

    if (metric) {
      queryBuilder.andWhere('r.metric = :metric', { metric });
    }
    if (startDate) {
      queryBuilder.andWhere('r.record_time >= :startDate', { startDate: `${startDate} 00:00:00` });
    }
    if (endDate) {
      queryBuilder.andWhere('r.record_time <= :endDate', { endDate: `${endDate} 23:59:59` });
    }

    const [items, total] = await queryBuilder
      .orderBy('r.record_time', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getManyAndCount();

    response.json(successResponse(buildListData(items.map(mapRecord), page, pageSize, total)));
  }));

  /**
   * POST /api/health/vital/records
   * 新增体征记录（自动评估状态）。
   */
  router.post('/records', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const payload = validateBody(recordSchema, request.body);
    const metricInfo = VITAL_METRICS[payload.metric as VitalMetricKey];
    if (!metricInfo) {
      throw new AppError('invalid_metric', 400, 400);
    }

    const status = evaluateStatus(payload.value, metricInfo.referenceRange);
    const repository = appDataSource.getRepository(HealthVitalRecordEntity);
    const record = await repository.save(repository.create({
      user_id: payload.userId ?? authUserId,
      record_time: new Date(payload.recordTime),
      metric: payload.metric,
      value: payload.value,
      unit: metricInfo.unit,
      reference_range: metricInfo.referenceRange,
      status,
      notes: payload.notes,
      last_abnormal_alert_at: status === 'abnormal' ? new Date() : null,
    }));

    response.json(successResponse(mapRecord(record), 'create_vital_record_success'));
  }));

  /**
   * PATCH /api/health/vital/records/:id
   * 更新体征记录。
   */
  router.patch('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const payload = validateBody(recordSchema.partial(), request.body);
    const repository = appDataSource.getRepository(HealthVitalRecordEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('vital_record_not_found', 404, 404);
    }

    const metricKey = (payload.metric ?? current.metric) as VitalMetricKey;
    const metricInfo = VITAL_METRICS[metricKey];
    if (!metricInfo) {
      throw new AppError('invalid_metric', 400, 400);
    }

    const nextValue = payload.value !== undefined ? payload.value : Number(current.value);
    const nextStatus = evaluateStatus(nextValue, metricInfo.referenceRange);
    const next = await repository.save({
      ...current,
      user_id: payload.userId ?? current.user_id,
      record_time: payload.recordTime ? new Date(payload.recordTime) : current.record_time,
      metric: metricKey,
      value: nextValue,
      unit: metricInfo.unit,
      reference_range: metricInfo.referenceRange,
      status: nextStatus,
      notes: payload.notes !== undefined ? payload.notes : current.notes,
      last_abnormal_alert_at: nextStatus === 'abnormal' ? (current.last_abnormal_alert_at ?? new Date()) : current.last_abnormal_alert_at,
    });

    response.json(successResponse(mapRecord(next), 'update_vital_record_success'));
  }));

  /**
   * DELETE /api/health/vital/records/:id
   * 删除体征记录。
   */
  router.delete('/records/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const entityId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(HealthVitalRecordEntity);
    const current = await repository.findOne({
      where: { id: entityId, user_id: userId },
    });

    if (!current) {
      throw new AppError('vital_record_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_vital_record_success'));
  }));

  /**
   * GET /api/health/vital/trend?metric=heart_rate&period=week|month&date=2026-07
   * 趋势分析：按天聚合最近 N 天的数据，返回折线图数据。
   */
  router.get('/trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = resolveUserId(request);
    const metric = String(request.query.metric ?? 'heart_rate').trim();
    const period = String(request.query.period ?? 'week');
    const dateStr = String(request.query.date ?? dayjs().format('YYYY-MM-DD'));

    if (!METRIC_KEYS.includes(metric as VitalMetricKey)) {
      throw new AppError('invalid_metric', 400, 400);
    }

    const base = dayjs(dateStr.slice(0, 10));
    let days = 7;
    if (period === 'month') days = 30;
    if (period === 'year') days = 365;

    const start = base.subtract(days - 1, 'day').startOf('day');
    const end = base.endOf('day');

    const repository = appDataSource.getRepository(HealthVitalRecordEntity);
    const rows = await repository
      .createQueryBuilder('r')
      .select('DATE(r.record_time)', 'date')
      .addSelect('AVG(r.value)', 'avgValue')
      .addSelect('MIN(r.value)', 'minValue')
      .addSelect('MAX(r.value)', 'maxValue')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.metric = :metric', { metric })
      .andWhere('r.record_time BETWEEN :start AND :end', {
        start: start.format('YYYY-MM-DD HH:mm:ss'),
        end: end.format('YYYY-MM-DD HH:mm:ss'),
      })
      .groupBy('DATE(r.record_time)')
      .orderBy('DATE(r.record_time)', 'ASC')
      .getRawMany();

    // 补齐缺失的日期
    const dataMap = new Map<string, { avgValue: number; minValue: number; maxValue: number }>();
    rows.forEach((row) => {
      dataMap.set(String(row.date), {
        avgValue: Number(row.avgValue),
        minValue: Number(row.minValue),
        maxValue: Number(row.maxValue),
      });
    });

    const items: Array<{
      date: string;
      label: string;
      avgValue: number | null;
      minValue: number | null;
      maxValue: number | null;
    }> = [];

    for (let i = 0; i < days; i += 1) {
      const d = start.add(i, 'day');
      const dateStrFormatted = d.format('YYYY-MM-DD');
      const label = period === 'year' ? d.format('M月') : d.format('M月D日');
      const data = dataMap.get(dateStrFormatted);
      items.push({
        date: dateStrFormatted,
        label,
        avgValue: data ? Number(data.avgValue.toFixed(2)) : null,
        minValue: data ? Number(data.minValue.toFixed(2)) : null,
        maxValue: data ? Number(data.maxValue.toFixed(2)) : null,
      });
    }

    const metricInfo = VITAL_METRICS[metric as VitalMetricKey];
    response.json(successResponse({
      metric,
      metricLabel: metricInfo.label,
      unit: metricInfo.unit,
      referenceRange: metricInfo.referenceRange,
      period,
      days,
      items,
    }));
  }));

  /**
   * GET /api/health/vital/overview
   * 概览统计：各指标最新值、异常数、记录总数。
   */
  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = resolveUserId(request);
    const repository = appDataSource.getRepository(HealthVitalRecordEntity);
    const allRecords = await repository.find({
      where: { user_id: userId },
      order: { record_time: 'DESC' },
    });

    const latestByMetric: Record<string, typeof mapRecord extends (e: HealthVitalRecordEntity) => infer R ? R : never> = {};
    const abnormalCountByMetric: Record<string, number> = {};
    const recordCountByMetric: Record<string, number> = {};

    METRIC_KEYS.forEach((key) => {
      abnormalCountByMetric[key] = 0;
      recordCountByMetric[key] = 0;
    });

    allRecords.forEach((record) => {
      if (!latestByMetric[record.metric]) {
        latestByMetric[record.metric] = mapRecord(record);
      }
      if (record.status === 'abnormal') {
        abnormalCountByMetric[record.metric] = (abnormalCountByMetric[record.metric] ?? 0) + 1;
      }
      recordCountByMetric[record.metric] = (recordCountByMetric[record.metric] ?? 0) + 1;
    });

    const metrics = METRIC_KEYS.map((key) => ({
      key,
      label: VITAL_METRICS[key].label,
      unit: VITAL_METRICS[key].unit,
      referenceRange: VITAL_METRICS[key].referenceRange,
      latest: latestByMetric[key] ?? null,
      abnormalCount: abnormalCountByMetric[key] ?? 0,
      recordCount: recordCountByMetric[key] ?? 0,
    }));

    const totalRecords = allRecords.length;
    const totalAbnormal = allRecords.filter((r) => r.status === 'abnormal').length;
    const latestRecordTime = allRecords[0]?.record_time
      ? dayjs(allRecords[0].record_time).format('YYYY-MM-DD HH:mm')
      : null;

    response.json(successResponse({
      totalRecords,
      totalAbnormal,
      latestRecordTime,
      metrics,
    }));
  }));

  return router;
}
