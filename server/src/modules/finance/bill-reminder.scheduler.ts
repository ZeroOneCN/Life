import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { ensureNotificationScenesForUser, sendNotificationSceneLogs } from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { FinanceBillReminderSettingEntity } from './entities/finance-bill-reminder-setting.entity';
import { getUnifiedBillsInRange, type BillType, type UnifiedBill } from './bill-aggregator.service';
import { toNumber, round2 } from '../../shared/utils/number';

const SCHEDULER_KEY = '__billReminderScheduler__';

/**
 * 逾期账单回溯天数。
 *
 * 用于扫描过去 N 天内到期但仍未支付的账单，作为"已逾期"场景推送。
 * 取 30 天以覆盖常见账单周期，同时避免无限回溯导致通知噪音。
 */
const OVERDUE_LOOKBACK_DAYS = 30;

/**
 * 每个用户的每日提醒 marker（内存级，重启后重置）。
 *
 * 格式：`${userId}_${today}`，用于确保每个用户每天只推送一次提醒。
 * 之所以不用全局 marker，是因为需要按每个用户的 reminder_time 分别触发。
 */
const userDailyMarkers = new Set<string>();

function setupScheduler() {
  if ((globalThis as Record<string, unknown>)[SCHEDULER_KEY]) {
    return;
  }
  (globalThis as Record<string, unknown>)[SCHEDULER_KEY] = true;

  // 每 30 分钟检查一次，根据每个用户的 reminder_time 设置触发提醒
  setInterval(() => {
    void runReminderTick();
  }, 30 * 60 * 1000).unref?.();

  // 启动后延后 90 秒跑第一次，错开其他 scheduler
  setTimeout(() => {
    void runReminderTick();
  }, 90_000).unref?.();
}

/**
 * 执行账单提醒定时任务。
 *
 * 每 30 分钟扫描所有活跃用户，按各自的 reminder_time 配置触发提醒。
 * 每个用户每天最多推送一次（由 userDailyMarkers 控制）。
 */
