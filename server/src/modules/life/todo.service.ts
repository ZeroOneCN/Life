import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { LifeTodoTaskEntity } from './entities/life-todo-task.entity';
import type { LifeTodoRecurrenceConfig } from './entities/life-todo-task.entity';
import { normalizeDate } from '../../shared/utils/date';
import { AppError } from '../../shared/errors/app-error';
import {
  isRecurringType,
  resolveRecurrenceType,
} from './todo-recurrence';

/** 待办任务创建入参（与 router zod schema 对齐） */
export interface CreateTodoInput {
  title: string;
  descriptionMarkdown?: string;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  isDaily?: boolean;
  recurrenceType?: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrenceConfig?: LifeTodoRecurrenceConfig | null;
  completed?: boolean;
}

/** 待办任务响应 DTO */
export interface TodoTaskDto {
  id: string;
  title: string;
  descriptionMarkdown: string;
  dueDate: string;
  priority: string;
  tags: string[];
  isDaily: boolean;
  recurrenceType: string;
  recurrenceConfig: LifeTodoRecurrenceConfig | null;
  completed: boolean;
  completedAt: string;
  lastCompletedDate: string;
  trashedAt: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** 待办概览统计 */
export interface TodoOverview {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  recurringCount: number;
  dailyCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  dueTodayCount: number;
}

/**
 * 规整重复配置（去重、过滤、排序）。
 * @param config 原始配置
 * @returns 规整后的配置或 null
 */
export function normalizeTodoRecurrenceConfig(
  config: LifeTodoRecurrenceConfig | null | undefined,
): LifeTodoRecurrenceConfig | null {
  if (!config) {
    return null;
  }
  const result: LifeTodoRecurrenceConfig = {};
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
 * 将待办任务实体转为前端响应对象。
 * @param entity 待办任务实体
 * @returns 前端响应 DTO
 */
export function mapTodoTask(entity: LifeTodoTaskEntity): TodoTaskDto {
  const recurrenceType = resolveRecurrenceType(entity.recurrence_type, entity.is_daily);
  return {
    id: entity.id,
    title: entity.title,
    descriptionMarkdown: entity.description_markdown,
    dueDate: entity.due_date ? dayjs(entity.due_date).format('YYYY-MM-DD') : '',
    priority: entity.priority,
    tags: entity.tags_json ?? [],
    isDaily: recurrenceType === 'daily',
    recurrenceType,
    recurrenceConfig: normalizeTodoRecurrenceConfig(entity.recurrence_config),
    completed: entity.completed,
    completedAt: entity.completed_at ? dayjs(entity.completed_at).format('YYYY-MM-DD HH:mm:ss') : '',
    lastCompletedDate: entity.last_completed_date ? dayjs(entity.last_completed_date).format('YYYY-MM-DD') : '',
    trashedAt: entity.trashed_at ? dayjs(entity.trashed_at).format('YYYY-MM-DD HH:mm:ss') : '',
    sortOrder: entity.sort_order,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

/**
 * 构建待办概览统计（与 todo.router.ts buildTodoOverview 口径一致）。
 * 重复任务不计入 completedCount。
 * @param tasks 待办任务列表
 * @returns 概览统计
 */
export function buildTodoOverview(tasks: LifeTodoTaskEntity[]): TodoOverview {
  const today = dayjs().startOf('day');

  return tasks.reduce((summary, task) => {
    if (task.trashed_at) {
      return summary;
    }

    const recurrenceType = resolveRecurrenceType(task.recurrence_type, task.is_daily);
    const recurring = isRecurringType(recurrenceType);

    summary.totalCount += 1;
    if (task.completed && !recurring) {
      summary.completedCount += 1;
    } else if (!task.completed) {
      summary.activeCount += 1;
    }
    if (recurring) {
      summary.recurringCount += 1;
      summary.dailyCount += recurrenceType === 'daily' ? 1 : 0;
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
    recurringCount: 0,
    dailyCount: 0,
    highPriorityCount: 0,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    dueTodayCount: 0,
  });
}

/**
 * 创建待办任务（含 recurrence_type 与 is_daily 同步、recurrence_config 规整、normalizeDate）。
 * @param userId 用户 ID
 * @param input 创建入参
 * @returns 保存后的实体
 */
export async function createTodoTask(
  userId: string,
  input: CreateTodoInput,
): Promise<LifeTodoTaskEntity> {
  if (!input.title || !input.title.trim()) {
    throw new AppError('缺少必填字段：title', 400, 400);
  }

  const recurrenceType = input.recurrenceType && input.recurrenceType !== 'none'
    ? input.recurrenceType
    : (input.isDaily ? 'daily' : 'none');
  const recurrenceConfig = isRecurringType(recurrenceType)
    ? normalizeTodoRecurrenceConfig(input.recurrenceConfig ?? null)
    : null;

  const repository = appDataSource.getRepository(LifeTodoTaskEntity);
  const item = await repository.save(repository.create({
    user_id: userId,
    title: input.title,
    description_markdown: input.descriptionMarkdown ?? '',
    due_date: input.dueDate ? normalizeDate(input.dueDate) : null,
    priority: input.priority ?? 'medium',
    tags_json: input.tags ?? [],
    is_daily: recurrenceType === 'daily',
    recurrence_type: recurrenceType,
    recurrence_config: recurrenceConfig,
    completed: input.completed ?? false,
    completed_at: input.completed ? new Date() : null,
    last_completed_date: input.completed ? dayjs().format('YYYY-MM-DD') : null,
    trashed_at: null,
    sort_order: Date.now(),
  }));
  return item;
}
