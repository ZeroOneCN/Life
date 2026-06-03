import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';
import { In } from 'typeorm';
import { IsNull, Not } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { LifeTodoTaskEntity } from './entities/life-todo-task.entity';
import { LifeTodoSettingEntity } from './entities/life-todo-setting.entity';
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

const taskSchemaBase = z.object({
  title: z.string().trim().min(1).max(255),
  descriptionMarkdown: z.string().optional().default(''),
  dueDate: z.string().refine((val) => {
    if (!val || val.trim() === '') return true;
    return dayjs(val, 'YYYY-MM-DD', true).isValid() || dayjs(val, 'YYYY/MM/DD', true).isValid();
  }, { message: 'dueDate 格式无效，应为 YYYY-MM-DD 或 YYYY/MM/DD' }).optional().default(''),
  priority: z.enum(['high', 'medium', 'low']).optional().default('medium'),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  isDaily: z.boolean().optional().default(false),
  completed: z.boolean().optional(),
});

const taskSchema = taskSchemaBase.refine((data) => {
  if (data.completed === true && !data.dueDate && data.isDaily) {
    return false;
  }
  return true;
}, { message: '每日任务必须设置到期日期' });

const settingsSchema = z.object({
  reminderEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  leadDays: z.number().int().min(0).max(30).optional(),
  includeDailyTasks: z.boolean().optional(),
  includeOverdueTasks: z.boolean().optional(),
  lastAutoReminderDate: z.string().optional(),
});

const batchCompleteSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1),
});

const batchTrashSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1),
});

const restoreSchema = z.object({
  taskId: z.string().min(1),
});

const triggerReminderSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
});

const toggleCompletedSchema = z.object({
  completed: z.boolean(),
});

const settingService = new BaseUserSettingService(LifeTodoSettingEntity);

