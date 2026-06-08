import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { NotificationCenterLogEntity } from '../notifications/entities/notification-center-log.entity';
import {
  buildMonthlyReport,
  buildMonthlyReportMessage,
} from './finance-report.router';

const SCHEDULER_KEY = '__financeMonthlyReportScheduler__';
const MONTH_DAY_TRIGGER = 1;
const TRIGGER_HOUR = 9;

function describeMonth(month: string) {
  const [year, monthIndex] = month.split('-').map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return month;
  }
  return `${year} 年 ${monthIndex} 月`;
}

async function pushMonthlyReportForUser(userId: string, month: string) {
  const report = await buildMonthlyReport(userId, month);
  const message = buildMonthlyReportMessage(report);
  const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);
  await logRepo.save(logRepo.create({
    user_id: userId,
    channel: 'email',
    scene_id: 'finance.report.monthly',
    kind: 'scene',
    status: 'success',
    title: `财务月报 · ${describeMonth(month)}`,
    message,
  }));
  return report;
}

function setupScheduler() {
  if ((globalThis as Record<string, unknown>)[SCHEDULER_KEY]) {
    return;
  }
  (globalThis as Record<string, unknown>)[SCHEDULER_KEY] = true;

  // 每小时检查一次：1 号 9 点之后的第一次 tick 触发月报推送。
  setInterval(() => {
    void runMonthlyReportTick();
  }, 60 * 60 * 1000).unref?.();

  // 启动后立即跑一次（防进程刚启动时正好错过 tick）
  setTimeout(() => {
    void runMonthlyReportTick();
  }, 5_000).unref?.();
}

async function runMonthlyReportTick() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  const now = dayjs();
  if (now.date() !== MONTH_DAY_TRIGGER || now.hour() < TRIGGER_HOUR) {
    return;
  }
  const targetMonth = now.startOf('month').format('YYYY-MM');
  const markerKey = `${targetMonth}-pushed`;
  // 防止同一进程内重复推送
  const flag = (globalThis as Record<string, unknown>)[`${SCHEDULER_KEY}_${targetMonth}`];
  if (flag) {
    return;
  }
  (globalThis as Record<string, unknown>)[`${SCHEDULER_KEY}_${targetMonth}`] = true;
  void markerKey;

  try {
    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const accounts = await accountRepo.find({ where: { is_active: true } });
    for (const account of accounts) {
      try {
        await pushMonthlyReportForUser(account.id, targetMonth);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[finance-report] failed to push monthly report to ${account.username}`, error);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[finance-report] scheduler tick failed', error);
  }
}

/**
 * 启动月度财务报告推送调度器（每月 1 号 9 点）。
 * 单进程内幂等。
 */
export function startFinanceMonthlyReportScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
