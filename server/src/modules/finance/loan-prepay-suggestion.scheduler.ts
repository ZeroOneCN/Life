import dayjs from 'dayjs';

import { env } from '../../config/env';
import { appDataSource } from '../../db/data-source';
import { SystemUserAccountEntity } from '../system/entities/system-user-account.entity';
import { ensureNotificationScenesForUser, sendNotificationSceneLogs } from '../../shared/domain/notification';
import { NOTIFICATION_SCENE_IDS } from '../notifications/notification-scenes';
import { FinanceBudgetEntity } from './entities/finance-budget.entity';
import { FinanceLoanBillEntity } from './entities/finance-loan-bill.entity';
import { calculateCategoryActualExpenses } from './budget-calculator';
import { toNumber, round2 } from '../../shared/utils/number';

const SCHEDULER_KEY = '__loanPrepaySuggestionScheduler__';

/**
 * 闲置资金判定阈值。
 *
 * 当月预算结余（总预算 - 实际支出）达到此阈值时，视为有闲置资金可提前还款。
 */
const IDLE_FUNDS_THRESHOLD = 1000;

function setupScheduler() {
  if ((globalThis as Record<string, unknown>)[SCHEDULER_KEY]) {
    return;
  }
  (globalThis as Record<string, unknown>)[SCHEDULER_KEY] = true;

  // 每小时轮询一次，靠 daily marker 保证每天只跑一次
  setInterval(() => {
    void runSuggestionTick();
  }, 60 * 60 * 1000).unref?.();

  // 启动后延后 120 秒跑第一次，错开其他 scheduler
  setTimeout(() => {
    void runSuggestionTick();
  }, 120_000).unref?.();
}

/**
 * 执行提前还款建议定时任务。
 *
 * 每天扫描所有活跃用户，计算当月预算结余作为闲置资金代理：
 * - 若结余 >= 1000 元，且有未结清贷款账单（含利息），推送提前还款建议
 * - 建议优先还利息最高的账单
 */
async function runSuggestionTick() {
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
        await runSuggestionForUser(account.id, today);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`[loan-prepay-suggestion] user ${account.username} skipped:`, error);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[loan-prepay-suggestion] tick failed:', error);
  }
}

/**
 * 为单个用户执行提前还款建议检查。
 *
 * @param userId 用户 ID
 * @param today 今日日期 YYYY-MM-DD
 */
async function runSuggestionForUser(userId: string, today: string) {
  const month = dayjs(today).format('YYYY-MM');

  // 1. 计算当月预算结余（总支出预算 - 总实际支出）
  const budgetRepo = appDataSource.getRepository(FinanceBudgetEntity);
  const budgets = await budgetRepo.find({
    where: { user_id: userId, is_active: true, type: 'expense' },
  });

  if (budgets.length === 0) {
    return; // 无预算数据，无法判断闲置资金
  }

  const totalBudget = budgets.reduce((sum, b) => sum + toNumber(b.amount), 0);
  const categoryActualMap = await calculateCategoryActualExpenses(userId, month);
  const totalActual = Array.from(categoryActualMap.values()).reduce((sum, v) => sum + v, 0);
  const surplus = totalBudget - totalActual;

  if (surplus < IDLE_FUNDS_THRESHOLD) {
    return; // 闲置资金不足，不推送建议
  }

  // 2. 查找未结清贷款账单（含利息，按利息降序）
  const billRepo = appDataSource.getRepository(FinanceLoanBillEntity);
  const unpaidBills = await billRepo.find({
    where: { user_id: userId, is_paid: false },
  });

  if (unpaidBills.length === 0) {
    return; // 无未结清账单
  }

  // 筛选有利息的账单，按利息降序排列
  const billsWithInterest = unpaidBills
    .map((bill) => ({
      bill,
      interest: toNumber(bill.interest),
      remainingAmount: Math.max(0, toNumber(bill.amount) - toNumber(bill.paid_amount ?? 0)),
    }))
    .filter((item) => item.interest > 0 && item.remainingAmount > 0)
    .sort((a, b) => b.interest - a.interest);

  if (billsWithInterest.length === 0) {
    return; // 无利息账单，不建议
  }

  // 3. 取利息最高的账单作为建议目标
  const topBill = billsWithInterest[0];
  const suggestedAmount = Math.min(surplus, topBill.remainingAmount);

  // 4. 推送建议通知
  await ensureNotificationScenesForUser(userId, [NOTIFICATION_SCENE_IDS.LOAN_PREPAY_SUGGESTION]);
  await sendNotificationSceneLogs({
    userId,
    sceneId: NOTIFICATION_SCENE_IDS.LOAN_PREPAY_SUGGESTION,
    title: `提前还款建议：${topBill.bill.platform_name} 账单利息较高`,
    message: buildSuggestionMessage(topBill, surplus, suggestedAmount, billsWithInterest.length, month),
    meta: {
      scenario: 'prepay_suggestion',
      platformName: topBill.bill.platform_name,
      billingMonth: topBill.bill.billing_month,
      billInterest: round2(topBill.interest),
      remainingAmount: round2(topBill.remainingAmount),
      budgetSurplus: round2(surplus),
      suggestedAmount: round2(suggestedAmount),
      totalUnpaidWithInterest: billsWithInterest.length,
      today,
    },
  });
}

/**
 * 构建提前还款建议消息文本。
 *
 * @param topBill 利息最高的账单项
 * @param surplus 当月预算结余
 * @param suggestedAmount 建议还款金额
 * @param totalCandidates 有利息的未结清账单数
 * @param month 当前月份
 * @returns 消息文本
 */
function buildSuggestionMessage(
  topBill: { bill: FinanceLoanBillEntity; interest: number; remainingAmount: number },
  surplus: number,
  suggestedAmount: number,
  totalCandidates: number,
  month: string,
): string {
  const lines: string[] = [];
  lines.push(`检测到您本月（${month}）预算结余约 ¥${round2(surplus)}，有闲置资金可用于提前还款。`);
  lines.push('');
  lines.push(`建议优先偿还利息最高的账单：`);
  lines.push(`  · ${topBill.bill.platform_name} ${topBill.bill.billing_month} 账单`);
  lines.push(`  · 剩余待还 ¥${round2(topBill.remainingAmount)}，含利息 ¥${round2(topBill.interest)}`);
  lines.push(`  · 建议还款 ¥${round2(suggestedAmount)}`);
  lines.push('');
  if (totalCandidates > 1) {
    lines.push(`另有 ${totalCandidates - 1} 笔含利息的未结清账单，可前往账单页查看详情。`);
  }
  lines.push('提前还款可减少利息支出，降低贷款成本。');
  return lines.join('\n');
}

export function startLoanPrepaySuggestionScheduler() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setupScheduler();
}
