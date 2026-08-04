import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { LifeTodoTaskEntity } from './entities/life-todo-task.entity';
import { LifeTodoSettingEntity } from './entities/life-todo-setting.entity';
import { isRecurringType, resolveRecurrenceType } from './todo-recurrence';

const SCHEDULER_KEY = '__todoReminderScheduler__';

/**
 * 设置调度器：每小时跑一次扫描，启动后延后 150 秒跑第一次。
 * 错开其他 scheduler（如 schedule-reminder 120s、bill-reminder 90s）。
 */
function setupScheduler() {
  if ((globalThis as Record<string, unknown>)[SCHEDULER_KEY]) {
    return;
  }
  (globalThis as Record<string, unknown>)[SCHEDULER_KEY] = true;

  setInterval(() => {
    void runReminderTick();
  }, 60 * 60 * 1000).unref?.();

  setTimeout(() => {
    void runReminderTick();
  }, 150_000).unref?.();
}

/**
 * 执行待办提醒定时任务。
 *
 * 扫描所有活跃用户，检查待办任务是否需要提醒：
 * - 逾期未完成任务（若 include_overdue_tasks 开启）
 * - lead_days 天内到期任务
 * - 每日重复任务（若 include_daily_tasks 开启）
 * 使用 last_auto_reminder_date 做每日幂等控制。
 */
async function runReminderTick() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');

  try {
    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const accounts = await accountRepo.find({ where: { is_active: true } });
    for (const account of accounts) {
      try {
        await runRemindersForUser(account.id, today, now);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[todo-reminder] user ${account.username} skipped:`, error);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[todo-reminder] tick failed:', error);
  }
}

/**
 * 为单个用户执行待办提醒检查。
 *
 * @param userId 用户 ID
 * @param today  今日日期 YYYY-MM-DD
 * @param now    当前时间
 */
async function runRemindersForUser(userId: string, today: string, now: dayjs.Dayjs) {
  const settingService = new BaseUserSettingService(LifeTodoSettingEntity);
  const settings = await settingService.getOrCreate(userId, {
    reminder_enabled: true,
    reminder_time: '09:00',
    lead_days: 3,
    include_daily_tasks: true,
    include_overdue_tasks: true,
    last_auto_reminder_date: null,
  });

  if (!settings.reminder_enabled) {
    return;
  }

  // 当天已提醒过则跳过
  if (settings.last_auto_reminder_date === today) {
    return;
  }

  // 检查是否到达提醒时间（reminder_time，默认 09:00）
  const reminderTime = settings.reminder_time || '09:00';
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const reminderMoment = now.startOf('day').add(hours || 9, 'hour').add(minutes || 0, 'minute');
  if (now.isBefore(reminderMoment)) {
    return;
  }

  const taskRepo = appDataSource.getRepository(LifeTodoTaskEntity);
  const tasks = await taskRepo.find({
    where: {
      user_id: userId,
      trashed_at: null as never,
    },
  });

  const leadDays = Number(settings.lead_days) || 3;
  const todayStart = now.startOf('day');
  const leadEnd = todayStart.add(leadDays, 'day');

  // 分类待提醒任务
  const overdueTasks: LifeTodoTaskEntity[] = [];
  const dueSoonTasks: LifeTodoTaskEntity[] = [];
  const dailyTasks: LifeTodoTaskEntity[] = [];

  for (const task of tasks) {
    if (task.completed) {
      continue;
    }

    const recurrenceType = resolveRecurrenceType(task.recurrence_type, task.is_daily);
    const isDaily = recurrenceType === 'daily';

    // 每日重复任务
    if (isDaily && settings.include_daily_tasks) {
      dailyTasks.push(task);
      continue;
    }

    if (!task.due_date) {
      continue;
    }

    const dueDate = dayjs(task.due_date).startOf('day');

    // 逾期任务
    if (dueDate.isBefore(todayStart) && settings.include_overdue_tasks) {
      overdueTasks.push(task);
      continue;
    }

    // lead_days 天内到期任务（含今日）
    if (dueDate.isBetween(todayStart, leadEnd, 'day', '[]')) {
      dueSoonTasks.push(task);
    }
  }

  const totalReminders = overdueTasks.length + dueSoonTasks.length + dailyTasks.length;
  if (totalReminders === 0) {
    return;
  }

  // 标记今日已提醒
  await settingService.update(userId, {
    last_auto_reminder_date: today,
  }, {
    reminder_enabled: true,
    reminder_time: '09:00',
    lead_days: 3,
    include_daily_tasks: true,
    include_overdue_tasks: true,
    last_auto_reminder_date: null,
  });

  // 构建提醒消息
  const title = `待办提醒：${totalReminders} 项任务待处理`;
  const message = buildReminderMessage(overdueTasks, dueSoonTasks, dailyTasks, leadDays);

  await sendNotificationSceneLogs({
    userId,
    sceneId: NOTIFICATION_SCENE_IDS.TODO_REMINDER,
    title,
    message,
    meta: {
      overdueCount: overdueTasks.length,
      dueSoonCount: dueSoonTasks.length,
      dailyCount: dailyTasks.length,
      total: totalReminders,
      leadDays,
      today,
      taskTitles: [...overdueTasks, ...dueSoonTasks, ...dailyTasks].slice(0, 5).map((t) => t.title).join(', '),
    },
  });
}

/**
 * 构建待办提醒消息文本。
 *
 * @param overdueTasks 逾期任务列表
 * @param dueSoonTasks 即将到期任务列表
 * @param dailyTasks 每日重复任务列表
 * @param leadDays 提前天数
 * @returns 消息文本
 */
function buildReminderMessage(
  overdueTasks: LifeTodoTaskEntity[],
  dueSoonTasks: LifeTodoTaskEntity[],
  dailyTasks: LifeTodoTaskEntity[],
  leadDays: number,
): string {
  const lines: string[] = [];

  if (overdueTasks.length > 0) {
    lines.push(`⚠️ 逾期任务（${overdueTasks.length} 项）：`);
    for (const task of overdueTasks.slice(0, 5)) {
      const due = task.due_date ? dayjs(task.due_date).format('M月D日') : '无截止日';
      lines.push(`  · [${task.priority}] ${task.title}（截止：${due}）`);
    }
    if (overdueTasks.length > 5) {
      lines.push(`  等共 ${overdueTasks.length} 项逾期任务`);
    }
    lines.push('');
  }

  if (dueSoonTasks.length > 0) {
    lines.push(`📅 未来 ${leadDays} 天内到期（${dueSoonTasks.length} 项）：`);
    for (const task of dueSoonTasks.slice(0, 5)) {
      const due = task.due_date ? dayjs(task.due_date).format('M月D日') : '无截止日';
      lines.push(`  · [${task.priority}] ${task.title}（截止：${due}）`);
    }
    if (dueSoonTasks.length > 5) {
      lines.push(`  等共 ${dueSoonTasks.length} 项即将到期`);
    }
    lines.push('');
  }

  if (dailyTasks.length > 0) {
    lines.push(`🔁 每日任务（${dailyTasks.length} 项）：`);
    for (const task of dailyTasks.slice(0, 5)) {
      lines.push(`  · ${task.title}`);
    }
    if (dailyTasks.length > 5) {
      lines.push(`  等共 ${dailyTasks.length} 项每日任务`);
    }
  }

  return lines.join('\n').trim();
}

/**
 * 启动待办提醒调度器。在 todo router 创建时调用。
 */
export function startTodoReminderScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