async function runReminderTick() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');
  const currentTime = now.format('HH:mm');

  try {
    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const accounts = await accountRepo.find({ where: { is_active: true } });
    for (const account of accounts) {
      try {
        await runRemindersForUser(account.id, today, currentTime);
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
 * 通知逻辑（根据实际账单日期触发，不再提前 N 天汇总推送）：
 * 1. 已逾期：到期日 < 今日 且未支付 → 推送逾期提醒
 * 2. 今日到期：到期日 === 今日 且未支付 → 推送今日到期提醒
 * 3. 明日到期：到期日 === 明日 且未支付 → 推送提前1天提醒
 *
 * 三种场景相互独立，分别推送，由 per-user 每日 marker 保证一天最多各推送一次。
 *
 * @param userId 用户 ID
 * @param today 今日日期 YYYY-MM-DD
 * @param currentTime 当前时间 HH:mm，用于匹配用户的 reminder_time
 */
async function runRemindersForUser(userId: string, today: string, currentTime: string) {
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

  // 检查当前时间是否匹配用户的提醒时间。只有匹配时才执行提醒逻辑，
  // 确保用户配置的 reminder_time 真正生效，而非在服务器启动后的任意时间触发。
  if (settings.reminder_time && settings.reminder_time !== currentTime) {
    return;
  }

  // 每个用户每天只推送一次，由 per-user 内存 marker 控制
  const userMarker = `${userId}_${today}`;
  if (userDailyMarkers.has(userMarker)) {
    return;
  }

  const types = (settings.enabled_types || 'loan,subscription,rent')
    .split(',')
    .filter(Boolean) as BillType[];

  if (types.length === 0) {
    return;
  }

  const todayMoment = dayjs(today, 'YYYY-MM-DD', true);
  const tomorrowStr = todayMoment.add(1, 'day').format('YYYY-MM-DD');

  // 扫描过去 30 天（覆盖逾期）到明天（覆盖提前1天）的所有账单
  const startDate = todayMoment.subtract(OVERDUE_LOOKBACK_DAYS, 'day').format('YYYY-MM-DD');
  const endDate = tomorrowStr;

  const allBills = await getUnifiedBillsInRange(userId, startDate, endDate, types);
  const unpaidBills = allBills.filter((bill) => bill.status !== 'paid');

  if (unpaidBills.length === 0) {
    return;
  }

  // 按实际账单日期分三类
  const overdueBills = unpaidBills.filter((b) => dayjs(b.due_date).isBefore(todayMoment, 'day'));
  const dueTodayBills = unpaidBills.filter((b) => dayjs(b.due_date).isSame(todayMoment, 'day'));
  const dueTomorrowBills = unpaidBills.filter((b) => b.due_date === tomorrowStr);

  // 确保 scene 记录存在并强制启用，避免因通知中心 scene 默认禁用导致提醒被静默丢弃。
  // 用户在通知中心主动禁用的场景不会在此被重新启用（ensureNotificationScenesForUser
  // 只对不存在的 scene 按 enableScenes=true 创建，已存在的 scene 不修改 enabled 值）。
  await ensureNotificationScenesForUser(
    userId,
    [NOTIFICATION_SCENE_IDS.FINANCE_BILL_UPCOMING, NOTIFICATION_SCENE_IDS.FINANCE_BILL_OVERDUE],
    { enableScenes: true },
  );

  // 标记已推送，防止今天重复执行
  userDailyMarkers.add(userMarker);

  // 场景一：已逾期（按逾期天数分档推送升级提醒）
  if (overdueBills.length > 0) {
    const overdueAmount = overdueBills.reduce((sum, b) => sum + toNumber(b.amount), 0);
    // 找出最高逾期天数，用于确定升级等级
    const maxOverdueDays = Math.max(
      ...overdueBills.map((b) => dayjs(today).diff(dayjs(b.due_date), 'day')),
    );
    const escalationLevel = getOverdueEscalationLevel(maxOverdueDays);

    await sendNotificationSceneLogs({
      userId,
      sceneId: NOTIFICATION_SCENE_IDS.FINANCE_BILL_OVERDUE,
      title: escalationLevel.title(overdueBills.length),
      message: buildOverdueMessage(overdueBills, overdueAmount, escalationLevel.level),
      meta: {
        scenario: 'overdue',
        escalationLevel: escalationLevel.level,
        maxOverdueDays,
        billCount: overdueBills.length,
        overdueAmount: round2(overdueAmount),
        today,
        billTitles: overdueBills.map((b) => b.title).join(', '),
      },
    });
  }

  // 场景二：今日到期
  if (dueTodayBills.length > 0) {
    const todayAmount = dueTodayBills.reduce((sum, b) => sum + toNumber(b.amount), 0);
    await sendNotificationSceneLogs({
      userId,
      sceneId: NOTIFICATION_SCENE_IDS.FINANCE_BILL_UPCOMING,
      title: `今日账单提醒：${dueTodayBills.length} 笔账单今日到期`,
      message: buildTodayMessage(dueTodayBills, todayAmount),
      meta: {
        scenario: 'due_today',
        billCount: dueTodayBills.length,
        todayAmount: round2(todayAmount),
        today,
        billTitles: dueTodayBills.map((b) => b.title).join(', '),
      },
    });
  }

  // 场景三：明日到期（提前1天）
  if (dueTomorrowBills.length > 0) {
    const tomorrowAmount = dueTomorrowBills.reduce((sum, b) => sum + toNumber(b.amount), 0);
    await sendNotificationSceneLogs({
      userId,
      sceneId: NOTIFICATION_SCENE_IDS.FINANCE_BILL_UPCOMING,
      title: `账单提醒：${dueTomorrowBills.length} 笔账单明日到期`,
      message: buildTomorrowMessage(dueTomorrowBills, tomorrowAmount, tomorrowStr),
      meta: {
        scenario: 'due_tomorrow',
        billCount: dueTomorrowBills.length,
        tomorrowAmount: round2(tomorrowAmount),
        tomorrow: tomorrowStr,
        today,
        billTitles: dueTomorrowBills.map((b) => b.title).join(', '),
      },
    });
  }
}

/**
 * 逾期升级等级。
 *
 * 根据最高逾期天数分四档：
 * - normal: 1-2 天，普通逾期提醒
 * - level3: 3-6 天，逾期 3 天升级提醒
 * - level7: 7-29 天，逾期 7 天严重提醒
 * - level30: 30+ 天，逾期 30 天紧急提醒
 */
type OverdueEscalationLevel = 'normal' | 'level3' | 'level7' | 'level30';

interface OverdueEscalation {
  level: OverdueEscalationLevel;
  title: (billCount: number) => string;
  urgency: string;
}

/**
 * 根据逾期天数获取升级等级。
 *
 * @param days 逾期天数
 * @returns 升级等级信息
 */
function getOverdueEscalationLevel(days: number): OverdueEscalation {
  if (days >= 30) {
    return {
      level: 'level30',
      title: (n) => `紧急：${n} 笔账单逾期超 30 天`,
      urgency: '逾期已超 30 天，请立即处理以避免影响征信！',
    };
  }
  if (days >= 7) {
    return {
      level: 'level7',
      title: (n) => `严重：${n} 笔账单逾期超 7 天`,
      urgency: '逾期已超 7 天，请尽快还款避免进一步损失。',
    };
  }
  if (days >= 3) {
    return {
      level: 'level3',
      title: (n) => `逾期升级提醒：${n} 笔账单逾期超 3 天`,
      urgency: '逾期已超 3 天，建议尽快处理。',
    };
  }
  return {
    level: 'normal',
    title: (n) => `账单逾期提醒：${n} 笔账单已逾期`,
    urgency: '',
  };
}

/**
 * 构建逾期提醒消息文本。
 *
 * @param overdueBills 逾期账单列表
 * @param overdueAmount 逾期金额
 * @param level 升级等级
 * @returns 消息文本
 */
function buildOverdueMessage(
  overdueBills: UnifiedBill[],
  overdueAmount: number,
  level: OverdueEscalationLevel = 'normal',
): string {
  const lines: string[] = [];
  const urgencyPrefix = level === 'level30'
    ? '【紧急】'
    : level === 'level7'
      ? '【严重】'
      : level === 'level3'
        ? '【升级】'
        : '';
  lines.push(`${urgencyPrefix}您有 ${overdueBills.length} 笔账单已逾期，逾期金额 ¥${round2(overdueAmount)}，请尽快处理。`);
  lines.push('');
  lines.push('逾期账单：');
  for (const bill of overdueBills.slice(0, 5)) {
    const daysOverdue = dayjs().diff(dayjs(bill.due_date), 'day');
    lines.push(`  · ${bill.title} - ¥${round2(bill.amount)}（逾期 ${daysOverdue} 天）`);
  }
  if (overdueBills.length > 5) {
    lines.push(`  等共 ${overdueBills.length} 笔逾期账单`);
  }
  return lines.join('\n');
}

/**
 * 构建今日到期提醒消息文本。
 *
 * @param todayBills 今日到期账单列表
 * @param todayAmount 今日待付金额
 * @returns 消息文本
 */
function buildTodayMessage(todayBills: UnifiedBill[], todayAmount: number): string {
  const lines: string[] = [];
  lines.push(`今日有 ${todayBills.length} 笔账单到期，待付金额 ¥${round2(todayAmount)}，请及时处理。`);
  lines.push('');
  lines.push('今日到期：');
  for (const bill of todayBills.slice(0, 5)) {
    lines.push(`  · ${bill.title} - ¥${round2(bill.amount)}`);
  }
  if (todayBills.length > 5) {
    lines.push(`  等共 ${todayBills.length} 笔账单`);
  }
  return lines.join('\n');
}

/**
 * 构建明日到期提醒消息文本（提前1天推送）。
 *
 * @param tomorrowBills 明日到期账单列表
 * @param tomorrowAmount 明日待付金额
 * @param tomorrowStr 明日日期 YYYY-MM-DD
 * @returns 消息文本
 */
function buildTomorrowMessage(
  tomorrowBills: UnifiedBill[],
  tomorrowAmount: number,
  tomorrowStr: string,
): string {
  const lines: string[] = [];
  lines.push(`明日（${tomorrowStr}）有 ${tomorrowBills.length} 笔账单到期，待付金额 ¥${round2(tomorrowAmount)}，请提前做好还款准备。`);
  lines.push('');
  lines.push('明日到期：');
  for (const bill of tomorrowBills.slice(0, 8)) {
    lines.push(`  · ${bill.title} - ¥${round2(bill.amount)}`);
  }
  if (tomorrowBills.length > 8) {
    lines.push(`  等共 ${tomorrowBills.length} 笔账单`);
  }
  return lines.join('\n');
}

export function startBillReminderScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
