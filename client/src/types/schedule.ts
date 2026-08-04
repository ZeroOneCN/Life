/**
 * 日程模块类型定义。
 * 与后端 life_schedule_event 实体字段保持一致（驼峰映射）。
 */

export type ScheduleTab = 'events' | 'settings' | 'logs' | 'trash';

export type ScheduleRecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export type ScheduleEventSource = 'manual' | 'todo';

export type ScheduleCalendarView = 'month' | 'week' | 'day';

export interface ScheduleRecurrenceConfig {
  /** 0=周日 ... 6=周六 */
  weekdays?: number[];
  /** 1-31 */
  dayOfMonth?: number;
}

/** 日程事件记录（来自后端） */
export interface ScheduleEventRecord {
  id: string;
  title: string;
  descriptionMarkdown: string;
  /** ISO 字符串 */
  startAt: string;
  /** ISO 字符串，可为空 */
  endAt: string | null;
  isAllDay: boolean;
  location: string;
  color: string;
  recurrenceType: ScheduleRecurrenceType;
  recurrenceConfig: ScheduleRecurrenceConfig | null;
  recurrenceEndDate: string;
  /** null 表示不提醒 */
  reminderMinutes: number | null;
  completed: boolean;
  completedAt: string;
  trashedAt: string;
  source: ScheduleEventSource;
  sourceId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 日历视图展开后的实例 */
export interface ScheduleOccurrence {
  id: string;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
  title: string;
  descriptionMarkdown: string;
  location: string;
  color: string;
  source: ScheduleEventSource;
  sourceId: string;
  reminderMinutes: number | null;
  completed: boolean;
  recurring: boolean;
  /** 实例标识，由后端生成 */
  occurrenceKey: string;
}

/** 创建/编辑事件的草稿 */
export interface ScheduleEventDraft {
  title: string;
  descriptionMarkdown?: string;
  startAt: string;
  endAt?: string | null;
  isAllDay?: boolean;
  location?: string | null;
  color?: string | null;
  recurrenceType?: ScheduleRecurrenceType;
  recurrenceConfig?: ScheduleRecurrenceConfig | null;
  recurrenceEndDate?: string | null;
  reminderMinutes?: number | null;
  completed?: boolean;
}

/** 日程设置 */
export interface ScheduleSettings {
  defaultReminderMinutes: number;
  defaultView: ScheduleCalendarView;
  /** 0=周日，1=周一 */
  weekStartsOn: number;
  reminderEnabled: boolean;
  /** HH:mm */
  reminderTime: string;
  lastAutoReminderDate: string;
}

/** 概览统计 */
export interface ScheduleOverviewSummary {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  recurringCount: number;
  reminderCount: number;
  dueTodayCount: number;
  dueThisWeekCount: number;
  overdueCount: number;
}

/** 日历视图查询参数 */
export interface ScheduleCalendarParams {
  rangeStart: string;
  rangeEnd: string;
}

/** 日历视图响应 */
export interface ScheduleCalendarResponse {
  range: { start: string; end: string };
  items: ScheduleOccurrence[];
}

/** 从待办转换参数 */
export interface ScheduleFromTodoPayload {
  todoId: string;
  startAt: string;
  durationMinutes?: number;
  reminderMinutes?: number | null;
}

/** 事件列表查询参数 */
export interface ScheduleListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: 'all' | 'active' | 'completed' | 'recurring';
  trashed?: boolean;
}
