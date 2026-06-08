import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { FinanceTravelBookEntity } from '../finance/entities/finance-travel-book.entity';
import { FinanceSubscriptionRecordEntity } from '../finance/entities/finance-subscription-record.entity';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { NotificationCenterLogEntity } from '../notifications/entities/notification-center-log.entity';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { FinanceSubscriptionSettingEntity } from '../finance/entities/finance-subscription-setting.entity';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';

const SCHEDULER_KEY = '__financeFollowupScheduler__';
const FOLLOWUP_DAYS_AFTER = 30;
const SUBSCRIPTION_LEAD_DAYS_DEFAULT = 3;

function setupScheduler() {
  if ((globalThis as Record<string, unknown>)[SCHEDULER_KEY]) {
    return;
  }
  (globalThis as Record<string, unknown>)[SCHEDULER_KEY] = true;

  // 每天 09:30 跑一次
  setInterval(() => {
    void runFollowupTick();
  }, 60 * 60 * 1000).unref?.();

  // 启动后延后 30 秒跑第一次，避免与 finance-report 冲突
  setTimeout(() => {
    void runFollowupTick();
  }, 30_000).unref?.();
}

async function runFollowupTick() {
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
        await runTravelFollowupsForUser(account.id, today);
        await runSubscriptionRemindersForUser(account.id, today);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[finance-followup] user ${account.username} skipped:`, error);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[finance-followup] tick failed:', error);
  }
}

async function runTravelFollowupsForUser(userId: string, today: string) {
  const bookRepo = appDataSource.getRepository(FinanceTravelBookEntity);
  const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);
  const items = await bookRepo.find({ where: { user_id: userId } });
  const todayMoment = dayjs(today, 'YYYY-MM-DD', true);

  for (const book of items) {
    if (!book.end_date || book.status === 'archived') {
      continue;
    }

    const days = todayMoment.diff(dayjs(book.end_date, 'YYYY-MM-DD', true), 'day');
    if (days < FOLLOWUP_DAYS_AFTER) {
      continue;
    }

    const marker = `${book.id}:${today}`;
    if (book.last_followup_marker === marker) {
      continue;
    }

    const message = [
      `旅行「${book.name}」已结束 ${days} 天。`,
      `出发日期：${dayjs(book.start_date).format('YYYY-MM-DD')}`,
      book.end_date ? `返回日期：${dayjs(book.end_date).format('YYYY-MM-DD')}` : null,
      '',
      '是否需要：',
      '1. 将该旅行归档（点击旅行页右上角"归档"）',
      '2. 录入新一次的旅行',
    ].filter(Boolean).join('\n');

    await sendNotificationSceneLogs({
      userId,
      sceneId: 'travel.followup',
      title: `旅行「${book.name}」已结束 ${days} 天`,
      message,
    });

    await bookRepo.save({
      ...book,
      last_followup_marker: marker,
    });
  }
  void logRepo;
}

async function runSubscriptionRemindersForUser(userId: string, today: string) {
  const settingService = new BaseUserSettingService(FinanceSubscriptionSettingEntity);
  const settings = await settingService.getOrCreate(userId, {
    reminder_enabled: true,
    expiry_day_reminder_enabled: true,
    lead_days: SUBSCRIPTION_LEAD_DAYS_DEFAULT,
    include_auto_renew_in_reminders: true,
  });

  if (!settings.reminder_enabled) {
    return;
  }

  const subscriptionRepo = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
  const records = await subscriptionRepo.find({ where: { user_id: userId } });
  if (!records.length) {
    return;
  }

  const todayMoment = dayjs(today, 'YYYY-MM-DD', true);
  for (const record of records) {
    if (!record.end_date) {
      continue;
    }
    const diff = dayjs(record.end_date, 'YYYY-MM-DD', true).diff(todayMoment, 'day');

    // 提前 N 天推送
    if (diff >= 0 && diff <= settings.lead_days) {
      const base = `subscription:upcoming:${record.id}`;
      const marker = `${base}:${today}`;
      if (record.last_upcoming_reminder_marker !== marker) {
        await sendNotificationSceneLogs({
          userId,
          sceneId: 'subscription.renewal_upcoming',
          title: `${record.service_name} 即将${record.auto_renew ? '自动续费' : '到期'}`,
          message: `将于 ${record.end_date}（${diff} 天后）${record.auto_renew ? '自动续费' : '到期'}，续费价格 ${record.cycle_price}。`,
        });
        await subscriptionRepo.update({ id: record.id }, { last_upcoming_reminder_marker: marker });
      }
    }

    // 已到期
    if (diff <= 0) {
      const base = `subscription:expired:${record.id}`;
      const marker = `${base}:${today}`;
      if (record.last_expired_reminder_marker !== marker) {
        await sendNotificationSceneLogs({
          userId,
          sceneId: 'subscription.expired',
          title: `${record.service_name} 已${record.auto_renew ? '自动续费' : '到期'}`,
          message: `上次续费日期 ${record.end_date}${record.auto_renew ? '，已自动续费。' : '，请评估是否需要保留。'}`,
        });
        await subscriptionRepo.update({ id: record.id }, { last_expired_reminder_marker: marker });
      }
    }
  }
}

export function startFinanceFollowupScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
