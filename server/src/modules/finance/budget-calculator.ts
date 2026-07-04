import dayjs from 'dayjs';
import { Between } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { FinanceShoppingRecordEntity } from './entities/finance-shopping-record.entity';
import { FinanceTravelExpenseRecordEntity } from './entities/finance-travel-expense-record.entity';
import { FinanceLoanRepaymentEntity } from './entities/finance-loan-repayment.entity';
import { FinanceSubscriptionRecordEntity } from './entities/finance-subscription-record.entity';
import { FinanceRentRecordEntity } from './entities/finance-rent-record.entity';
import { calculateRentMonthlyCost } from './finance-report.router';

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 计算指定月份各分类的实际支出金额。
 *
 * 聚合逻辑：
 * - 购物：按 platform 字段归类，累加 price
 * - 旅行：按 category 字段归类，累加 amount - discount_amount
 * - 贷款：按 platform_name 归类，累加 amount + interest
 * - 订阅：按 category_name 归类，按 billing_cycle 折算月均
 * - 房租：按 channel_name 归类，按月度摊销计算
 *
 * @param userId 用户 ID
 * @param month 月份，格式 YYYY-MM
 * @returns Map<分类名, 实际支出金额>
 */
export async function calculateCategoryActualExpenses(userId: string, month: string): Promise<Map<string, number>> {
  const monthStart = dayjs(`${month}-01`).startOf('month');
  const monthEnd = dayjs(`${month}-01`).endOf('month');
  const start = monthStart.format('YYYY-MM-DD');
  const end = monthEnd.format('YYYY-MM-DD');

  const [shoppingRows, travelRows, loanRows, subscriptionRows, rentRows] = await Promise.all([
    appDataSource.getRepository(FinanceShoppingRecordEntity).find({
      where: { user_id: userId, date: Between(start, end) },
    }),
    appDataSource.getRepository(FinanceTravelExpenseRecordEntity).find({
      where: { user_id: userId, date: Between(start, end) },
    }),
    appDataSource.getRepository(FinanceLoanRepaymentEntity).find({
      where: { user_id: userId, repayment_date: Between(start, end) },
    }),
    appDataSource.getRepository(FinanceSubscriptionRecordEntity).find({
      where: { user_id: userId, start_date: Between(start, end) },
    }),
    appDataSource.getRepository(FinanceRentRecordEntity)
      .createQueryBuilder('rent')
      .where('rent.user_id = :userId', { userId })
      .andWhere('rent.move_in_date <= :end', { end })
      .andWhere('(rent.move_out_date IS NULL OR rent.move_out_date >= :start)', { start })
      .getMany(),
  ]);

  const categoryMap = new Map<string, number>();

  for (const row of shoppingRows) {
    const category = row.platform || '购物';
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + toNumber(row.price));
  }

  for (const row of travelRows) {
    const amount = toNumber(row.amount) - toNumber(row.discount_amount);
    const finalAmount = amount > 0 ? amount : toNumber(row.amount);
    const category = row.category || '旅行';
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + finalAmount);
  }

  for (const row of loanRows) {
    const amount = toNumber(row.amount) + toNumber(row.interest);
    const category = `贷款·${row.platform_name || '未知平台'}`;
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + amount);
  }

  for (const row of subscriptionRows) {
    const cycle = (row.billing_cycle || 'monthly').toLowerCase();
    const price = toNumber(row.cycle_price);
    const monthlyAllocation = cycle === 'yearly' ? price / 12 : cycle === 'quarterly' ? price / 3 : price;
    const category = row.category_name || '订阅';
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + monthlyAllocation);
  }

  for (const row of rentRows) {
    const monthlyAmount = calculateRentMonthlyCost(row, monthStart, monthEnd);
    const category = `房租·${row.channel_name || '未知渠道'}`;
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + monthlyAmount);
  }

  return categoryMap;
}
