import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { FinanceBudgetEntity } from './entities/finance-budget.entity';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { sendNotificationSceneLogs } from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';
import { calculateCategoryActualExpenses } from './budget-calculator';
import { toNumber, round2 } from '../../shared/utils/number';

const SCHEDULER_KEY = '__budgetAlertScheduler__';

function setupScheduler() {
  if ((globalThis as Record<string, unknown>)[SCHEDULER_KEY]) {
    return;
  }
  (globalThis as Record<string, unknown>)[SCHEDULER_KEY] = true;

  // 每天 09:00 跑一次
  setInterval(() => {
    void runAlertTick();
  }, 60 * 60 * 1000).unref?.();

  // 启动后延后 60 秒跑第一次
  setTimeout(() => {
    void runAlertTick();
  }, 60_000).unref?.();
}

/**
 * 执行预算超支预警定时任务。
 *
 * 扫描所有活跃用户的活跃预算，计算当月实际支出：
 * - 若进度 >= 100%（超支）且本月未发送过超支提醒，则发送 finance.budget.overspend 通知
 * - 若进度 >= 预警阈值 且本月未发送过预警提醒，则发送 finance.budget.warning 通知
 *
 * 使用 last_warning_marker 字段（格式：budgetId:YYYY-MM:YYYY-MM-DD）做幂等控制，
 * 确保同一预算同一状态每月至少触发一次，且每日最多一次。
 */
async function runAlertTick() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');
  const month = now.format('YYYY-MM');
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
        await runAlertsForUser(account.id, month, today);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[budget-alert] user ${account.username} skipped:`, error);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[budget-alert] tick failed:', error);
  }
}

/**
 * 为单个用户执行预算预警检查。
 *
 * @param userId 用户 ID
 * @param month 当前月份 YYYY-MM
 * @param today 今日日期 YYYY-MM-DD
 */
async function runAlertsForUser(userId: string, month: string, today: string) {
  const budgetRepo = appDataSource.getRepository(FinanceBudgetEntity);
  const budgets = await budgetRepo.find({
    where: { user_id: userId, is_active: true, alert_enabled: true, type: 'expense' },
  });

  if (!budgets.length) {
    return;
  }

  const categoryActualMap = await calculateCategoryActualExpenses(userId, month);

  for (const budget of budgets) {
    const categoryKey = budget.category_name || budget.category_id;
    const actualAmount = toNumber(categoryActualMap.get(categoryKey) ?? 0);
    const budgetAmount = toNumber(budget.amount);
    const threshold = toNumber(budget.warning_threshold_percent);
    const percent = budgetAmount > 0 ? (actualAmount / budgetAmount) * 100 : 0;
    const marker = `${budget.id}:${month}:${today}`;

    if (percent >= 100 && budget.last_warning_marker !== marker) {
      // 超支提醒，每月一次（用 month 前缀判断）
      if (!budget.last_warning_marker.startsWith(`${budget.id}:${month}:over`)) {
        const overAmount = round2(actualAmount - budgetAmount);
        await sendNotificationSceneLogs({
          userId,
          sceneId: NOTIFICATION_SCENE_IDS.FINANCE_BUDGET_OVERSPEND,
          title: `预算超支警告：${budget.name}`,
          message: `「${budget.name}」预算 ¥${round2(budgetAmount)}，当前已支出 ¥${round2(actualAmount)}（${round2(percent)}%），已超出预算 ¥${overAmount}。请关注支出情况。`,
          meta: {
            budgetId: budget.id,
            budgetName: budget.name,
            categoryName: budget.category_name,
            budgetAmount: round2(budgetAmount),
            actualAmount: round2(actualAmount),
            overAmount,
            progressPercent: round2(percent),
            status: 'over_budget',
            month,
          },
        });
        budget.last_warning_marker = `${budget.id}:${month}:over:${today}`;
        await budgetRepo.save(budget);
      }
    } else if (percent >= threshold && !budget.last_warning_marker.startsWith(`${budget.id}:${month}:warn`)) {
      // 预警提醒，每月一次
      await sendNotificationSceneLogs({
        userId,
        sceneId: NOTIFICATION_SCENE_IDS.FINANCE_BUDGET_WARNING,
        title: `预算预警：${budget.name}`,
        message: `「${budget.name}」预算 ¥${round2(budgetAmount)}，当前已支出 ¥${round2(actualAmount)}（${round2(percent)}%），接近预警线 ${round2(threshold)}%。请注意控制支出。`,
        meta: {
          budgetId: budget.id,
          budgetName: budget.name,
          categoryName: budget.category_name,
          budgetAmount: round2(budgetAmount),
          actualAmount: round2(actualAmount),
          progressPercent: round2(percent),
          status: 'warning',
          month,
        },
      });
      budget.last_warning_marker = `${budget.id}:${month}:warn:${today}`;
      await budgetRepo.save(budget);
    }
  }
}

export function startBudgetAlertScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
