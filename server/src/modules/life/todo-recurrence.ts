import dayjs from 'dayjs';

import { computeNextOccurrence, isRecurringType } from '../../shared/recurrence';
import type { LifeTodoRecurrenceConfig, LifeTodoRecurrenceType } from './entities/life-todo-task.entity';

export { isRecurringType };

/**
 * 根据重复规则计算下一次到期日（YYYY-MM-DD）。
 * @param recurrenceType  重复类型
 * @param recurrenceConfig 重复配置
 * @param fromDate         基准日期（默认今天），用于 weekly/monthly 的"下一次"
 * @param fallbackDate     任务原 due_date；若 recurrenceType='none' 则原样返回
 */
export function computeNextRecurrenceDate(
  recurrenceType: LifeTodoRecurrenceType,
  recurrenceConfig: LifeTodoRecurrenceConfig | null | undefined,
  fromDate?: string,
  fallbackDate?: string | null,
): string | null {
  if (recurrenceType === 'none' || recurrenceType === undefined || recurrenceType === null) {
    return fallbackDate ?? null;
  }

  const base = fromDate ? dayjs(fromDate, 'YYYY-MM-DD', true) : dayjs();
  if (!base.isValid()) {
    return fallbackDate ?? null;
  }

  const next = computeNextOccurrence(recurrenceType, recurrenceConfig, base);
  return next ? next.format('YYYY-MM-DD') : (fallbackDate ?? null);
}

/**
 * 根据实体的实际数据规整出"对外"的重复类型（兼容老数据 is_daily=1）。
 */
export function resolveRecurrenceType(
  recurrenceType: LifeTodoRecurrenceType | string | null | undefined,
  isDaily: boolean,
): LifeTodoRecurrenceType {
  if (recurrenceType && recurrenceType !== 'none') {
    return recurrenceType as LifeTodoRecurrenceType;
  }
  if (isDaily) {
    return 'daily';
  }
  return 'none';
}
