import type { Dayjs } from 'dayjs';

/**
 * 重复类型（daily/weekly/monthly/none）
 */
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'none';

/**
 * 重复配置（weekday 约定 dayjs 0-6，0=周日）
 */
export interface RecurrenceConfig {
  weekdays?: number[];
  dayOfMonth?: number;
}

/**
 * 判断给定重复类型是否会产生重复事件
 * @param type 重复类型
 * @returns 是否为重复类型（daily/weekly/monthly）
 */
export function isRecurringType(type: RecurrenceType | string | null | undefined): boolean {
  return type === 'daily' || type === 'weekly' || type === 'monthly';
}

/**
 * 规整重复配置：过滤无效值、去重、排序
 * @param config 原始配置
 * @returns 规整后的配置或 null
 */
export function normalizeRecurrenceConfig(
  config: RecurrenceConfig | null | undefined,
): RecurrenceConfig | null {
  if (!config) {
    return null;
  }
  const result: RecurrenceConfig = {};
  if (Array.isArray(config.weekdays)) {
    const unique = [...new Set(config.weekdays.filter((value) => value >= 0 && value <= 6))];
    if (unique.length) {
      result.weekdays = unique.sort((left, right) => left - right);
    }
  }
  if (typeof config.dayOfMonth === 'number' && config.dayOfMonth >= 1 && config.dayOfMonth <= 31) {
    result.dayOfMonth = config.dayOfMonth;
  }
  return Object.keys(result).length ? result : null;
}

/**
 * 根据重复规则计算下一次发生时间（核心算法，基于 Dayjs）
 * @param recurrenceType  重复类型
 * @param recurrenceConfig 重复配置
 * @param fromBase        基准时间（上次发生时间）
 * @returns 下一次发生时间，无法计算返回 null
 */
export function computeNextOccurrence(
  recurrenceType: RecurrenceType | string | null | undefined,
  recurrenceConfig: RecurrenceConfig | null | undefined,
  fromBase: Dayjs,
): Dayjs | null {
  if (!isRecurringType(recurrenceType)) {
    return null;
  }

  if (recurrenceType === 'daily') {
    return fromBase.add(1, 'day');
  }

  if (recurrenceType === 'weekly') {
    const weekdays = (recurrenceConfig?.weekdays ?? []).filter((value) => value >= 0 && value <= 6);
    if (!weekdays.length) {
      return fromBase.add(7, 'day');
    }
    for (let step = 1; step <= 7; step += 1) {
      const candidate = fromBase.add(step, 'day');
      if (weekdays.includes(candidate.day())) {
        return candidate;
      }
    }
    return fromBase.add(1, 'day');
  }

  if (recurrenceType === 'monthly') {
    const dayOfMonth = Math.max(1, Math.min(31, Number(recurrenceConfig?.dayOfMonth ?? fromBase.date())));
    const nextMonth = fromBase.add(1, 'month');
    const lastDay = nextMonth.daysInMonth();
    const targetDay = Math.min(dayOfMonth, lastDay);
    return nextMonth.date(targetDay);
  }

  return null;
}
