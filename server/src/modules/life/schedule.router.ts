import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { In, IsNull, Not } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { LifeScheduleEventEntity } from './entities/life-schedule-event.entity';
import { LifeScheduleSettingEntity } from './entities/life-schedule-setting.entity';
import { LifeTodoTaskEntity } from './entities/life-todo-task.entity';
import { NotificationCenterLogEntity } from '../notifications/entities/notification-center-log.entity';
import { asyncHandler } from '../../shared/http/async-handler';
import { requireAuthUser } from '../../shared/http/request';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { AppError } from '../../shared/errors/app-error';
import { parsePagination } from '../../shared/utils/pagination';
import { normalizeText } from '../../shared/utils/text';
import { normalizeDate } from '../../shared/utils/date';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import type { LifeScheduleRecurrenceConfig } from './entities/life-schedule-event.entity';
import {
  expandScheduleRecurrenceInRange,
  isScheduleRecurringType,
  normalizeScheduleRecurrenceConfig,
} from './schedule-recurrence';
import { startScheduleReminderScheduler } from './schedule-reminder.scheduler';

const recurrenceTypeSchema = z.enum(['none', 'daily', 'weekly', 'monthly']);

const recurrenceConfigSchema = z
  .object({
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .max(7)
      .optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
  })
  .optional()
  .nullable();

const eventSchemaBase = z.object({
  title: z.string().trim().min(1).max(255),
  descriptionMarkdown: z.string().optional().default(''),
  startAt: z.string().min(1),
  endAt: z.string().optional().nullable(),
  isAllDay: z.boolean().optional().default(false),
  location: z.string().trim().max(255).optional().nullable().default(null),
  color: z.string().trim().max(16).optional().nullable().default(null),
  recurrenceType: recurrenceTypeSchema.optional().default('none'),
  recurrenceConfig: recurrenceConfigSchema,
  recurrenceEndDate: z.string().optional().nullable().default(null),
  reminderMinutes: z.number().int().min(0).max(1440).optional().nullable().default(null),
  completed: z.boolean().optional(),
});

const settingsSchema = z.object({
  defaultReminderMinutes: z.number().int().min(0).max(1440).optional(),
  defaultView: z.enum(['month', 'week', 'day']).optional(),
  weekStartsOn: z.number().int().min(0).max(1).optional(),
  reminderEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lastAutoReminderDate: z.string().optional(),
});

const batchTrashSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1),
});

const restoreSchema = z.object({
  eventId: z.string().min(1),
});

const toggleCompletedSchema = z.object({
  completed: z.boolean(),
});

const triggerReminderSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
});

const fromTodoSchema = z.object({
  todoId: z.string().min(1),
  startAt: z.string().min(1),
  durationMinutes: z.number().int().min(0).max(1440).optional().default(60),
  reminderMinutes: z.number().int().min(0).max(1440).optional().nullable().default(30),
});

const settingService = new BaseUserSettingService(LifeScheduleSettingEntity);

/**
 * 将前端传入的时间字符串解析为 Date（兼容 YYYY-MM-DD HH:mm:ss 与 ISO）。
 * @param raw 时间字符串
 * @returns Date 对象
 */
function parseDateTime(raw: string): Date {
  const parsed = dayjs(raw);
  if (!parsed.isValid()) {
    throw new AppError('invalid_datetime', 400, 400, { message: `无法解析时间：${raw}` });
  }
  return parsed.toDate();
}

/**
 * 规整重复配置（去重、过滤、排序）。
 * @param config 原始配置
 * @returns 规整后的配置或 null
 */