function mapTask(entity: LifeTodoTaskEntity) {
  return {
    id: entity.id,
    title: entity.title,
    descriptionMarkdown: entity.description_markdown,
    dueDate: entity.due_date ? dayjs(entity.due_date).format('YYYY-MM-DD') : '',
    priority: entity.priority,
    tags: entity.tags_json ?? [],
    isDaily: entity.is_daily,
    completed: entity.completed,
    completedAt: entity.completed_at ? dayjs(entity.completed_at).format('YYYY-MM-DD HH:mm:ss') : '',
    lastCompletedDate: entity.last_completed_date ? dayjs(entity.last_completed_date).format('YYYY-MM-DD') : '',
    trashedAt: entity.trashed_at ? dayjs(entity.trashed_at).format('YYYY-MM-DD HH:mm:ss') : '',
    sortOrder: entity.sort_order,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function buildTodoOverview(tasks: LifeTodoTaskEntity[]) {
  const today = dayjs().startOf('day');

  return tasks.reduce((summary, task) => {
    if (task.trashed_at) {
      return summary;
    }

    summary.totalCount += 1;
    if (task.completed) {
      summary.completedCount += 1;
    } else {
      summary.activeCount += 1;
    }
    if (task.is_daily) {
      summary.dailyCount += 1;
    }
    if (task.priority === 'high') {
      summary.highPriorityCount += 1;
    } else if (task.priority === 'medium') {
      summary.mediumPriorityCount += 1;
    } else {
      summary.lowPriorityCount += 1;
    }
    if (task.due_date && dayjs(task.due_date).isSame(today, 'day')) {
      summary.dueTodayCount += 1;
    }

    return summary;
  }, {
    totalCount: 0,
    activeCount: 0,
    completedCount: 0,
    dailyCount: 0,
    highPriorityCount: 0,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    dueTodayCount: 0,
  });
}

export function createTodoRouter() {
  const router = Router();

  router.get('/tasks', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const keyword = normalizeText(request.query.keyword).toLowerCase();
    const status = normalizeText(request.query.status, 'all');
    const priority = normalizeText(request.query.priority, 'all');
    const tag = normalizeText(request.query.tag);
    const dueStartDate = normalizeText(request.query.dueStartDate);
    const dueEndDate = normalizeText(request.query.dueEndDate);
    const trashed = normalizeText(request.query.trashed, 'false') === 'true';
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);
    const items = await repository.find({
      where: {
        user_id: userId,
        trashed_at: trashed ? Not(IsNull()) : IsNull(),
      },
      order: {
        updated_at: 'DESC',
        due_date: 'DESC',
      },
    });

    const filtered = items.filter((item) => {
      if (trashed && !item.trashed_at) {
        return false;
      }

      if (keyword) {
        const haystack = [
          item.title,
          item.description_markdown,
          ...(item.tags_json ?? []),
        ].join(' ').toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }

      if (status !== 'all') {
        if (status === 'daily' && !item.is_daily) {
          return false;
        }
        if (status === 'completed' && !item.completed) {
          return false;
        }
        if (status === 'active' && item.completed) {
          return false;
        }
        if (status === 'overdue' && (item.completed || !item.due_date || !dayjs(item.due_date).isBefore(dayjs(), 'day'))) {
          return false;
        }
      }

      if (priority !== 'all' && item.priority !== priority) {
        return false;
      }

      if (tag && !(item.tags_json ?? []).includes(tag)) {
        return false;
      }

      if (dueStartDate && (!item.due_date || dayjs(item.due_date).isBefore(dueStartDate, 'day'))) {
        return false;
      }

      if (dueEndDate && (!item.due_date || dayjs(item.due_date).isAfter(dueEndDate, 'day'))) {
        return false;
      }

      return true;
    });

    response.json(successResponse(buildListData(
      filtered.slice(skip, skip + pageSize).map(mapTask),
      page,
      pageSize,
      filtered.length,
    )));
  }));

  router.post('/tasks', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(taskSchema, request.body);
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);
    const item = await repository.save(repository.create({
      user_id: userId,
      title: payload.title,
      description_markdown: payload.descriptionMarkdown,
      due_date: payload.dueDate ? normalizeDate(payload.dueDate) : null,
      priority: payload.priority,
      tags_json: payload.tags,
      is_daily: payload.isDaily,
      completed: payload.completed ?? false,
      completed_at: payload.completed ? new Date() : null,
      last_completed_date: payload.completed ? dayjs().format('YYYY-MM-DD') : null,
      trashed_at: null,
      sort_order: Date.now(),
    }));

    response.json(successResponse(mapTask(item), 'create_todo_task_success'));
  }));

  router.patch('/tasks/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const taskId = String(request.params.id ?? '');
    const payload = validateBody(taskSchemaBase.partial(), request.body);
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);
    const current = await repository.findOne({
      where: {
        id: taskId,
        user_id: userId,
      },
    });

    if (!current) {
      throw new AppError('todo_task_not_found', 404, 404);
    }

    const completed = payload.completed ?? current.completed;
    const wasCompleted = current.completed;
    const isNowCompleted = completed;

    const next = await repository.save({
      ...current,
      title: payload.title ?? current.title,
      description_markdown: payload.descriptionMarkdown ?? current.description_markdown,
      due_date: payload.dueDate !== undefined ? (payload.dueDate ? normalizeDate(payload.dueDate) : null) : current.due_date,
      priority: payload.priority ?? current.priority,
      tags_json: payload.tags ?? current.tags_json,
      is_daily: payload.isDaily ?? current.is_daily,
      completed: isNowCompleted,
      completed_at: isNowCompleted
        ? (!wasCompleted ? new Date() : (current.completed_at ?? new Date()))
        : null,
      last_completed_date: isNowCompleted
        ? (!wasCompleted ? dayjs().format('YYYY-MM-DD') : (current.last_completed_date ?? dayjs().format('YYYY-MM-DD')))
        : current.last_completed_date,
    });

    response.json(successResponse(mapTask(next), 'update_todo_task_success'));
  }));

  router.post('/tasks/:id/toggle-completed', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const taskId = String(request.params.id ?? '');
    const payload = validateBody(toggleCompletedSchema, request.body);
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);
    const current = await repository.findOne({
      where: {
        id: taskId,
        user_id: userId,
      },
    });

    if (!current) {
      throw new AppError('todo_task_not_found', 404, 404);
    }

    const next = await repository.save({
      ...current,
      completed: payload.completed,
      completed_at: payload.completed ? new Date() : null,
      last_completed_date: payload.completed ? dayjs().format('YYYY-MM-DD') : null,
    });

    response.json(successResponse(mapTask(next), 'toggle_todo_task_completed_success'));
  }));

  router.delete('/tasks/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const taskId = String(request.params.id ?? '');
    const permanent = normalizeText(request.query.mode) === 'permanent';
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);
    const current = await repository.findOne({
      where: {
        id: taskId,
        user_id: userId,
      },
    });

    if (!current) {
      throw new AppError('todo_task_not_found', 404, 404);
    }

    if (permanent) {
      await repository.remove(current);
      response.json(successResponse({ ok: true }, 'delete_todo_task_success'));
      return;
    }

    await repository.save({
      ...current,
      trashed_at: new Date(),
    });
    response.json(successResponse({ ok: true }, 'trash_todo_task_success'));
  }));

  router.get('/overview', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);
    const items = await repository.find({
      where: {
        user_id: userId,
      },
    });

    response.json(successResponse(buildTodoOverview(items)));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      reminder_enabled: true,
      reminder_time: '09:00',
      lead_days: 3,
      include_daily_tasks: true,
      include_overdue_tasks: true,
      last_auto_reminder_date: null,
    });

    response.json(successResponse({
      reminderEnabled: settings.reminder_enabled,
      reminderTime: settings.reminder_time,
      leadDays: settings.lead_days,
      includeDailyTasks: settings.include_daily_tasks,
      includeOverdueTasks: settings.include_overdue_tasks,
      lastAutoReminderDate: settings.last_auto_reminder_date ?? '',
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      reminder_enabled: payload.reminderEnabled,
      reminder_time: payload.reminderTime,
      lead_days: payload.leadDays,
      include_daily_tasks: payload.includeDailyTasks,
      include_overdue_tasks: payload.includeOverdueTasks,
      last_auto_reminder_date: payload.lastAutoReminderDate ? normalizeDate(payload.lastAutoReminderDate) : undefined,
    }, {
      reminder_enabled: true,
      reminder_time: '09:00',
      lead_days: 3,
      include_daily_tasks: true,
      include_overdue_tasks: true,
      last_auto_reminder_date: null,
    });

    response.json(successResponse({
      reminderEnabled: settings.reminder_enabled,
      reminderTime: settings.reminder_time,
      leadDays: settings.lead_days,
      includeDailyTasks: settings.include_daily_tasks,
      includeOverdueTasks: settings.include_overdue_tasks,
      lastAutoReminderDate: settings.last_auto_reminder_date ?? '',
    }, 'update_todo_settings_success'));
  }));

  router.post('/actions/batch-complete', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(batchCompleteSchema, request.body);
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);

    await repository.update({
      user_id: userId,
      id: In(payload.taskIds),
    }, {
      completed: true,
      completed_at: new Date(),
      last_completed_date: dayjs().format('YYYY-MM-DD'),
    });

    response.json(successResponse({ ok: true }, 'batch_complete_todo_tasks_success'));
  }));

  router.post('/actions/batch-trash', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(batchTrashSchema, request.body);
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);

    await repository.update({
      user_id: userId,
      id: In(payload.taskIds),
    }, {
      trashed_at: new Date(),
    });

    response.json(successResponse({ ok: true }, 'batch_trash_todo_tasks_success'));
  }));

  router.post('/actions/restore', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(restoreSchema, request.body);
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);
    await repository.update({
      user_id: userId,
      id: payload.taskId,
    }, {
      trashed_at: null,
    });

    response.json(successResponse({ ok: true }, 'restore_todo_task_success'));
  }));

  router.post('/actions/clear-trash', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(LifeTodoTaskEntity);
    const items = await repository.find({
      where: {
        user_id: userId,
      },
    });
    const trashedItems = items.filter((item) => item.trashed_at);

    if (trashedItems.length) {
      await repository.remove(trashedItems);
    }

    response.json(successResponse({ ok: true }, 'clear_todo_trash_success'));
  }));

  router.post('/actions/trigger-reminder', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(triggerReminderSchema, request.body);
    const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);
    const log = await logRepo.save(logRepo.create({
      user_id: userId,
      channel: 'email',
      scene_id: 'todo.reminder',
      kind: 'scene',
      status: 'success',
      title: payload.title ?? '待办提醒',
      message: payload.title ?? '已手动触发今日待办提醒。',
    }));

    response.json(successResponse(log, 'trigger_todo_reminder_success'));
  }));

  router.get('/logs', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(NotificationCenterLogEntity);
    const [items, total] = await repository.findAndCount({
      where: {
        user_id: userId,
        scene_id: 'todo.reminder',
      },
      order: {
        created_at: 'DESC',
      },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items, page, pageSize, total)));
  }));

  return router;
}
