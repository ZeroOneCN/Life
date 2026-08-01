import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { ensureNotificationScenesForUser, sendNotificationSceneLogs } from '../../shared/domain/notification';
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
  const title = `财务月报 · ${describeMonth(month)}`;

  // 确保 scene 记录存在（用户可能从未访问过通知中心，scene 尚未 seed）。
  // 此处不强制启用，避免覆盖用户在通知中心主动禁用的配置。
  await ensureNotificationScenesForUser(userId, ['finance.report.monthly']);

  // 真正下发到所有已绑定渠道，让用户能在企业微信 / 邮件 / Webhook 收到富文本月报
  return sendNotificationSceneLogs({
    userId,
    sceneId: 'finance.report.monthly',
    title,
    message,
    meta: {
      month: report.month,
      startDate: report.startDate,
      endDate: report.endDate,
      totalExpense: report.totalExpense,
      monthOverMonthChange: report.monthOverMonthChange,
      monthOverMonthChangePercent: report.monthOverMonthChangePercent,
      yearOverYearChange: report.yearOverYearChange,
      yearOverYearChangePercent: report.yearOverYearChangePercent,
    },
  });
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
  // 月报在月初推送上个月的总结：targetMonth 应为上个月，而非刚开始的当前月。
  const targetMonth = now.subtract(1, 'month').format('YYYY-MM');
  // 防止同一进程内重复推送，幂等 marker 以"上个月份"为 key。
  const flag = (globalThis as Record<string, unknown>)[`${SCHEDULER_KEY}_${targetMonth}`];
  if (flag) {
    return;
  }
  (globalThis as Record<string, unknown>)[`${SCHEDULER_KEY}_${targetMonth}`] = true;

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
 * 启动月度财务报告推送调度器（每月 1 号 9 点推送上个月的总结）。
 * 单进程内幂等。
 */
export function startFinanceMonthlyReportScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