function safeRecurrenceConfig(
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
 * 实体转前端响应对象。
 * @param entity 事件实体
 * @returns 前端响应对象
 */
function mapEvent(entity: LifeScheduleEventEntity) {
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
    recurrenceConfig: safeRecurrenceConfig(entity.recurrence_config),
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
 * 计算日程概览统计（今日/本周/逾期/重复事件数）。
 * @param events 事件列表
 * @returns 概览统计对象
 */
function buildScheduleOverview(events: LifeScheduleEventEntity[]) {
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
      // 今日到期
      const start = dayjs(event.start_at);
      if (start.isBetween(todayStart, todayEnd, null, '[]')) {
        summary.dueTodayCount += 1;
      }
      // 本周到期
      if (start.isBetween(weekStart, now.endOf('week'), null, '[]')) {
        summary.dueThisWeekCount += 1;
      }
      // 已逾期
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

export function createScheduleRouter() {
  startScheduleReminderScheduler();
  const router = Router();

  // ─── 事件列表 ──────────────────────────────────────────
  router.get('/events', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const keyword = normalizeText(request.query.keyword).toLowerCase();
    const status = normalizeText(request.query.status, 'all');
    const trashed = normalizeText(request.query.trashed, 'false') === 'true';
    const repository = appDataSource.getRepository(LifeScheduleEventEntity);

    const items = await repository.find({
      where: {
        user_id: userId,
        trashed_at: trashed ? Not(IsNull()) : IsNull(),
      },
      order: {
        start_at: 'DESC',
        updated_at: 'DESC',
      },
    });

    const filtered = items.filter((item) => {
      if (keyword) {
        const haystack = [
          item.title,
          item.description_markdown,
          item.location ?? '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }

      if (status === 'active' && item.completed) {
        return false;
      }
      if (status === 'completed' && !item.completed) {
        return false;
      }
      if (status === 'recurring' && !isScheduleRecurringType(item.recurrence_type)) {
        return false;
      }

      return true;
    });

    response.json(successResponse(buildListData(
      filtered.slice(skip, skip + pageSize).map(mapEvent),
      page,
      pageSize,
      filtered.length,
    )));
  }));

  // ─── 日历视图数据（展开重复事件） ────────────────────
  router.get('/events/calendar', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const rangeStart = normalizeText(request.query.rangeStart);
    const rangeEnd = normalizeText(request.query.rangeEnd);

    if (!rangeStart || !rangeEnd) {
      throw new AppError('invalid_query', 400, 400, { message: 'rangeStart / rangeEnd 为必填参数' });
    }

    const startDate = dayjs(rangeStart);
    const endDate = dayjs(rangeEnd);
    if (!startDate.isValid() || !endDate.isValid() || endDate.isBefore(startDate)) {
      throw new AppError('invalid_query', 400, 400, { message: 'rangeStart / rangeEnd 格式或顺序无效' });
    }

    const repository = appDataSource.getRepository(LifeScheduleEventEntity);
    const events = await repository.find({
      where: {
        user_id: userId,
        trashed_at: IsNull(),
      },
      order: {
        start_at: 'ASC',
      },
    });

    // 扩大查询范围，避免重复事件边界事件被截断
    const windowStart = startDate.subtract(1, 'month');
    const windowEnd = endDate.add(1, 'month');
    const occurrences = events.flatMap((event) => expandScheduleRecurrenceInRange(event, windowStart, windowEnd));

    const inRange = occurrences.filter((occurrence) => {
      const start = dayjs(occurrence.startAt);
      return start.isBetween(startDate.subtract(1, 'millisecond'), endDate, null, '(]') ||
             start.isBetween(startDate, endDate.subtract(1, 'millisecond'), null, '(]');
    });

    response.json(successResponse({
      range: { start: startDate.format('YYYY-MM-DD'), end: endDate.format('YYYY-MM-DD') },
      items: inRange,
    }));
  }));

  // ─── 创建事件 ────────────────────────────────────────
  router.post('/events', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(eventSchemaBase, request.body);
    const repository = appDataSource.getRepository(LifeScheduleEventEntity);

    const startAt = parseDateTime(payload.startAt);
    const endAt = payload.endAt ? parseDateTime(payload.endAt) : null;
    if (endAt && dayjs(endAt).isBefore(dayjs(startAt))) {
      throw new AppError('invalid_datetime', 400, 400, { message: '结束时间不能早于开始时间' });
    }

    const recurrenceType = payload.recurrenceType ?? 'none';
    const recurrenceConfig = isScheduleRecurringType(recurrenceType)
      ? safeRecurrenceConfig(payload.recurrenceConfig ?? null)
      : null;

    const item = await repository.save(repository.create({
      user_id: userId,
      title: payload.title,
      description_markdown: payload.descriptionMarkdown,
      start_at: startAt,
      end_at: endAt,
      is_all_day: payload.isAllDay,
      location: payload.location,
      color: payload.color,
      recurrence_type: recurrenceType,
      recurrence_config: recurrenceConfig,
      recurrence_end_date: payload.recurrenceEndDate ? normalizeDate(payload.recurrenceEndDate) : null,
      reminder_minutes: payload.reminderMinutes,
      completed: payload.completed ?? false,
      completed_at: payload.completed ? new Date() : null,
      trashed_at: null,
      source: 'manual',
      source_id: null,
      sort_order: Date.now(),
    }));

    response.json(successResponse(mapEvent(item), 'create_schedule_event_success'));
  }));

  // ─── 更新事件 ────────────────────────────────────────
  router.patch('/events/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const eventId = String(request.params.id ?? '');
    const payload = validateBody(eventSchemaBase.partial(), request.body);
    const repository = appDataSource.getRepository(LifeScheduleEventEntity);
    const current = await repository.findOne({
      where: { id: eventId, user_id: userId },
    });

    if (!current) {
      throw new AppError('schedule_event_not_found', 404, 404);
    }

    const startAt = payload.startAt !== undefined ? parseDateTime(payload.startAt) : current.start_at;
    const endAt = payload.endAt !== undefined
      ? (payload.endAt ? parseDateTime(payload.endAt) : null)
      : current.end_at;
    if (endAt && dayjs(endAt).isBefore(dayjs(startAt))) {
      throw new AppError('invalid_datetime', 400, 400, { message: '结束时间不能早于开始时间' });
    }

    const nextRecurrenceType = payload.recurrenceType ?? current.recurrence_type;
    const nextRecurrenceConfig = payload.recurrenceConfig !== undefined
      ? safeRecurrenceConfig(payload.recurrenceConfig)
      : (isScheduleRecurringType(nextRecurrenceType) ? normalizeScheduleRecurrenceConfig(current.recurrence_config) : null);

    const next = await repository.save({
      ...current,
      title: payload.title ?? current.title,
      description_markdown: payload.descriptionMarkdown ?? current.description_markdown,
      start_at: startAt,
      end_at: endAt,
      is_all_day: payload.isAllDay ?? current.is_all_day,
      location: payload.location ?? current.location,
      color: payload.color ?? current.color,
      recurrence_type: nextRecurrenceType,
      recurrence_config: nextRecurrenceConfig,
      recurrence_end_date: payload.recurrenceEndDate !== undefined
        ? (payload.recurrenceEndDate ? normalizeDate(payload.recurrenceEndDate) : null)
        : current.recurrence_end_date,
      reminder_minutes: payload.reminderMinutes !== undefined ? payload.reminderMinutes : current.reminder_minutes,
    });

    response.json(successResponse(mapEvent(next), 'update_schedule_event_success'));
  }));

  // ─── 切换完成状态 ─────────────────────────────────────
  router.post('/events/:id/toggle-completed', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const eventId = String(request.params.id ?? '');
    const payload = validateBody(toggleCompletedSchema, request.body);
    const repository = appDataSource.getRepository(LifeScheduleEventEntity);
    const current = await repository.findOne({
      where: { id: eventId, user_id: userId },
    });

    if (!current) {
      throw new AppError('schedule_event_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      completed: payload.completed,
      completed_at: payload.completed ? new Date() : null,
    });

    response.json(successResponse(mapEvent(next), 'toggle_schedule_event_completed_success'));
  }));

  // ─── 删除事件（软删除到回收站） ───────────────────────
  router.delete('/events/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const eventId = String(request.params.id ?? '');
    const permanent = normalizeText(request.query.mode) === 'permanent';
    const repository = appDataSource.getRepository(LifeScheduleEventEntity);
    const current = await repository.findOne({
      where: { id: eventId, user_id: userId },
    });

    if (!current) {
      throw new AppError('schedule_event_not_found', 404, 404);
    }

    if (permanent) {
      await repository.remove(current);
      response.json(successResponse({ ok: true }, 'delete_schedule_event_success'));
      return;
    }

    await repository.save({
      ...current,
      trashed_at: new Date(),
    });
    response.json(successResponse({ ok: true }, 'trash_schedule_event_success'));
  }));

  // ─── 从待办转换 ───────────────────────────────────────
  router.post('/actions/from-todo', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(fromTodoSchema, request.body);
    const todoRepo = appDataSource.getRepository(LifeTodoTaskEntity);
    const scheduleRepo = appDataSource.getRepository(LifeScheduleEventEntity);

    const todo = await todoRepo.findOne({
      where: { id: payload.todoId, user_id: userId },
    });
    if (!todo) {
      throw new AppError('todo_task_not_found', 404, 404);
    }

    const startAt = parseDateTime(payload.startAt);
    const durationMinutes = payload.durationMinutes ?? 60;
    const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

    const item = await scheduleRepo.save(scheduleRepo.create({
      user_id: userId,
      title: todo.title,
      description_markdown: todo.description_markdown,
      start_at: startAt,
      end_at: endAt,
      is_all_day: false,
      location: null,
      color: 'amber',
      recurrence_type: 'none',
      recurrence_config: null,
      recurrence_end_date: null,
      reminder_minutes: payload.reminderMinutes,
      completed: false,
      completed_at: null,
      trashed_at: null,
      source: 'todo',
      source_id: todo.id,
      sort_order: Date.now(),
    }));

    response.json(successResponse(mapEvent(item), 'convert_todo_to_schedule_success'));
  }));

  // ─── 概览统计 ──────────────────────────────────────────
  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(LifeScheduleEventEntity);
    const items = await repository.find({
      where: { user_id: userId },
    });

    response.json(successResponse(buildScheduleOverview(items)));
  }));

  // ─── 设置 ──────────────────────────────────────────────
  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      default_reminder_minutes: 30,
      default_view: 'month',
      week_starts_on: 1,
      reminder_enabled: true,
      reminder_time: '08:00',
      last_auto_reminder_date: null,
    });

    response.json(successResponse({
      defaultReminderMinutes: settings.default_reminder_minutes,
      defaultView: settings.default_view,
      weekStartsOn: settings.week_starts_on,
      reminderEnabled: settings.reminder_enabled,
      reminderTime: settings.reminder_time,
      lastAutoReminderDate: settings.last_auto_reminder_date ?? '',
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      default_reminder_minutes: payload.defaultReminderMinutes,
      default_view: payload.defaultView,
      week_starts_on: payload.weekStartsOn,
      reminder_enabled: payload.reminderEnabled,
      reminder_time: payload.reminderTime,
      last_auto_reminder_date: payload.lastAutoReminderDate ? normalizeDate(payload.lastAutoReminderDate) : undefined,
    }, {
      default_reminder_minutes: 30,
      default_view: 'month',
      week_starts_on: 1,
      reminder_enabled: true,
      reminder_time: '08:00',
      last_auto_reminder_date: null,
    });

    response.json(successResponse({
      defaultReminderMinutes: settings.default_reminder_minutes,
      defaultView: settings.default_view,
      weekStartsOn: settings.week_starts_on,
      reminderEnabled: settings.reminder_enabled,
      reminderTime: settings.reminder_time,
      lastAutoReminderDate: settings.last_auto_reminder_date ?? '',
    }, 'update_schedule_settings_success'));
  }));

  // ─── 批量删除 / 恢复 / 清空回收站 ─────────────────────
  router.post('/actions/batch-trash', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(batchTrashSchema, request.body);
    await appDataSource.getRepository(LifeScheduleEventEntity).update(
      { user_id: userId, id: In(payload.eventIds) },
      { trashed_at: new Date() },
    );
    response.json(successResponse({ ok: true }, 'batch_trash_schedule_events_success'));
  }));

  router.post('/actions/restore', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(restoreSchema, request.body);
    await appDataSource.getRepository(LifeScheduleEventEntity).update(
      { user_id: userId, id: payload.eventId },
      { trashed_at: null },
    );
    response.json(successResponse({ ok: true }, 'restore_schedule_event_success'));
  }));

  router.post('/actions/clear-trash', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(LifeScheduleEventEntity);
    const items = await repository.find({
      where: { user_id: userId },
    });
    const trashedItems = items.filter((item) => item.trashed_at);
    if (trashedItems.length) {
      await repository.remove(trashedItems);
    }
    response.json(successResponse({ ok: true }, 'clear_schedule_trash_success'));
  }));

  // ─── 手动触发提醒 ─────────────────────────────────────
  router.post('/actions/trigger-reminder', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(triggerReminderSchema, request.body);
    const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);
    const log = await logRepo.save(logRepo.create({
      user_id: userId,
      channel: 'email',
      scene_id: 'schedule.reminder',
      kind: 'scene',
      status: 'success',
      title: payload.title ?? '日程提醒',
      message: payload.title ?? '已手动触发日程提醒。',
    }));

    response.json(successResponse(log, 'trigger_schedule_reminder_success'));
  }));

  // ─── 提醒日志 ──────────────────────────────────────────
  router.get('/logs', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(NotificationCenterLogEntity);
    const [items, total] = await repository.findAndCount({
      where: {
        user_id: userId,
        scene_id: 'schedule.reminder',
      },
      order: { created_at: 'DESC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items, page, pageSize, total)));
  }));

  return router;
}
