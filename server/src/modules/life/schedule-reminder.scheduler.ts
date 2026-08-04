import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { LifeScheduleEventEntity } from './entities/life-schedule-event.entity';
import { LifeScheduleSettingEntity } from './entities/life-schedule-setting.entity';
import {
  expandScheduleRecurrenceInRange,
  isScheduleRecurringType,
} from './schedule-recurrence';

const SCHEDULER_KEY = '__scheduleReminderScheduler__';

/**
 * 设置调度器：每小时跑一次扫描，启动后延后 120 秒跑第一次。
 * 错开其他 scheduler（如 bill-reminder 90s）。
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
  }, 120_000).unref?.();
}

/**
 * 执行日程提醒定时任务。
 *
 * 扫描所有活跃用户，检查未来 24 小时内需要提醒的事件，
 * 根据事件 reminder_minutes 提前推送提醒。
 * 使用 last_auto_reminder_date 做每日幂等控制。
 */
async function runReminderTick() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');
  const flagKey = `${SCHEDULER_KEY}_${today}`;
  if ((globalThis as Record<string, unknown>)[flagKey]) {
    return;
  }
  (globalThis as Record<string, unknown>)[flagKey] = true;

  try {
    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const accounts = await accountRepo.find({ where: { is_active: true } });
    for (const account of accounts) {
      try {
        await runRemindersForUser(account.id, today, now);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[schedule-reminder] user ${account.username} skipped:`, error);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[schedule-reminder] tick failed:', error);
  }
}

/**
 * 为单个用户执行日程提醒检查。
 *
 * @param userId 用户 ID
 * @param today  今日日期 YYYY-MM-DD
 * @param now    当前时间
 */
async function runRemindersForUser(userId: string, today: string, now: dayjs.Dayjs) {
  const settingService = new BaseUserSettingService(LifeScheduleSettingEntity);
  const settings = await settingService.getOrCreate(userId, {
    default_reminder_minutes: 30,
    default_view: 'month',
    week_starts_on: 1,
    reminder_enabled: true,
    reminder_time: '08:00',
    last_auto_reminder_date: null,
  });

  if (!settings.reminder_enabled) {
    return;
  }

  // 当天已提醒过则跳过
  if (settings.last_auto_reminder_date === today) {
    return;
  }

  const eventRepo = appDataSource.getRepository(LifeScheduleEventEntity);
  const events = await eventRepo.find({
    where: {
      user_id: userId,
      trashed_at: null as never,
    },
  });

  const dayStart = now.startOf('day');
  const dayEnd = now.endOf('day');
  const tomorrowEnd = now.add(1, 'day').endOf('day');

  // 今日需要提醒的事件列表
  const todayReminders: Array<{ event: LifeScheduleEventEntity; remindAt: dayjs.Dayjs }> = [];
  // 明日需要提醒的事件列表（用于提前预告）
  const tomorrowReminders: Array<{ event: LifeScheduleEventEntity; remindAt: dayjs.Dayjs }> = [];

  for (const event of events) {
    if (event.completed || !event.reminder_minutes) {
      continue;
    }

    if (!isScheduleRecurringType(event.recurrence_type)) {
      const remindAt = dayjs(event.start_at).subtract(event.reminder_minutes, 'minute');
      if (remindAt.isBetween(dayStart, dayEnd, null, '[]')) {
        todayReminders.push({ event, remindAt });
      } else if (remindAt.isBetween(dayEnd, tomorrowEnd, null, '(]')) {
        tomorrowReminders.push({ event, remindAt });
      }
      continue;
    }

    // 重复事件：展开今日 + 明日范围
    const occurrences = expandScheduleRecurrenceInRange(event, dayStart, tomorrowEnd);
    for (const occurrence of occurrences) {
      const remindAt = dayjs(occurrence.startAt).subtract(event.reminder_minutes ?? 0, 'minute');
      if (remindAt.isBetween(dayStart, dayEnd, null, '[]')) {
        todayReminders.push({ event, remindAt });
      } else if (remindAt.isBetween(dayEnd, tomorrowEnd, null, '(]')) {
        tomorrowReminders.push({ event, remindAt });
      }
    }
  }

  if (todayReminders.length === 0 && tomorrowReminders.length === 0) {
    return;
  }

  // 标记今日已提醒
  await settingService.update(userId, {
    last_auto_reminder_date: today,
  }, {
    default_reminder_minutes: 30,
    default_view: 'month',
    week_starts_on: 1,
    reminder_enabled: true,
    reminder_time: '08:00',
    last_auto_reminder_date: null,
  });

  // 发送今日提醒
  if (todayReminders.length > 0) {
    const title = `今日日程提醒：${todayReminders.length} 项日程待办`;
    const message = buildReminderMessage(todayReminders, '今日');
    await sendNotificationSceneLogs({
      userId,
      sceneId: NOTIFICATION_SCENE_IDS.SCHEDULE_REMINDER,
      title,
      message,
      meta: {
        todayCount: todayReminders.length,
        tomorrowCount: tomorrowReminders.length,
        today,
        eventTitles: todayReminders.slice(0, 5).map((r) => r.event.title).join(', '),
      },
    });
    return;
  }

  // 仅明日提醒（提前预告）
  if (tomorrowReminders.length > 0) {
    const title = `明日日程预告：${tomorrowReminders.length} 项日程明日开始`;
    const message = buildReminderMessage(tomorrowReminders, '明日');
    await sendNotificationSceneLogs({
      userId,
      sceneId: NOTIFICATION_SCENE_IDS.SCHEDULE_REMINDER,
      title,
      message,
      meta: {
        todayCount: 0,
        tomorrowCount: tomorrowReminders.length,
        today,
        eventTitles: tomorrowReminders.slice(0, 5).map((r) => r.event.title).join(', '),
      },
    });
  }
}

/**
 * 构建提醒消息文本。
 *
 * @param reminders 提醒列表
 * @param label 时间标签（今日/明日）
 * @returns 消息文本
 */
function buildReminderMessage(
  reminders: Array<{ event: LifeScheduleEventEntity; remindAt: dayjs.Dayjs }>,
  label: string,
): string {
  const lines: string[] = [];
  lines.push(`${label}有 ${reminders.length} 项日程需要处理：`);
  lines.push('');
  for (const item of reminders.slice(0, 8)) {
    const start = dayjs(item.event.start_at).format('HH:mm');
    const reminderLabel = item.event.reminder_minutes ? `（提前 ${item.event.reminder_minutes} 分钟提醒）` : '';
    lines.push(`  · ${start} ${item.event.title}${reminderLabel}`);
  }
  if (reminders.length > 8) {
    lines.push(`  等共 ${reminders.length} 项日程`);
  }
  return lines.join('\n');
}

/**
 * 启动日程提醒调度器。在 index.ts bootstrap 中调用。
 */
export function startScheduleReminderScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
