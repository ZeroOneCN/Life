import { Router } from 'express';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { AppError } from '../../shared/errors/app-error';
import { HealthStepRecordEntity } from './entities/health-step-record.entity';
import { HealthStepSettingEntity } from './entities/health-step-setting.entity';
import { HealthFitnessDietRecordEntity } from './entities/health-fitness-diet-record.entity';
import { HealthFitnessExerciseRecordEntity } from './entities/health-fitness-exercise-record.entity';
import { HealthFitnessWeightRecordEntity } from './entities/health-fitness-weight-record.entity';
import { HealthFitnessSettingEntity } from './entities/health-fitness-setting.entity';
import { HealthMedicationRecordEntity } from './entities/health-medication-record.entity';
import { HealthCheckupRecordEntity } from './entities/health-checkup-record.entity';

/**
 * 健康仪表盘 Router
 *
 * 提供跨子模块聚合的概览、热力图、对比、雷达等数据接口，
 * 供前端「健康概览」页面统一展示。
 *
 * 路径前缀：/api/health/dashboard
 */
export function createHealthDashboardRouter() {
  const router = Router();

  /**
   * 从请求中解析目标用户 ID。
   * 默认使用认证用户；若传入 userId 且非空则使用传入值（用于家庭/共享场景）。
   * @param request - 认证请求对象
   * @returns 目标用户 ID
   */
  function resolveUserId(request: AuthenticatedRequest) {
    const authUserId = requireAuthUser(request);
    const raw = String(request.query.userId ?? '').trim();
    return raw || authUserId;
  }

  /**
   * 计算步数距离（公里）。
   * @param steps - 步数
   * @param strideLength - 步幅（米）
   * @returns 距离（公里），保留 2 位小数
   */
  function calculateDistanceKm(steps: number, strideLength: number) {
    if (steps <= 0 || strideLength <= 0) return 0;
    return Number(((steps * strideLength) / 1000).toFixed(2));
  }

  /**
   * 获取或创建步数设置中的步幅。
   * @param authUserId - 认证用户 ID
   * @returns 步幅（米）
   */
  async function getStrideLength(authUserId: string) {
    const repository = appDataSource.getRepository(HealthStepSettingEntity);
    const setting = await repository.findOne({ where: { user_id: authUserId } });
    return Number(setting?.stride_length ?? 0.7);
  }

  /**
   * 获取或创建健身设置中的默认身高。
   * @param authUserId - 认证用户 ID
   * @returns 默认身高（cm）
   */
  async function getDefaultHeightCm(authUserId: string) {
    const repository = appDataSource.getRepository(HealthFitnessSettingEntity);
    const setting = await repository.findOne({ where: { user_id: authUserId } });
    return Number(setting?.default_height_cm ?? 170);
  }

  /**
   * 计算 BMI。
   * @param weightKg - 体重（kg）
   * @param heightCm - 身高（cm）
   * @returns BMI 值，保留 1 位小数；输入非法返回 null
   */
  function calculateBmi(weightKg: number, heightCm: number) {
    if (weightKg <= 0 || heightCm <= 0) return null;
    const heightM = heightCm / 100;
    return Number((weightKg / (heightM * heightM)).toFixed(1));
  }

  /**
   * 根据步数推算当日达标等级（用于雷达图 / 概览提示）。
   * @param steps - 步数
   * @returns 等级分数（0-100）
   */
  function scoreStep(steps: number) {
    if (steps <= 0) return 0;
    if (steps >= 10000) return 100;
    return Math.round((steps / 10000) * 100);
  }

  /**
   * 根据近 30 天运动天数推算运动等级。
   * @param workoutDays - 运动天数
   * @returns 等级分数（0-100）
   */
  function scoreExercise(workoutDays: number) {
    if (workoutDays <= 0) return 0;
    if (workoutDays >= 12) return 100;
    return Math.round((workoutDays / 12) * 100);
  }

  /**
   * 根据近 30 天用药记录覆盖率推算依从度。
   * @param recordDays - 有记录的天数
   * @param plannedDays - 计划天数（按 30 天）
   * @returns 等级分数（0-100）
   */
  function scoreMedication(recordDays: number, plannedDays: number) {
    if (plannedDays <= 0) return 0;
    return Math.min(100, Math.round((recordDays / plannedDays) * 100));
  }

  /**
   * 根据体检异常率推算体检健康度。
   * @param totalRecords - 体检记录总数
   * @param abnormalCount - 异常记录数
   * @returns 等级分数（0-100，异常越少分数越高）
   */
  function scoreCheckup(totalRecords: number, abnormalCount: number) {
    if (totalRecords <= 0) return 0;
    const abnormalRate = abnormalCount / totalRecords;
    return Math.max(0, Math.round((1 - abnormalRate) * 100));
  }

  /**
   * 根据 BMI 推算体重健康度。
   * @param bmi - BMI 值
   * @returns 等级分数（0-100，标准区间 18.5-24 为满分）
   */
  function scoreWeight(bmi: number | null) {
    if (bmi === null) return 0;
    if (bmi >= 18.5 && bmi <= 24) return 100;
    if (bmi < 18.5) {
      return Math.max(0, Math.round((bmi / 18.5) * 100));
    }
    // 超重：每超出 1 个 BMI 单位扣 8 分
    return Math.max(0, 100 - Math.round((bmi - 24) * 8));
  }

  /**
   * 根据近 30 天净热量摄入推算饮食控制度。
   * 目标：日均净热量在 ±300 kcal 内视为均衡。
   * @param avgNetCalories - 日均净热量
   * @returns 等级分数（0-100）
   */
  function scoreDiet(avgNetCalories: number) {
    if (avgNetCalories <= 0) return 0;
    const deviation = Math.abs(avgNetCalories);
    if (deviation <= 300) return 100;
    return Math.max(0, 100 - Math.round((deviation - 300) / 10));
  }

  /**
   * GET /api/health/dashboard/overview
   * 跨子模块综合概览：步数 / 体重 / 运动 / 用药 / 体检的关键指标聚合。
   */
  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = resolveUserId(request);
    const [strideLength, defaultHeightCm] = await Promise.all([
      getStrideLength(authUserId),
      getDefaultHeightCm(authUserId),
    ]);

    const today = dayjs().format('YYYY-MM-DD');
    const currentMonth = dayjs().format('YYYY-MM');
    const monthStart = dayjs(`${currentMonth}-01`).startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const monthEnd = dayjs(`${currentMonth}-01`).endOf('month').format('YYYY-MM-DD HH:mm:ss');
    const last30DaysStart = dayjs().subtract(29, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const nowEnd = dayjs().format('YYYY-MM-DD HH:mm:ss');

    const stepRepo = appDataSource.getRepository(HealthStepRecordEntity);
    const weightRepo = appDataSource.getRepository(HealthFitnessWeightRecordEntity);
    const exerciseRepo = appDataSource.getRepository(HealthFitnessExerciseRecordEntity);
    const dietRepo = appDataSource.getRepository(HealthFitnessDietRecordEntity);
    const medicationRepo = appDataSource.getRepository(HealthMedicationRecordEntity);
    const checkupRepo = appDataSource.getRepository(HealthCheckupRecordEntity);

    const [
      todayStepRows,
      monthStepRows,
      latestWeight,
      latestExerciseRows,
      last30ExerciseDays,
      last30DietNet,
      last30MedicationDays,
      checkupStats,
    ] = await Promise.all([
      // 今日步数（取 MAX，因为步数可能分时段累加录入）
      stepRepo.query(
        'SELECT MAX(steps) as maxSteps FROM health_step_record WHERE user_id = ? AND record_time BETWEEN ? AND ?',
        [userId, `${today} 00:00:00`, `${today} 23:59:59`],
      ),
      // 本月步数（每天 MAX 求和）
      stepRepo.query(
        'SELECT SUM(daily.maxSteps) as totalSteps FROM (SELECT MAX(r2.steps) as maxSteps FROM health_step_record r2 WHERE r2.user_id = ? AND r2.record_time BETWEEN ? AND ? GROUP BY DATE(r2.record_time)) daily',
        [userId, monthStart, monthEnd],
      ),
      // 最新体重
      weightRepo.findOne({
        where: { user_id: userId },
        order: { date: 'DESC', updated_at: 'DESC' },
      }),
      // 今日运动消耗
      exerciseRepo.findOne({
        where: { user_id: userId, date: today as never },
        order: { updated_at: 'DESC' },
      }),
      // 近 30 天运动天数
      exerciseRepo
        .createQueryBuilder('e')
        .select('COUNT(DISTINCT e.date)', 'days')
        .where('e.user_id = :userId', { userId })
        .andWhere('e.date >= :start', { start: dayjs().subtract(29, 'day').format('YYYY-MM-DD') })
        .getRawOne(),
      // 近 30 天日均净热量（摄入 - 消耗）
      Promise.all([
        dietRepo
          .createQueryBuilder('d')
          .select('COALESCE(SUM(d.calories), 0)', 'inCalories')
          .where('d.user_id = :userId', { userId })
          .andWhere('d.date >= :start', { start: dayjs().subtract(29, 'day').format('YYYY-MM-DD') })
          .getRawOne(),
        exerciseRepo
          .createQueryBuilder('e')
          .select('COALESCE(SUM(e.calories), 0)', 'outCalories')
          .where('e.user_id = :userId', { userId })
          .andWhere('e.date >= :start', { start: dayjs().subtract(29, 'day').format('YYYY-MM-DD') })
          .getRawOne(),
      ]).then(([inRow, outRow]) => {
        const inCal = Number(inRow?.inCalories ?? 0);
        const outCal = Number(outRow?.outCalories ?? 0);
        return inCal - outCal;
      }),
      // 近 30 天用药记录天数
      medicationRepo
        .createQueryBuilder('m')
        .select('COUNT(DISTINCT m.date)', 'days')
        .where('m.user_id = :userId', { userId })
        .andWhere('m.date >= :start', { start: dayjs().subtract(29, 'day').format('YYYY-MM-DD') })
        .getRawOne(),
      // 体检异常统计
      checkupRepo
        .createQueryBuilder('c')
        .select([
          'COUNT(c.id) as total',
          'SUM(CASE WHEN c.status = \'abnormal\' THEN 1 ELSE 0 END) as abnormal',
          'MAX(c.test_date) as latestDate',
        ])
        .where('c.user_id = :userId', { userId })
        .getRawOne(),
    ]);

    const todaySteps = Number(todayStepRows?.[0]?.maxSteps ?? 0);
    const monthSteps = Number(monthStepRows?.[0]?.totalSteps ?? 0);
    const latestWeightKg = latestWeight ? Number(latestWeight.weight) : null;
    const latestHeightCm = latestWeight ? Number(latestWeight.height) || defaultHeightCm : defaultHeightCm;
    const bmi = latestWeightKg !== null ? calculateBmi(latestWeightKg, latestHeightCm) : null;
    const todayCaloriesOut = latestExerciseRows ? Number(latestExerciseRows.calories) : 0;
    const workoutDays30 = Number(last30ExerciseDays?.days ?? 0);
    const avgNetCalories30 = Number((last30DietNet / 30).toFixed(0));
    const medicationDays30 = Number(last30MedicationDays?.days ?? 0);
    const checkupTotal = Number(checkupStats?.total ?? 0);
    const checkupAbnormal = Number(checkupStats?.abnormal ?? 0);
    const latestCheckupDate = checkupStats?.latestDate ? String(checkupStats.latestDate) : null;

    response.json(successResponse({
      step: {
        todaySteps,
        todayDistanceKm: calculateDistanceKm(todaySteps, strideLength),
        currentMonthSteps: monthSteps,
        currentMonthDistanceKm: calculateDistanceKm(monthSteps, strideLength),
        strideLength,
      },
      weight: {
        latestWeightKg,
        latestHeightCm,
        bmi,
        latestDate: latestWeight?.date ?? null,
      },
      exercise: {
        todayCaloriesOut,
        workoutDays30,
      },
      diet: {
        avgNetCalories30,
      },
      medication: {
        recordDays30: medicationDays30,
        plannedDays30: 30,
      },
      checkup: {
        totalRecords: checkupTotal,
        abnormalCount: checkupAbnormal,
        latestDate: latestCheckupDate,
      },
      last30DaysStart: last30DaysStart,
      last30DaysEnd: nowEnd,
    }));
  }));

  /**
   * GET /api/health/dashboard/step-heatmap?year=2026
   * 步数日历热力图：按天聚合 MAX(steps)。
   */
  router.get('/step-heatmap', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = resolveUserId(request);
    const yearStr = String(request.query.year ?? dayjs().year());
    const year = Number(yearStr);

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      throw new AppError('invalid_year', 400, 400);
    }

    const start = dayjs(`${year}-01-01`).startOf('year').toDate();
    const end = dayjs(`${year}-12-31`).endOf('year').toDate();
    const repository = appDataSource.getRepository(HealthStepRecordEntity);

    const rows = await repository.query(
      `SELECT DATE_FORMAT(record_time, '%Y-%m-%d') as date, MAX(steps) as steps
       FROM health_step_record
       WHERE user_id = ? AND record_time BETWEEN ? AND ?
       GROUP BY DATE_FORMAT(record_time, '%Y-%m-%d')
       ORDER BY date ASC`,
      [userId, start, end],
    );

    const result = rows.map((row: Record<string, unknown>) => ({
      date: String(row.date),
      steps: Number(row.steps),
      distanceKm: calculateDistanceKm(Number(row.steps), 0.7),
    }));

    response.json(successResponse({ year, items: result }));
  }));

  /**
   * GET /api/health/dashboard/comparison?metric=step|weight|exercise|medication&period=month|year&date=2026-07
   * 同比/环比对比：当前周期 vs 上一周期。
   */
  router.get('/comparison', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = resolveUserId(request);
    const metric = String(request.query.metric ?? 'step');
    const period = String(request.query.period ?? 'month');
    const dateStr = String(request.query.date ?? dayjs().format(period === 'year' ? 'YYYY' : 'YYYY-MM'));

    const validMetrics = ['step', 'weight', 'exercise', 'medication'];
    if (!validMetrics.includes(metric)) {
      throw new AppError('invalid_metric', 400, 400);
    }
    if (period !== 'month' && period !== 'year') {
      throw new AppError('invalid_period', 400, 400);
    }

    const current = period === 'year' ? dayjs(`${dateStr}-01-01`) : dayjs(`${dateStr}-01`);
    if (!current.isValid()) {
      throw new AppError('invalid_date', 400, 400);
    }
    const previous = current.subtract(1, period === 'year' ? 'year' : 'month');

    const fmt = (d: dayjs.Dayjs) => d.format(period === 'year' ? 'YYYY' : 'YYYY年M月');

    interface RangeSummary {
      label: string;
      value: number;
      recordCount: number;
    }

    /**
     * 内部函数：根据指标和日期范围计算汇总值。
     * @param start - 起始时间字符串
     * @param end - 结束时间字符串
     * @param dateColumn - 日期列名（record_time / date）
     * @returns 当前周期的汇总数据
     */
    async function fetchMetricSummary(start: string, end: string, dateColumn: 'record_time' | 'date'): Promise<RangeSummary> {
      if (metric === 'step') {
        const rows = await appDataSource.getRepository(HealthStepRecordEntity).query(
          `SELECT MAX(steps) as maxPerDay, COUNT(*) as cnt
           FROM (SELECT MAX(r.steps) as steps FROM health_step_record r
                 WHERE r.user_id = ? AND r.${dateColumn} BETWEEN ? AND ?
                 GROUP BY DATE(r.${dateColumn})) daily`,
          [userId, start, end],
        );
        return {
          label: '',
          value: Number(rows?.[0]?.maxPerDay ?? 0),
          recordCount: Number(rows?.[0]?.cnt ?? 0),
        };
      }
      if (metric === 'weight') {
        const latest = await appDataSource.getRepository(HealthFitnessWeightRecordEntity)
          .createQueryBuilder('w')
          .where('w.user_id = :userId', { userId })
          .andWhere(`w.date BETWEEN :start AND :end`, { start, end })
          .orderBy('w.date', 'DESC')
          .getOne();
        return {
          label: '',
          value: latest ? Number(latest.weight) : 0,
          recordCount: latest ? 1 : 0,
        };
      }
      if (metric === 'exercise') {
        const row = await appDataSource.getRepository(HealthFitnessExerciseRecordEntity)
          .createQueryBuilder('e')
          .select('COALESCE(SUM(e.calories), 0)', 'total')
          .addSelect('COUNT(*)', 'cnt')
          .where('e.user_id = :userId', { userId })
          .andWhere(`e.date BETWEEN :start AND :end`, { start, end })
          .getRawOne();
        return {
          label: '',
          value: Number(row?.total ?? 0),
          recordCount: Number(row?.cnt ?? 0),
        };
      }
      // medication
      const row = await appDataSource.getRepository(HealthMedicationRecordEntity)
        .createQueryBuilder('m')
        .select('COUNT(DISTINCT m.date)', 'days')
        .addSelect('COUNT(*)', 'cnt')
        .where('m.user_id = :userId', { userId })
        .andWhere(`m.date BETWEEN :start AND :end`, { start, end })
        .getRawOne();
      return {
        label: '',
        value: Number(row?.days ?? 0),
        recordCount: Number(row?.cnt ?? 0),
      };
    }

    const currentStart = current.startOf(period === 'year' ? 'year' : 'month').format('YYYY-MM-DD HH:mm:ss');
    const currentEnd = current.endOf(period === 'year' ? 'year' : 'month').format('YYYY-MM-DD HH:mm:ss');
    const previousStart = previous.startOf(period === 'year' ? 'year' : 'month').format('YYYY-MM-DD HH:mm:ss');
    const previousEnd = previous.endOf(period === 'year' ? 'year' : 'month').format('YYYY-MM-DD HH:mm:ss');

    const [currentSummary, previousSummary] = await Promise.all([
      fetchMetricSummary(currentStart, currentEnd, metric === 'step' ? 'record_time' : 'date'),
      fetchMetricSummary(previousStart, previousEnd, metric === 'step' ? 'record_time' : 'date'),
    ]);

    const previousValue = previousSummary.value;
    const changePercentage = previousValue === 0
      ? null
      : Number((((currentSummary.value - previousValue) / previousValue) * 100).toFixed(1));

    response.json(successResponse({
      metric,
      period,
      date: dateStr,
      current: { ...currentSummary, label: fmt(current) },
      previous: { ...previousSummary, label: fmt(previous) },
      changePercentage,
      trend: changePercentage === null ? 'none' : changePercentage > 0 ? 'up' : changePercentage < 0 ? 'down' : 'flat',
    }));
  }));

  /**
   * GET /api/health/dashboard/radar
   * 综合健康度雷达图：步数 / 运动 / 饮食 / 用药 / 体检 / 体重 六维评分（0-100）。
   */
  router.get('/radar', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const authUserId = requireAuthUser(request);
    const userId = resolveUserId(request);
    const strideLength = await getStrideLength(authUserId);

    const last30Start = dayjs().subtract(29, 'day').startOf('day').format('YYYY-MM-DD');
    const today = dayjs().format('YYYY-MM-DD');

    const stepRepo = appDataSource.getRepository(HealthStepRecordEntity);
    const weightRepo = appDataSource.getRepository(HealthFitnessWeightRecordEntity);
    const exerciseRepo = appDataSource.getRepository(HealthFitnessExerciseRecordEntity);
    const dietRepo = appDataSource.getRepository(HealthFitnessDietRecordEntity);
    const medicationRepo = appDataSource.getRepository(HealthMedicationRecordEntity);
    const checkupRepo = appDataSource.getRepository(HealthCheckupRecordEntity);

    const [avgStepRow, latestWeight, workoutDaysRow, dietNetRow, medicationDaysRow, checkupStats] = await Promise.all([
      stepRepo.query(
        `SELECT AVG(daily.maxSteps) as avgSteps
         FROM (SELECT MAX(r.steps) as maxSteps FROM health_step_record r
               WHERE r.user_id = ? AND r.record_time BETWEEN ? AND ?
               GROUP BY DATE(r.record_time)) daily`,
        [userId, dayjs().subtract(29, 'day').format('YYYY-MM-DD 00:00:00'), `${today} 23:59:59`],
      ),
      weightRepo.findOne({ where: { user_id: userId }, order: { date: 'DESC', updated_at: 'DESC' } }),
      exerciseRepo
        .createQueryBuilder('e')
        .select('COUNT(DISTINCT e.date)', 'days')
        .where('e.user_id = :userId', { userId })
        .andWhere('e.date >= :start', { start: last30Start })
        .getRawOne(),
      Promise.all([
        dietRepo
          .createQueryBuilder('d')
          .select('COALESCE(SUM(d.calories), 0)', 'inCal')
          .where('d.user_id = :userId', { userId })
          .andWhere('d.date >= :start', { start: last30Start })
          .getRawOne(),
        exerciseRepo
          .createQueryBuilder('e')
          .select('COALESCE(SUM(e.calories), 0)', 'outCal')
          .where('e.user_id = :userId', { userId })
          .andWhere('e.date >= :start', { start: last30Start })
          .getRawOne(),
      ]).then(([inRow, outRow]) => Number(inRow?.inCal ?? 0) - Number(outRow?.outCal ?? 0)),
      medicationRepo
        .createQueryBuilder('m')
        .select('COUNT(DISTINCT m.date)', 'days')
        .where('m.user_id = :userId', { userId })
        .andWhere('m.date >= :start', { start: last30Start })
        .getRawOne(),
      checkupRepo
        .createQueryBuilder('c')
        .select([
          'COUNT(c.id) as total',
          'SUM(CASE WHEN c.status = \'abnormal\' THEN 1 ELSE 0 END) as abnormal',
        ])
        .where('c.user_id = :userId', { userId })
        .getRawOne(),
    ]);

    const avgSteps = Number(avgStepRow?.[0]?.avgSteps ?? 0);
    const workoutDays = Number(workoutDaysRow?.days ?? 0);
    const medicationDays = Number(medicationDaysRow?.days ?? 0);
    const checkupTotal = Number(checkupStats?.total ?? 0);
    const checkupAbnormal = Number(checkupStats?.abnormal ?? 0);
    const avgNetCalories = Number((dietNetRow / 30).toFixed(0));
    const bmi = latestWeight ? calculateBmi(Number(latestWeight.weight), Number(latestWeight.height) || 170) : null;

    const dimensions = [
      { key: 'step', label: '步数', score: scoreStep(Math.round(avgSteps)), value: Math.round(avgSteps), unit: '步/日' },
      { key: 'exercise', label: '运动', score: scoreExercise(workoutDays), value: workoutDays, unit: '天/30天' },
      { key: 'diet', label: '饮食', score: scoreDiet(Math.abs(avgNetCalories)), value: avgNetCalories, unit: 'kcal/日' },
      { key: 'medication', label: '用药', score: scoreMedication(medicationDays, 30), value: medicationDays, unit: '天/30天' },
      { key: 'checkup', label: '体检', score: scoreCheckup(checkupTotal, checkupAbnormal), value: checkupTotal, unit: '条记录' },
      { key: 'weight', label: '体重', score: scoreWeight(bmi), value: bmi, unit: 'BMI' },
    ];

    const overallScore = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);

    response.json(successResponse({
      dimensions,
      overallScore,
      strideLength,
      last30DaysStart: last30Start,
    }));
  }));

  return router;
}
