import dayjs from 'dayjs';

import { LifeScheduleEventEntity } from './entities/life-schedule-event.entity';
import type { LifeScheduleRecurrenceConfig } from './entities/life-schedule-event.entity';
import {
  isScheduleRecurringType,
  normalizeScheduleRecurrenceConfig,
} from './schedule-recurrence';

/** 日程事件响应 DTO */
export interface ScheduleEventDto {
  id: string;
  title: string;
  descriptionMarkdown: string;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
  location: string;
  color: string;
  recurrenceType: string;
  recurrenceConfig: LifeScheduleRecurrenceConfig | null;
  recurrenceEndDate: string;
  reminderMinutes: number | null;
  completed: boolean;
  completedAt: string;
  trashedAt: string;
  source: string;
  sourceId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 日程概览统计 */
export interface ScheduleOverview {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  recurringCount: number;
  reminderCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  overdueCount: number;
}

/**
 * 将日程事件实体转为前端响应对象。
 * @param entity 日程事件实体
 * @returns 前端响应 DTO
 */
export function mapScheduleEvent(entity: LifeScheduleEventEntity): ScheduleEventDto {
  return {
    id: entity.id,
    title: entity.title,
    descriptionMarkdown: entity.description_markdown,
    startAt: dayjs(entity.start_at).toISOString(),
    endAt: entity.end_at ? dayjs(entity.end_at).toISOString() : null,
    isAllDay: entity.is_all_day,
    location: entity.location ?? '',
    color: entity.color ?? '',
    recurrenceType: entity.recurrence_type,
    recurrenceConfig: normalizeScheduleRecurrenceConfig(entity.recurrence_config),
    recurrenceEndDate: entity.recurrence_end_date ?? '',
    reminderMinutes: entity.reminder_minutes,
    completed: entity.completed,
    completedAt: entity.completed_at ? dayjs(entity.completed_at).format('YYYY-MM-DD HH:mm:ss') : '',
    trashedAt: entity.trashed_at ? dayjs(entity.trashed_at).format('YYYY-MM-DD HH:mm:ss') : '',
    source: entity.source,
    sourceId: entity.source_id ?? '',
    sortOrder: entity.sort_order,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

/**
 * 构建日程概览统计（与 schedule.router.ts buildScheduleOverview 口径一致）。
 * 使用 isScheduleRecurringType 判定重复事件，确保口径正确。
 * @param events 日程事件列表
 * @returns 概览统计
 */
export function buildScheduleOverview(events: LifeScheduleEventEntity[]): ScheduleOverview {
  const now = dayjs();
  const todayStart = now.startOf('day');
  const todayEnd = now.endOf('day');
  const weekStart = now.startOf('week');

  return events.reduce((summary, event) => {
    if (event.trashed_at) {
      return summary;
    }

    summary.totalCount += 1;
    if (event.completed) {
      summary.completedCount += 1;
    } else {
      summary.activeCount += 1;
    }
    if (isScheduleRecurringType(event.recurrence_type)) {
      summary.recurringCount += 1;
    }
    if (event.reminder_minutes) {
      summary.reminderCount += 1;
    }

    if (!event.completed) {
      const start = dayjs(event.start_at);
      if (start.isBetween(todayStart, todayEnd, null, '[]')) {
        summary.dueTodayCount += 1;
      }
      if (start.isBetween(weekStart, now.endOf('week'), null, '[]')) {
        summary.dueThisWeekCount += 1;
      }
      if (start.isBefore(todayStart)) {
        summary.overdueCount += 1;
      }
    }

    return summary;
  }, {
    totalCount: 0,
    activeCount: 0,
    completedCount: 0,
    recurringCount: 0,
    reminderCount: 0,
    dueTodayCount: 0,
    dueThisWeekCount: 0,
    overdueCount: 0,
  });
}
