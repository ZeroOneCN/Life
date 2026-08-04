import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { HealthStepRecordEntity } from './entities/health-step-record.entity';
import { AppError } from '../../shared/errors/app-error';

/** 步数记录创建入参 */
export interface CreateStepInput {
  steps: number;
  recordTime: string;
  hour?: number | null;
}

/** 步数记录响应 DTO */
export interface StepRecordDto {
  id: string;
  userId: string;
  steps: number;
  hour: number | null;
  recordTime: string;
  createdAt: string;
  updatedAt: string;
}

/** 按日聚合的步数结果 */
export interface DailyStepAggregate {
  date: string;
  steps: number;
  recordCount: number;
}

/**
 * 按日聚合查询步数（MAX(steps) + GROUP BY DATE）。
 * 与 step.router.ts GET /trend 和 assistant.tools.ts queryHealth 口径一致。
 * @param userId 用户 ID
 * @param startDate 起始日期 YYYY-MM-DD
 * @param endDate 结束日期 YYYY-MM-DD
 * @param hour 可选的小时过滤（0-23）
 * @returns 按日聚合列表
 */
export async function getDailyMaxSteps(
  userId: string,
  startDate: string,
  endDate: string,
  hour?: number,
): Promise<DailyStepAggregate[]> {
  const repository = appDataSource.getRepository(HealthStepRecordEntity);
  const startTs = `${startDate} 00:00:00`;
  const endTs = `${endDate} 23:59:59`;

  let sql = "SELECT DATE_FORMAT(record_time, '%Y-%m-%d') as date, MAX(steps) as totalSteps, COUNT(*) as recordCount FROM health_step_record WHERE user_id = ? AND record_time BETWEEN ? AND ?";
  const params: unknown[] = [userId, startTs, endTs];

  if (hour !== undefined && hour !== null) {
    sql += ' AND hour = ?';
    params.push(hour);
  }

  sql += " GROUP BY DATE_FORMAT(record_time, '%Y-%m-%d') ORDER BY date ASC";

  const rows = await repository.query(sql, params);
  return rows.map((row: Record<string, unknown>) => ({
    date: String(row.date),
    steps: Number(row.totalSteps) || 0,
    recordCount: Number(row.recordCount) || 0,
  }));
}

/**
 * 计算月度步数总和（先按日 MAX 再 SUM，与 step.router.ts /summary 一致）。
 * @param userId 用户 ID
 * @param monthStart 月初时间戳
 * @param monthEnd 月末时间戳
 * @returns 月度步数总和
 */
export async function getMonthStepsSum(
  userId: string,
  monthStart: string,
  monthEnd: string,
): Promise<number> {
  const repository = appDataSource.getRepository(HealthStepRecordEntity);
  const result = await repository.query(
    'SELECT SUM(daily.maxSteps) as totalSteps FROM (SELECT MAX(r2.steps) as maxSteps FROM health_step_record r2 WHERE r2.user_id = ? AND r2.record_time BETWEEN ? AND ? GROUP BY DATE(r2.record_time)) daily',
    [userId, monthStart, monthEnd],
  );
  return Number(result?.[0]?.totalSteps) || 0;
}

/**
 * 将步数记录实体转为前端响应对象。
 * @param entity 步数记录实体
 * @returns 前端响应 DTO
 */
export function mapStepRecord(entity: HealthStepRecordEntity): StepRecordDto {
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

/**
 * 创建步数记录（含同日同 hour 重复检查）。
 * @param userId 用户 ID
 * @param input 创建入参
 * @returns 保存后的实体
 */
export async function createStepRecord(
  userId: string,
  input: CreateStepInput,
): Promise<HealthStepRecordEntity> {
  const steps = Math.max(0, Math.round(input.steps));
  if (!steps) {
    throw new AppError('steps 必须大于 0', 400, 400);
  }
  const recordTime = dayjs(input.recordTime);
  if (!recordTime.isValid()) {
    throw new AppError(`recordTime 解析失败：${input.recordTime}`, 400, 400);
  }
  const dateStr = recordTime.format('YYYY-MM-DD');
  const hour = input.hour === undefined || input.hour === null
    ? null
    : Math.max(0, Math.min(23, Math.round(input.hour)));

  const repository = appDataSource.getRepository(HealthStepRecordEntity);

  // 重复检查：同 user + 同 date + 同 hour
  const dateStart = dayjs(`${dateStr}T00:00:00`).toDate();
  const dateEnd = dayjs(`${dateStr}T23:59:59`).toDate();
  const existing = await repository
    .createQueryBuilder('r')
    .where('r.user_id = :userId', { userId })
    .andWhere('r.record_time BETWEEN :start AND :end', { start: dateStart, end: dateEnd })
    .andWhere(hour !== null ? 'r.hour = :hour' : 'r.hour IS NULL', hour !== null ? { hour } : {})
    .getOne();

  if (existing) {
    throw new AppError('该日期已有步数记录，请检查后重新录入', 409, 409);
  }

  const item = await repository.save(repository.create({
    user_id: userId,
    steps,
    hour,
    record_time: recordTime.toDate(),
  }));
  return item;
}
