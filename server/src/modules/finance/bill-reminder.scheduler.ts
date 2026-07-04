import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { FinanceBillReminderSettingEntity } from './entities/finance-bill-reminder-setting.entity';
import { getUpcomingBills, type BillType, type UnifiedBill } from './bill-aggregator.service';

const SCHEDULER_KEY = '__billReminderScheduler__';

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function setupScheduler() {
  if ((globalThis as Record<string, unknown>)[SCHEDULER_KEY]) {
    return;
  }
  (globalThis as Record<string, unknown>)[SCHEDULER_KEY] = true;

  // 每天 08:45 跑一次
  setInterval(() => {
    void runReminderTick();
  }, 60 * 60 * 1000).unref?.();

  // 启动后延后 90 秒跑第一次，错开其他 scheduler
  setTimeout(() => {
    void runReminderTick();
  }, 90_000).unref?.();
}

/**
 * 执行账单提醒定时任务。
 *
 * 每天扫描所有活跃用户，检查未来 N 天内到期的账单，
 * 根据提醒设置发送统一账单提醒通知。
 * 使用每日 marker 做幂等控制，每天最多发送一次汇总提醒。
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
        await runRemindersForUser(account.id, today);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[bill-reminder] user ${account.username} skipped:`, error);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[bill-reminder] tick failed:', error);
  }
}

/**
 * 为单个用户执行账单提醒检查。
 *
 * @param userId 用户 ID
 * @param today 今日日期 YYYY-MM-DD
 */
async function runRemindersForUser(userId: string, today: string) {
  const settingService = new BaseUserSettingService(FinanceBillReminderSettingEntity);
  const settings = await settingService.getOrCreate(userId, {
    reminder_enabled: true,
    lead_days: 7,
    enabled_types: 'loan,subscription,rent',
    reminder_time: '09:00',
    notes: '',
  });

  if (!settings.reminder_enabled) {
    return;
  }

  const types = (settings.enabled_types || 'loan,subscription,rent')
    .split(',')
    .filter(Boolean) as BillType[];

  if (types.length === 0) {
    return;
  }

  const bills = await getUpcomingBills(userId, settings.lead_days, types);

  if (bills.length === 0) {
    return;
  }

  const todayMoment = dayjs(today, 'YYYY-MM-DD', true);
  const todayBills = bills.filter((b) => dayjs(b.due_date).isSame(todayMoment, 'day'));
  const upcomingBills = bills.filter((b) => !dayjs(b.due_date).isSame(todayMoment, 'day'));
  const overdueBills = bills.filter((b) => b.status === 'overdue');

  const totalAmount = bills.reduce((sum, b) => sum + toNumber(b.amount), 0);
  const overdueAmount = overdueBills.reduce((sum, b) => sum + toNumber(b.amount), 0);

  let title = '';
  let message = '';
  let sceneId = 'finance.bill.upcoming';

  if (overdueBills.length > 0) {
    sceneId = 'finance.bill.overdue';
    title = `账单逾期提醒：${overdueBills.length} 笔账单已逾期`;
    message = buildOverdueMessage(overdueBills, upcomingBills, totalAmount, overdueAmount);
  } else if (todayBills.length > 0) {
    title = `今日账单提醒：${todayBills.length} 笔账单今日到期`;
    message = buildTodayMessage(todayBills, upcomingBills, totalAmount);
  } else {
    title = `账单提醒：${bills.length} 笔账单将在 ${settings.lead_days} 天内到期`;
    message = buildUpcomingMessage(upcomingBills, totalAmount);
  }

  await sendNotificationSceneLogs({
    userId,
    sceneId,
    title,
    message,
    meta: {
      billCount: bills.length,
      todayCount: todayBills.length,
      overdueCount: overdueBills.length,
      upcomingCount: upcomingBills.length,
      totalAmount: round2(totalAmount),
      overdueAmount: round2(overdueAmount),
      leadDays: settings.lead_days,
      today,
      billTitles: bills.map((b) => b.title).join(', '),
    },
  });
}

/**
 * 构建逾期提醒消息文本。
 *
 * @param overdueBills 逾期账单列表
 * @param upcomingBills 即将到期账单列表
 * @param totalAmount 总金额
 * @param overdueAmount 逾期金额
 * @returns 消息文本
 */
function buildOverdueMessage(
  overdueBills: UnifiedBill[],
  upcomingBills: UnifiedBill[],
  totalAmount: number,
  overdueAmount: number,
): string {
  const lines: string[] = [];
  lines.push(`您有 ${overdueBills.length} 笔账单已逾期，逾期金额 ¥${round2(overdueAmount)}。`);
  lines.push('');
  lines.push('逾期账单：');
  for (const bill of overdueBills.slice(0, 5)) {
    const daysOverdue = dayjs().diff(dayjs(bill.due_date), 'day');
    lines.push(`  · ${bill.title} - ¥${round2(bill.amount)}（逾期 ${daysOverdue} 天）`);
  }
  if (overdueBills.length > 5) {
    lines.push(`  等共 ${overdueBills.length} 笔逾期账单`);
  }
  if (upcomingBills.length > 0) {
    lines.push('');
    lines.push(`另有 ${upcomingBills.length} 笔账单即将到期，请及时处理。`);
  }
  lines.push('');
  lines.push(`待付总金额：¥${round2(totalAmount)}`);
  return lines.join('\n');
}

/**
 * 构建今日到期提醒消息文本。
 *
 * @param todayBills 今日到期账单列表
 * @param upcomingBills 即将到期账单列表
 * @param totalAmount 总金额
 * @returns 消息文本
 */
function buildTodayMessage(
  todayBills: UnifiedBill[],
  upcomingBills: UnifiedBill[],
  totalAmount: number,
): string {
  const lines: string[] = [];
  lines.push(`今日有 ${todayBills.length} 笔账单到期，请及时处理。`);
  lines.push('');
  lines.push('今日到期：');
  for (const bill of todayBills.slice(0, 5)) {
    lines.push(`  · ${bill.title} - ¥${round2(bill.amount)}`);
  }
  if (todayBills.length > 5) {
    lines.push(`  等共 ${todayBills.length} 笔账单`);
  }
  if (upcomingBills.length > 0) {
    lines.push('');
    lines.push(`另有 ${upcomingBills.length} 笔账单即将到期。`);
  }
  lines.push('');
  lines.push(`今日待付金额：¥${round2(todayBills.reduce((s, b) => s + toNumber(b.amount), 0))}`);
  lines.push(`近期待付总金额：¥${round2(totalAmount)}`);
  return lines.join('\n');
}

/**
 * 构建即将到期提醒消息文本。
 *
 * @param upcomingBills 即将到期账单列表
 * @param totalAmount 总金额
 * @returns 消息文本
 */
function buildUpcomingMessage(upcomingBills: UnifiedBill[], totalAmount: number): string {
  const lines: string[] = [];
  lines.push(`您有 ${upcomingBills.length} 笔账单即将到期，请提前做好还款准备。`);
  lines.push('');
  lines.push('即将到期：');
  for (const bill of upcomingBills.slice(0, 8)) {
    const daysLeft = dayjs(bill.due_date).diff(dayjs(), 'day');
    lines.push(`  · ${bill.title} - ¥${round2(bill.amount)}（${daysLeft} 天后）`);
  }
  if (upcomingBills.length > 8) {
    lines.push(`  等共 ${upcomingBills.length} 笔账单`);
  }
  lines.push('');
  lines.push(`待付总金额：¥${round2(totalAmount)}`);
  return lines.join('\n');
}

export function startBillReminderScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
