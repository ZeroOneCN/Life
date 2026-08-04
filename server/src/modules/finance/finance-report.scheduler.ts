import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { NotificationCenterLogEntity } from '../notifications/entities/notification-center-log.entity';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { ensureNotificationScenesForUser, sendNotificationSceneLogs } from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';
import {
  buildMonthlyReport,
  buildMonthlyReportMessage,
} from './finance-report.router';

const SCHEDULER_KEY = '__financeMonthlyReportScheduler__';
const MONTH_DAY_TRIGGER = 1;
const TRIGGER_HOUR = 9;
const SCENE_ID = NOTIFICATION_SCENE_IDS.FINANCE_REPORT_MONTHLY;

function describeMonth(month: string) {
  const [year, monthIndex] = month.split('-').map((value) => Number(value));
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return month;
  }
  return `${year} 年 ${monthIndex} 月`;
}

/**
 * 检查指定用户在某月份是否已经推送过财务月报。
 *
 * 通过查询 notification_center_log 表中当月（推送发生的自然月）1 号 0 点之后的
 * scene_id=finance.report.monthly 记录来判断。
 * 这样即使进程重启、tick 多次触发，也只会推送一次。
 *
 * @param userId 用户 ID
 * @param currentMonthStart 推送发生的自然月 1 号 0 点（dayjs）
 * @returns 是否已推送过
 */
async function hasPushedThisMonth(userId: string, currentMonthStart: dayjs.Dayjs): Promise<boolean> {
  const logRepo = appDataSource.getRepository(NotificationCenterLogEntity);
  const total = await logRepo
    .createQueryBuilder('log')
    .where('log.user_id = :userId', { userId })
    .andWhere('log.scene_id = :sceneId', { sceneId: SCENE_ID })
    .andWhere('log.created_at >= :start', { start: currentMonthStart.format('YYYY-MM-DD HH:mm:ss') })
    .andWhere('log.deleted_at IS NULL')
    .getCount();
  return total > 0;
}

async function pushMonthlyReportForUser(userId: string, month: string) {
  const report = await buildMonthlyReport(userId, month);
  const message = buildMonthlyReportMessage(report);
  const title = `财务月报 · ${describeMonth(month)}`;

  // 确保 scene 记录存在（用户可能从未访问过通知中心，scene 尚未 seed）。
  // 此处不强制启用，避免覆盖用户在通知中心主动禁用的配置。
  await ensureNotificationScenesForUser(userId, [SCENE_ID]);

  // 真正下发到所有已绑定渠道，让用户能在企业微信 / 邮件 / Webhook 收到富文本月报
  return sendNotificationSceneLogs({
    userId,
    sceneId: SCENE_ID,
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

  // 每 6 小时检查一次：1 号 9 点之后的第一次 tick 触发月报推送。
  // 月报只需在月初推送一次，通过数据库查询持久化幂等，进程重启也不会重复推送。
  setInterval(() => {
    void runMonthlyReportTick();
  }, 6 * 60 * 60 * 1000).unref?.();

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
  // 推送发生的自然月 1 号 0 点，用于查询是否已推送过
  const currentMonthStart = now.startOf('month');

  try {
    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const accounts = await accountRepo.find({ where: { is_active: true } });
    for (const account of accounts) {
      try {
        // 持久化幂等：查询该用户当月是否已推送过月报，已推送则跳过
        const pushed = await hasPushedThisMonth(account.id, currentMonthStart);
        if (pushed) {
          continue;
        }
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
 * 启动月度财务报告推送调度器。
 *
 * 触发时机：每月 1 号 9 点之后的第一次 tick。
 * 推送内容：上个月的财务总结。
 * 幂等保障：通过数据库查询 notification_center_log 表判断当月是否已推送，进程重启也不会重复推送。
 */
export function startFinanceMonthlyReportScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
