import dayjs from 'dayjs';

import type { LifeTodoRecurrenceConfig, LifeTodoRecurrenceType } from './entities/life-todo-task.entity';

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

  if (recurrenceType === 'daily') {
    return base.add(1, 'day').format('YYYY-MM-DD');
  }

  if (recurrenceType === 'weekly') {
    const weekdays = (recurrenceConfig?.weekdays ?? []).filter((value) => value >= 0 && value <= 6);
    if (!weekdays.length) {
      return base.add(7, 'day').format('YYYY-MM-DD');
    }
    for (let step = 1; step <= 7; step += 1) {
      const candidate = base.add(step, 'day');
      if (weekdays.includes(candidate.day())) {
        return candidate.format('YYYY-MM-DD');
      }
    }
    return base.add(1, 'day').format('YYYY-MM-DD');
  }

  if (recurrenceType === 'monthly') {
    const dayOfMonth = Math.max(1, Math.min(31, Number(recurrenceConfig?.dayOfMonth ?? base.date())));
    const nextMonth = base.add(1, 'month');
    const lastDay = nextMonth.daysInMonth();
    const targetDay = Math.min(dayOfMonth, lastDay);
    return nextMonth.date(targetDay).format('YYYY-MM-DD');
  }

  return fallbackDate ?? null;
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

/**
 * 判断给定重复类型是否会产生"下一次到期日"。
 */
export function isRecurringType(type: LifeTodoRecurrenceType): boolean {
  return type === 'daily' || type === 'weekly' || type === 'monthly';
}
