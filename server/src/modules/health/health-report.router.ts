import { Router } from 'express';
import dayjs from 'dayjs';
import { z } from 'zod';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { AppError } from '../../shared/errors/app-error';
import { estimateTokens, recordAssistantUsage } from '../system/assistant-usage.service';
import { HealthStepRecordEntity } from './entities/health-step-record.entity';
import { HealthStepSettingEntity } from './entities/health-step-setting.entity';
import { HealthFitnessDietRecordEntity } from './entities/health-fitness-diet-record.entity';
import { HealthFitnessExerciseRecordEntity } from './entities/health-fitness-exercise-record.entity';
import { HealthFitnessWeightRecordEntity } from './entities/health-fitness-weight-record.entity';
import { HealthMedicationRecordEntity } from './entities/health-medication-record.entity';
import { HealthCheckupRecordEntity } from './entities/health-checkup-record.entity';

/**
 * 健康报告 Router
 *
 * 提供周/月/年度健康报告的数据聚合、异常识别与 AI 健康建议生成。
 *
 * 路径前缀：/api/health/report
 */
export function createHealthReportRouter() {
  const router = Router();

  /**
   * 解析周期参数，返回当前周期与上一周期的起止时间。
   * @param period - 周期类型（week/month/year）
   * @param dateStr - 日期字符串（YYYY-MM 或 YYYY 或 YYYY-MM-DD）
   * @returns 当前周期与上一周期的起止信息
   */
  function resolvePeriodRange(period: 'week' | 'month' | 'year', dateStr: string) {
    if (period === 'week') {
      const base = dayjs(dateStr);
      if (!base.isValid()) throw new AppError('invalid_date', 400, 400);
      const current = base.startOf('day');
      const start = current.startOf('week');
      const end = current.endOf('week');
      const previousStart = start.subtract(7, 'day');
      const previousEnd = end.subtract(7, 'day');
      return {
        current: { start, end, label: `${start.format('M月D日')}-${end.format('M月D日')}` },
        previous: { start: previousStart, end: previousEnd, label: `${previousStart.format('M月D日')}-${previousEnd.format('M月D日')}` },
      };
    }
    if (period === 'month') {
      const current = dayjs(`${dateStr}-01`);
      if (!current.isValid()) throw new AppError('invalid_date', 400, 400);
      const start = current.startOf('month');
      const end = current.endOf('month');
      const previousStart = start.subtract(1, 'month');
      const previousEnd = previousStart.endOf('month');
      return {
        current: { start, end, label: current.format('YYYY年M月') },
        previous: { start: previousStart, end: previousEnd, label: previousStart.format('YYYY年M月') },
      };
    }
    // year
    const current = dayjs(`${dateStr}-01-01`);
    if (!current.isValid()) throw new AppError('invalid_date', 400, 400);
    const start = current.startOf('year');
    const end = current.endOf('year');
    const previousStart = start.subtract(1, 'year');
    const previousEnd = previousStart.endOf('year');
    return {
      current: { start, end, label: current.format('YYYY年') },
      previous: { start: previousStart, end: previousEnd, label: previousStart.format('YYYY年') },
    };
  }

  /**
   * 格式化日期为 YYYY-MM-DD HH:mm:ss 用于 SQL 查询。
   * @param d - dayjs 日期对象
   * @returns SQL 格式字符串
   */
  function toSql(d: dayjs.Dayjs) {
    return d.format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * 格式化日期为 YYYY-MM-DD 用于按天查询。
   * @param d - dayjs 日期对象
   * @returns 日期字符串
   */
  function toDateStr(d: dayjs.Dayjs) {
    return d.format('YYYY-MM-DD');
  }

  /**
   * 计算百分比变化。
   * @param current - 当前值
   * @param previous - 上一周期值
   * @returns 变化百分比（保留 1 位小数），上一周期为 0 返回 null
   */
  function diffPercent(current: number, previous: number) {
    if (previous === 0) return null;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  /**
   * 获取步幅。
   * @param userId - 用户 ID
   * @returns 步幅（米）
   */
  async function getStrideLength(userId: string) {
    const repo = appDataSource.getRepository(HealthStepSettingEntity);
    const setting = await repo.findOne({ where: { user_id: userId } });
    return Number(setting?.stride_length ?? 0.7);
  }

  /**
   * 计算步数距离（公里）。
   * @param steps - 步数
   * @param strideLength - 步幅（米）
   * @returns 距离（公里）
   */
  function calculateDistanceKm(steps: number, strideLength: number) {
    if (steps <= 0 || strideLength <= 0) return 0;
    return Number(((steps * strideLength) / 1000).toFixed(2));
  }

  /**
   * 获取指定时间范围内步数汇总。
   * @param userId - 用户 ID
   * @param strideLength - 步幅
   * @param start - 起始时间
   * @param end - 结束时间
   * @returns 步数汇总数据
   */
  async function fetchStepSummary(userId: string, strideLength: number, start: dayjs.Dayjs, end: dayjs.Dayjs) {
    const repo = appDataSource.getRepository(HealthStepRecordEntity);
    const rows = await repo.query(
      `SELECT SUM(daily.maxSteps) as totalSteps, AVG(daily.maxSteps) as avgSteps, COUNT(*) as days
       FROM (SELECT MAX(r.steps) as maxSteps FROM health_step_record r
             WHERE r.user_id = ? AND r.record_time BETWEEN ? AND ?
             GROUP BY DATE(r.record_time)) daily`,
      [userId, toSql(start), toSql(end)],
    );
    const totalSteps = Number(rows?.[0]?.totalSteps ?? 0);
    const avgSteps = Number(rows?.[0]?.avgSteps ?? 0);
    const days = Number(rows?.[0]?.days ?? 0);
    const goalHitDays = await repo.query(
      `SELECT COUNT(*) as cnt FROM (SELECT MAX(r.steps) as maxSteps FROM health_step_record r
       WHERE r.user_id = ? AND r.record_time BETWEEN ? AND ?
       GROUP BY DATE(r.record_time) HAVING maxSteps >= 10000) daily`,
      [userId, toSql(start), toSql(end)],
    );
    return {
      totalSteps,
      avgSteps: Math.round(avgSteps),
      activeDays: days,
      goalHitDays: Number(goalHitDays?.[0]?.cnt ?? 0),
      totalDistanceKm: calculateDistanceKm(totalSteps, strideLength),
    };
  }

  /**
   * 获取指定时间范围内体重汇总。
   * @param userId - 用户 ID
   * @param start - 起始时间
   * @param end - 结束时间
   * @returns 体重汇总数据
   */
  async function fetchWeightSummary(userId: string, start: dayjs.Dayjs, end: dayjs.Dayjs) {
    const repo = appDataSource.getRepository(HealthFitnessWeightRecordEntity);
    const startDate = toDateStr(start);
    const endDate = toDateStr(end);
    const [first, latest] = await Promise.all([
      repo.createQueryBuilder('w')
        .where('w.user_id = :userId', { userId })
        .andWhere('w.date BETWEEN :start AND :end', { start: startDate, end: endDate })
        .orderBy('w.date', 'ASC')
        .getOne(),
      repo.createQueryBuilder('w')
        .where('w.user_id = :userId', { userId })
        .andWhere('w.date BETWEEN :start AND :end', { start: startDate, end: endDate })
        .orderBy('w.date', 'DESC')
        .addOrderBy('w.updated_at', 'DESC')
        .getOne(),
    ]);
    return {
      firstWeight: first ? Number(first.weight) : null,
      latestWeight: latest ? Number(latest.weight) : null,
      weightChange: first && latest ? Number((Number(latest.weight) - Number(first.weight)).toFixed(1)) : null,
      recordCount: await repo.createQueryBuilder('w')
        .where('w.user_id = :userId', { userId })
        .andWhere('w.date BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getCount(),
    };
  }

  /**
   * 获取指定时间范围内运动汇总。
   * @param userId - 用户 ID
   * @param start - 起始时间
   * @param end - 结束时间
   * @returns 运动汇总数据
   */
  async function fetchExerciseSummary(userId: string, start: dayjs.Dayjs, end: dayjs.Dayjs) {
    const repo = appDataSource.getRepository(HealthFitnessExerciseRecordEntity);
    const startDate = toDateStr(start);
    const endDate = toDateStr(end);
    const row = await repo.createQueryBuilder('e')
      .select('COALESCE(SUM(e.calories), 0)', 'totalCalories')
      .addSelect('COALESCE(SUM(e.duration), 0)', 'totalDuration')
      .addSelect('COUNT(*)', 'count')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();
    const days = await repo.createQueryBuilder('e')
      .select('COUNT(DISTINCT e.date)', 'days')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();
    return {
      totalCalories: Number(row?.totalCalories ?? 0),
      totalDuration: Number(row?.totalDuration ?? 0),
      totalSessions: Number(row?.count ?? 0),
      activeDays: Number(days?.days ?? 0),
    };
  }

  /**
   * 获取指定时间范围内饮食汇总。
   * @param userId - 用户 ID
   * @param start - 起始时间
   * @param end - 结束时间
   * @returns 饮食汇总数据
   */
  async function fetchDietSummary(userId: string, start: dayjs.Dayjs, end: dayjs.Dayjs) {
    const repo = appDataSource.getRepository(HealthFitnessDietRecordEntity);
    const startDate = toDateStr(start);
    const endDate = toDateStr(end);
    const row = await repo.createQueryBuilder('d')
      .select('COALESCE(SUM(d.calories), 0)', 'inCalories')
      .addSelect('COUNT(*)', 'count')
      .where('d.user_id = :userId', { userId })
      .andWhere('d.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();
    const exerciseRepo = appDataSource.getRepository(HealthFitnessExerciseRecordEntity);
    const outRow = await exerciseRepo.createQueryBuilder('e')
      .select('COALESCE(SUM(e.calories), 0)', 'outCalories')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();
    const inCal = Number(row?.inCalories ?? 0);
    const outCal = Number(outRow?.outCalories ?? 0);
    return {
      intakeCalories: inCal,
      recordCount: Number(row?.count ?? 0),
      netCalories: inCal - outCal,
      avgNetCalories: start.diff(end, 'day') !== 0
        ? Math.round((inCal - outCal) / Math.max(1, end.diff(start, 'day') + 1))
        : inCal - outCal,
    };
  }

  /**
   * 获取指定时间范围内用药汇总。
   * @param userId - 用户 ID
   * @param start - 起始时间
   * @param end - 结束时间
   * @returns 用药汇总数据
   */
  async function fetchMedicationSummary(userId: string, start: dayjs.Dayjs, end: dayjs.Dayjs) {
    const repo = appDataSource.getRepository(HealthMedicationRecordEntity);
    const startDate = toDateStr(start);
    const endDate = toDateStr(end);
    const row = await repo.createQueryBuilder('m')
      .select('COUNT(DISTINCT m.date)', 'days')
      .addSelect('COUNT(*)', 'count')
      .where('m.user_id = :userId', { userId })
      .andWhere('m.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();
    return {
      recordDays: Number(row?.days ?? 0),
      recordCount: Number(row?.count ?? 0),
    };
  }

  /**
   * 获取指定时间范围内体检汇总。
   * @param userId - 用户 ID
   * @param start - 起始时间
   * @param end - 结束时间
   * @returns 体检汇总数据
   */
  async function fetchCheckupSummary(userId: string, start: dayjs.Dayjs, end: dayjs.Dayjs) {
    const repo = appDataSource.getRepository(HealthCheckupRecordEntity);
    const startDate = toDateStr(start);
    const endDate = toDateStr(end);
    const row = await repo.createQueryBuilder('c')
      .select('COUNT(c.id)', 'total')
      .addSelect('SUM(CASE WHEN c.status = \'abnormal\' THEN 1 ELSE 0 END)', 'abnormal')
      .addSelect('SUM(CASE WHEN c.status = \'attention\' THEN 1 ELSE 0 END)', 'attention')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.test_date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();
    return {
      totalRecords: Number(row?.total ?? 0),
      abnormalCount: Number(row?.abnormal ?? 0),
      attentionCount: Number(row?.attention ?? 0),
    };
  }

  /**
   * GET /api/health/report/summary?period=week|month|year&date=YYYY-MM-DD
   * 周期健康报告汇总：跨子模块聚合 + 同环比。
   */
  router.get('/summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const period = String(request.query.period ?? 'month') as 'week' | 'month' | 'year';
    const dateStr = String(request.query.date ?? dayjs().format('YYYY-MM-DD'));

    if (!['week', 'month', 'year'].includes(period)) {
      throw new AppError('invalid_period', 400, 400);
    }

    const range = resolvePeriodRange(period, dateStr);
    const strideLength = await getStrideLength(userId);

    const [
      currentStep, previousStep,
      currentWeight, previousWeight,
      currentExercise, previousExercise,
      currentDiet, previousDiet,
      currentMedication, previousMedication,
      currentCheckup, previousCheckup,
    ] = await Promise.all([
      fetchStepSummary(userId, strideLength, range.current.start, range.current.end),
      fetchStepSummary(userId, strideLength, range.previous.start, range.previous.end),
      fetchWeightSummary(userId, range.current.start, range.current.end),
      fetchWeightSummary(userId, range.previous.start, range.previous.end),
      fetchExerciseSummary(userId, range.current.start, range.current.end),
      fetchExerciseSummary(userId, range.previous.start, range.previous.end),
      fetchDietSummary(userId, range.current.start, range.current.end),
      fetchDietSummary(userId, range.previous.start, range.previous.end),
      fetchMedicationSummary(userId, range.current.start, range.current.end),
      fetchMedicationSummary(userId, range.previous.start, range.previous.end),
      fetchCheckupSummary(userId, range.current.start, range.current.end),
      fetchCheckupSummary(userId, range.previous.start, range.previous.end),
    ]);

    response.json(successResponse({
      period,
      date: dateStr,
      current: {
        label: range.current.label,
        start: toDateStr(range.current.start),
        end: toDateStr(range.current.end),
        step: currentStep,
        weight: currentWeight,
        exercise: currentExercise,
        diet: currentDiet,
        medication: currentMedication,
        checkup: currentCheckup,
      },
      previous: {
        label: range.previous.label,
        start: toDateStr(range.previous.start),
        end: toDateStr(range.previous.end),
        step: previousStep,
        weight: previousWeight,
        exercise: previousExercise,
        diet: previousDiet,
        medication: previousMedication,
        checkup: previousCheckup,
      },
      changes: {
        step: { percent: diffPercent(currentStep.totalSteps, previousStep.totalSteps), trend: currentStep.totalSteps > previousStep.totalSteps ? 'up' : currentStep.totalSteps < previousStep.totalSteps ? 'down' : 'flat' },
        exercise: { percent: diffPercent(currentExercise.totalCalories, previousExercise.totalCalories), trend: currentExercise.totalCalories > previousExercise.totalCalories ? 'up' : currentExercise.totalCalories < previousExercise.totalCalories ? 'down' : 'flat' },
        diet: { percent: diffPercent(currentDiet.netCalories, previousDiet.netCalories), trend: currentDiet.netCalories > previousDiet.netCalories ? 'up' : currentDiet.netCalories < previousDiet.netCalories ? 'down' : 'flat' },
        weight: { percent: null, trend: currentWeight.weightChange === null ? 'none' : currentWeight.weightChange > 0 ? 'up' : currentWeight.weightChange < 0 ? 'down' : 'flat' },
      },
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }));
  }));

  /**
   * GET /api/health/report/abnormal?period=month&date=YYYY-MM
   * 异常指标识别：返回周期内异常的体检指标 + 用药低记录 + 异常体重变化。
   */
  router.get('/abnormal', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const period = String(request.query.period ?? 'month') as 'week' | 'month' | 'year';
    const dateStr = String(request.query.date ?? dayjs().format('YYYY-MM-DD'));

    if (!['week', 'month', 'year'].includes(period)) {
      throw new AppError('invalid_period', 400, 400);
    }

    const range = resolvePeriodRange(period, dateStr);
    const startDate = toDateStr(range.current.start);
    const endDate = toDateStr(range.current.end);

    const checkupRepo = appDataSource.getRepository(HealthCheckupRecordEntity);
    const abnormalRecords = await checkupRepo
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.test_date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere("c.status IN ('abnormal', 'attention')")
      .orderBy("FIELD(c.status, 'abnormal', 'attention')", 'DESC')
      .addOrderBy('c.test_date', 'DESC')
      .getMany();

    const medicationRepo = appDataSource.getRepository(HealthMedicationRecordEntity);
    const medicationDays = await medicationRepo
      .createQueryBuilder('m')
      .select('COUNT(DISTINCT m.date)', 'days')
      .where('m.user_id = :userId', { userId })
      .andWhere('m.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();

    const totalDays = range.current.end.diff(range.current.start, 'day') + 1;
    const medicationCoverage = totalDays > 0 ? Number(medicationDays?.days ?? 0) / totalDays : 0;

    const weightRepo = appDataSource.getRepository(HealthFitnessWeightRecordEntity);
    const weightRecords = await weightRepo
      .createQueryBuilder('w')
      .where('w.user_id = :userId', { userId })
      .andWhere('w.date BETWEEN :start AND :end', { start: startDate, end: endDate })
      .orderBy('w.date', 'ASC')
      .getMany();

    const weightChangeAlert = weightRecords.length >= 2
      ? {
          change: Number((Number(weightRecords[weightRecords.length - 1].weight) - Number(weightRecords[0].weight)).toFixed(1)),
          threshold: 2.0,
          isAlert: Math.abs(Number(weightRecords[weightRecords.length - 1].weight) - Number(weightRecords[0].weight)) >= 2.0,
        }
      : null;

    response.json(successResponse({
      period,
      date: dateStr,
      range: { start: startDate, end: endDate, label: range.current.label },
      abnormalCheckupRecords: abnormalRecords.map((r) => ({
        id: r.id,
        testDate: r.test_date,
        testType: r.test_type,
        testName: r.test_name,
        value: Number(r.value),
        unit: r.unit,
        referenceRange: r.reference_range,
        status: r.status,
        notes: r.notes,
      })),
      abnormalCount: abnormalRecords.length,
      medication: {
        recordDays: Number(medicationDays?.days ?? 0),
        totalDays,
        coverage: Number(medicationCoverage.toFixed(2)),
        isLow: medicationCoverage < 0.7,
      },
      weightChangeAlert,
    }));
  }));

  /**
   * POST /api/health/report/ai-suggestion
   * AI 健康建议生成：基于周期内健康数据调用 DeepSeek 生成个性化建议。
   * Body: { period, date, summary?, abnormal? }
   */
  router.post('/ai-suggestion', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const body = request.body as { period?: string; date?: string; summary?: unknown; abnormal?: unknown };
    const period = String(body.period ?? 'month') as 'week' | 'month' | 'year';
    const dateStr = String(body.date ?? dayjs().format('YYYY-MM-DD'));

    if (!['week', 'month', 'year'].includes(period)) {
      throw new AppError('invalid_period', 400, 400);
    }

    if (!env.DEEPSEEK_API_KEY) {
      throw new AppError('ai_not_configured', 503, 503);
    }

    // 拉取周期数据
    const range = resolvePeriodRange(period, dateStr);
    const strideLength = await getStrideLength(userId);
    const [step, weight, exercise, diet, medication, checkup] = await Promise.all([
      fetchStepSummary(userId, strideLength, range.current.start, range.current.end),
      fetchWeightSummary(userId, range.current.start, range.current.end),
      fetchExerciseSummary(userId, range.current.start, range.current.end),
      fetchDietSummary(userId, range.current.start, range.current.end),
      fetchMedicationSummary(userId, range.current.start, range.current.end),
      fetchCheckupSummary(userId, range.current.start, range.current.end),
    ]);

    // 异常指标
    const checkupRepo = appDataSource.getRepository(HealthCheckupRecordEntity);
    const abnormalRecords = await checkupRepo
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.test_date BETWEEN :start AND :end', { start: toDateStr(range.current.start), end: toDateStr(range.current.end) })
      .andWhere("c.status IN ('abnormal', 'attention')")
      .orderBy("FIELD(c.status, 'abnormal', 'attention')", 'DESC')
      .addOrderBy('c.test_date', 'DESC')
      .limit(10)
      .getMany();

    const systemPrompt = `你是一名专业的健康管理顾问。请根据用户的健康数据，给出个性化、可执行的健康建议。
要求：
1. 必须只返回 JSON，格式：{"summary": string, "suggestions": Array<{category: string, priority: "high"|"medium"|"low", title: string, detail: string}>, "risks": Array<string>}
2. summary：一句话总结本期健康状态（30 字以内）
3. suggestions：3-5 条具体建议，category 取值：step/exercise/diet/weight/medication/checkup/sleep
4. priority：high 需立即改善，medium 建议改善，low 保持现状
5. detail：具体行动指引（50 字以内，可执行）
6. risks：识别到的健康风险（数组，每项 20 字以内）
7. 语气专业但友好，避免医学术语`;

    const userPrompt = `周期：${range.current.label}
【步数】总 ${step.totalSteps} 步，日均 ${step.avgSteps} 步，达标 ≥1 万步 ${step.goalHitDays} 天，距离 ${step.totalDistanceKm} 公里
【体重】${weight.latestWeight !== null ? `最新 ${weight.latestWeight} kg，变化 ${weight.weightChange} kg` : '无记录'}
【运动】消耗 ${exercise.totalCalories} kcal，时长 ${exercise.totalDuration} 分钟，${exercise.activeDays} 天有运动
【饮食】摄入 ${diet.intakeCalories} kcal，净热量 ${diet.netCalories} kcal，日均净 ${diet.avgNetCalories} kcal
【用药】记录 ${medication.recordDays} 天
【体检】总 ${checkup.totalRecords} 项，异常 ${checkup.abnormalCount} 项，关注 ${checkup.attentionCount} 项
【异常指标】${abnormalRecords.length > 0 ? abnormalRecords.map((r) => `${r.test_name}: ${r.value}${r.unit}（${r.status}）`).join('；') : '无'}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const aiResponse = await fetch(`${env.DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      const error = new Error(`DeepSeek HTTP ${aiResponse.status}: ${text.slice(0, 200)}`);
      // 异步记录用量
      setImmediate(() => {
        void recordAssistantUsage({
          userId,
          scene: `health.report.${period}`,
          requestCount: 1,
          prompt: estimateTokens(systemPrompt + userPrompt),
          completion: 0,
          status: 'error',
        });
      });
      throw new AppError(error.message, 502, 502);
    }

    const aiJson = (await aiResponse.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = aiJson.choices?.[0]?.message?.content || '{}';
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AppError('AI 返回非 JSON 格式', 502, 502);
    }

    // Zod 校验
    const suggestionSchema = z.object({
      summary: z.string().max(100),
      suggestions: z.array(z.object({
        category: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        title: z.string().max(50),
        detail: z.string().max(100),
      })).min(1).max(8),
      risks: z.array(z.string().max(50)).default([]),
    });
    const validated = suggestionSchema.parse(parsed);

    // 异步记录用量
    setImmediate(() => {
      void recordAssistantUsage({
        userId,
        scene: `health.report.${period}`,
        requestCount: 1,
        prompt: estimateTokens(systemPrompt + userPrompt),
        completion: estimateTokens(content),
        status: 'success',
      });
    });

    response.json(successResponse({
      period,
      date: dateStr,
      label: range.current.label,
      suggestion: validated,
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }));
  }));

  return router;
}
