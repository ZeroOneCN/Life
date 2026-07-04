import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

import type {
  LifeScheduleEventEntity,
  LifeScheduleRecurrenceConfig,
  LifeScheduleRecurrenceType,
} from './entities/life-schedule-event.entity';

dayjs.extend(isBetween);

/**
 * 判断给定重复类型是否会产生重复事件。
 * @param type 重复类型
 * @returns 是否为重复类型
 */
export function isScheduleRecurringType(type: LifeScheduleRecurrenceType): boolean {
  return type === 'daily' || type === 'weekly' || type === 'monthly';
}

/**
 * 规整重复配置：过滤无效值、去重、排序。
 * @param config 原始配置
 * @returns 规整后的配置或 null
 */
export function normalizeScheduleRecurrenceConfig(
  config: LifeScheduleRecurrenceConfig | null | undefined,
): LifeScheduleRecurrenceConfig | null {
  if (!config) {
    return null;
  }
  const result: LifeScheduleRecurrenceConfig = {};
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
 * 根据重复规则计算下一次事件时间。
 * @param recurrenceType  重复类型
 * @param recurrenceConfig 重复配置
 * @param fromBase        基准时间（上次事件时间）
 * @returns 下一次事件时间，无法计算返回 null
 */
export function computeNextScheduleOccurrence(
  recurrenceType: LifeScheduleRecurrenceType,
  recurrenceConfig: LifeScheduleRecurrenceConfig | null | undefined,
  fromBase: Dayjs,
): Dayjs | null {
  if (!isScheduleRecurringType(recurrenceType)) {
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

/**
 * 计算重复事件的持续时间（毫秒），用于展开时保持事件时长一致。
 * @param event 事件实体
 * @returns 持续时间毫秒数；end_at 为空返回 0
 */
function computeEventDurationMs(event: LifeScheduleEventEntity): number {
  if (!event.end_at) {
    return 0;
  }
  const start = dayjs(event.start_at);
  const end = dayjs(event.end_at);
  if (!end.isAfter(start)) {
    return 0;
  }
  return end.diff(start, 'millisecond');
}

/**
 * 展开后的日历事件实例（用于前端日历视图渲染）。
 */
export interface ScheduleOccurrence {
  /** 事件实体 ID */
  id: string;
  /** 实例开始时间 */
  startAt: Date;
  /** 实例结束时间（null 表示瞬时事件） */
  endAt: Date | null;
  /** 是否全天 */
  isAllDay: boolean;
  /** 事件标题 */
  title: string;
  /** 描述 */
  descriptionMarkdown: string;
  /** 地点 */
  location: string | null;
  /** 颜色 */
  color: string | null;
  /** 来源 */
  source: string;
  /** 来源 ID */
  sourceId: string | null;
  /** 提前提醒分钟数 */
  reminderMinutes: number | null;
  /** 是否已完成 */
  completed: boolean;
  /** 是否为重复事件的实例（true=虚拟展开，false=实体记录） */
  recurring: boolean;
  /** 实例标识（重复事件的原始 ID + 起始时间，用于前端操作区分） */
  occurrenceKey: string;
}

/**
 * 将重复事件在指定时间范围内展开为多个实例。
 * 注意：为防止无限循环，单次展开最多 200 个实例。
 * @param event   事件实体
 * @param rangeStart 范围开始时间
 * @param rangeEnd   范围结束时间
 * @returns 展开后的实例列表
 */
export function expandScheduleRecurrenceInRange(
  event: LifeScheduleEventEntity,
  rangeStart: Dayjs,
  rangeEnd: Dayjs,
): ScheduleOccurrence[] {
  if (!isScheduleRecurringType(event.recurrence_type)) {
    return [{
      id: event.id,
      startAt: event.start_at,
      endAt: event.end_at,
      isAllDay: event.is_all_day,
      title: event.title,
      descriptionMarkdown: event.description_markdown,
      location: event.location,
      color: event.color,
      source: event.source,
      sourceId: event.source_id,
      reminderMinutes: event.reminder_minutes,
      completed: event.completed,
      recurring: false,
      occurrenceKey: `${event.id}__${dayjs(event.start_at).toISOString()}`,
    }];
  }

  const durationMs = computeEventDurationMs(event);
  const recurrenceEndDate = event.recurrence_end_date
    ? dayjs(event.recurrence_end_date).endOf('day')
    : rangeEnd;
  const cutoff = recurrenceEndDate.isBefore(rangeEnd) ? recurrenceEndDate : rangeEnd;

  const occurrences: ScheduleOccurrence[] = [];
  let current = dayjs(event.start_at);
  const maxIterations = 200;
  let iteration = 0;

  while (current.isBefore(cutoff) && iteration < maxIterations) {
    iteration += 1;

    if (current.isAfter(rangeStart.subtract(1, 'millisecond')) && current.isBefore(rangeEnd)) {
      const endAt = durationMs > 0 ? new Date(current.valueOf() + durationMs) : null;
      occurrences.push({
        id: event.id,
        startAt: current.toDate(),
        endAt,
        isAllDay: event.is_all_day,
        title: event.title,
        descriptionMarkdown: event.description_markdown,
        location: event.location,
        color: event.color,
        source: event.source,
        sourceId: event.source_id,
        reminderMinutes: event.reminder_minutes,
        completed: event.completed,
        recurring: true,
        occurrenceKey: `${event.id}__${current.toISOString()}`,
      });
    }

    const next = computeNextScheduleOccurrence(
      event.recurrence_type,
      event.recurrence_config,
      current,
    );
    if (!next || !next.isAfter(current)) {
      break;
    }
    current = next;
  }

  return occurrences;
}

/**
 * 判断给定日期是否在重复事件的提醒窗口内（用于调度器扫描）。
 * @param event     事件实体
 * @param targetTime 目标时间点
 * @returns 是否触发提醒
 */
export function shouldRemindScheduleEventAt(
  event: LifeScheduleEventEntity,
  targetTime: Dayjs,
): boolean {
  if (!event.reminder_minutes || event.completed || event.trashed_at) {
    return false;
  }
  if (!isScheduleRecurringType(event.recurrence_type)) {
    const remindAt = dayjs(event.start_at).subtract(event.reminder_minutes, 'minute');
    return remindAt.isSame(targetTime, 'minute');
  }

  // 重复事件：检查最近 24 小时内是否有匹配的实例
  const windowStart = targetTime.subtract(1, 'day');
  const windowEnd = targetTime.add(1, 'day');
  const occurrences = expandScheduleRecurrenceInRange(event, windowStart, windowEnd);
  return occurrences.some((occurrence) => {
    const remindAt = dayjs(occurrence.startAt).subtract(event.reminder_minutes ?? 0, 'minute');
    return remindAt.isSame(targetTime, 'minute');
  });
}
