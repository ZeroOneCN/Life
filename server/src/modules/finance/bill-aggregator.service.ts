import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { FinanceLoanBillEntity } from './entities/finance-loan-bill.entity';
import { FinanceSubscriptionRecordEntity } from './entities/finance-subscription-record.entity';
import { FinanceRentRecordEntity } from './entities/finance-rent-record.entity';
import { toNumber } from '../../shared/utils/number';

/**
 * 统一账单类型。
 */
export type BillType = 'loan' | 'subscription' | 'rent';

/**
 * 统一账单状态。
 */
export type BillStatus = 'pending' | 'paid' | 'overdue';

/**
 * 统一账单数据结构。
 *
 * 将各模块的账单数据转换为统一格式，便于日历视图和列表展示。
 */
export interface UnifiedBill {
  id: string;
  type: BillType;
  title: string;
  amount: number;
  /** 已还金额（贷款账单支持部分还款后剩余的已还部分） */
  paid_amount: number;
  due_date: string;
  status: BillStatus;
  category: string;
  source_id: string;
  source_name: string;
  notes?: string;
}

/**
 * 从贷款账单转换为统一账单格式。
 *
 * amount 字段为剩余待还金额（本金+利息-已还），
 * paid_amount 为已还金额，便于日历/列表展示真实欠款。
 *
 * @param bill 贷款账单实体
 * @returns 统一格式的账单
 */
function transformLoanBill(bill: FinanceLoanBillEntity): UnifiedBill {
  const today = dayjs();
  const dueMoment = dayjs(bill.due_date);
  let status: BillStatus = 'pending';
  if (bill.is_paid) {
    status = 'paid';
  } else if (dueMoment.isBefore(today, 'day')) {
    status = 'overdue';
  }
  const totalAmount = toNumber(bill.amount) + toNumber(bill.interest);
  const paidAmount = toNumber(bill.paid_amount) + toNumber(bill.paid_interest);
  const remaining = Math.max(0, totalAmount - paidAmount);
  return {
    id: `loan_${bill.id}`,
    type: 'loan',
    title: `${bill.platform_name} 还款`,
    amount: remaining,
    paid_amount: paidAmount,
    due_date: bill.due_date,
    status,
    category: '贷款还款',
    source_id: bill.platform_id,
    source_name: bill.platform_name,
    notes: bill.notes || undefined,
  };
}

/**
 * 从订阅记录转换为统一账单格式。
 *
 * @param record 订阅记录实体
 * @returns 统一格式的账单
 */
function transformSubscriptionBill(record: FinanceSubscriptionRecordEntity): UnifiedBill {
  const today = dayjs();
  const endMoment = dayjs(record.end_date);
  let status: BillStatus = 'pending';
  if (record.auto_renew && endMoment.isBefore(today, 'day')) {
    status = 'paid';
  } else if (!record.auto_renew && endMoment.isBefore(today, 'day')) {
    status = 'overdue';
  }
  return {
    id: `subscription_${record.id}`,
    type: 'subscription',
    title: `${record.service_name} ${record.auto_renew ? '续费' : '到期'}`,
    amount: toNumber(record.cycle_price),
    paid_amount: 0,
    due_date: record.end_date,
    status,
    category: record.category_name || '服务订阅',
    source_id: record.category_id,
    source_name: record.service_name,
    notes: record.notes || undefined,
  };
}

/**
 * 从房租记录生成指定月份的账单。
 *
 * 房租记录本身没有月度账单表，根据入住日期和每月房租动态生成。
 *
 * @param record 房租记录实体
 * @param month 目标月份 YYYY-MM
 * @returns 统一格式的账单，若该月无需支付则返回 null
 */
function transformRentBill(record: FinanceRentRecordEntity, month: string): UnifiedBill | null {
  const monthMoment = dayjs(`${month}-01`);
  const moveIn = dayjs(record.move_in_date);
  const moveOut = record.move_out_date ? dayjs(record.move_out_date) : null;

  if (monthMoment.isBefore(moveIn, 'month')) {
    return null;
  }
  if (moveOut && monthMoment.isAfter(moveOut, 'month')) {
    return null;
  }

  const rent = toNumber(record.rent);
  const total = rent;

  return {
    id: `rent_${record.id}_${month}`,
    type: 'rent',
    title: `${record.address_short || record.address} 房租`,
    amount: total,
    paid_amount: 0,
    due_date: `${month}-01`,
    status: 'pending',
    category: '房租水电',
    source_id: record.channel_id,
    source_name: record.address_short || record.address,
    notes: record.notes || undefined,
  };
}

/**
 * 获取指定时间范围内的所有统一账单。
 *
 * 从贷款、订阅、房租三个模块聚合账单数据，转换为统一格式。
 *
 * @param userId 用户 ID
 * @param startDate 开始日期 YYYY-MM-DD
 * @param endDate 结束日期 YYYY-MM-DD
 * @param types 可选，指定账单类型过滤
 * @returns 统一账单数组，按到期日升序排列
 */
export async function getUnifiedBillsInRange(
  userId: string,
  startDate: string,
  endDate: string,
  types?: BillType[],
): Promise<UnifiedBill[]> {
  const enabledTypes = types ?? ['loan', 'subscription', 'rent'];
  const bills: UnifiedBill[] = [];

  if (enabledTypes.includes('loan')) {
    const loanBillRepo = appDataSource.getRepository(FinanceLoanBillEntity);
    const loanBills = await loanBillRepo
      .createQueryBuilder('bill')
      .where('bill.user_id = :userId', { userId })
      .andWhere('bill.due_date >= :startDate', { startDate })
      .andWhere('bill.due_date <= :endDate', { endDate })
      .orderBy('bill.due_date', 'ASC')
      .getMany();
    bills.push(...loanBills.map(transformLoanBill));
  }

  if (enabledTypes.includes('subscription')) {
    const subRepo = appDataSource.getRepository(FinanceSubscriptionRecordEntity);
    const subscriptions = await subRepo.find({
      where: { user_id: userId },
    });
    const startMoment = dayjs(startDate);
    const endMoment = dayjs(endDate);
    for (const sub of subscriptions) {
      if (!sub.end_date) continue;
      const endM = dayjs(sub.end_date);
      if (endM.isBefore(startMoment, 'day') || endM.isAfter(endMoment, 'day')) {
        continue;
      }
      bills.push(transformSubscriptionBill(sub));
    }
  }

  if (enabledTypes.includes('rent')) {
    const rentRepo = appDataSource.getRepository(FinanceRentRecordEntity);
    const rentRecords = await rentRepo.find({
      where: { user_id: userId },
    });
    const startMoment = dayjs(startDate);
    const endMoment = dayjs(endDate);
    let current = startMoment.startOf('month');
    const months: string[] = [];
    while (current.isBefore(endMoment) || current.isSame(endMoment, 'month')) {
      months.push(current.format('YYYY-MM'));
      current = current.add(1, 'month');
    }
    for (const record of rentRecords) {
      for (const month of months) {
        const bill = transformRentBill(record, month);
        if (bill) {
          const dueMoment = dayjs(bill.due_date);
          if (dueMoment.isAfter(startMoment.subtract(1, 'day')) && dueMoment.isBefore(endMoment.add(1, 'day'))) {
            bills.push(bill);
          }
        }
      }
    }
  }

  bills.sort((a, b) => dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf());
  return bills;
}

/**
 * 获取指定月份的账单日历数据。
 *
 * @param userId 用户 ID
 * @param month 月份 YYYY-MM
 * @param types 可选，指定账单类型过滤
 * @returns 该月份的统一账单数组
 */
export async function getMonthBills(
  userId: string,
  month: string,
  types?: BillType[],
): Promise<UnifiedBill[]> {
  const monthMoment = dayjs(`${month}-01`);
  const startDate = monthMoment.startOf('month').format('YYYY-MM-DD');
  const endDate = monthMoment.endOf('month').format('YYYY-MM-DD');
  return getUnifiedBillsInRange(userId, startDate, endDate, types);
}

/**
 * 获取未来 N 天内即将到期的账单。
 *
 * @param userId 用户 ID
 * @param days 天数
 * @param types 可选，指定账单类型过滤
 * @returns 即将到期的账单数组（不含已付）
 */
export async function getUpcomingBills(
  userId: string,
  days: number,
  types?: BillType[],
): Promise<UnifiedBill[]> {
  const today = dayjs();
  const startDate = today.format('YYYY-MM-DD');
  const endDate = today.add(days, 'day').format('YYYY-MM-DD');
  const allBills = await getUnifiedBillsInRange(userId, startDate, endDate, types);
  return allBills.filter((bill) => bill.status !== 'paid');
}

/**
 * 获取账单概览统计。
 *
 * @param userId 用户 ID
 * @param month 月份 YYYY-MM
 * @returns 统计数据（总金额、待付金额、已付金额、逾期金额、账单数量）
 */
export async function getBillSummary(
  userId: string,
  month: string,
): Promise<{
  total_count: number;
  total_amount: number;
  pending_count: number;
  pending_amount: number;
  paid_count: number;
  paid_amount: number;
  overdue_count: number;
  overdue_amount: number;
}> {
  const bills = await getMonthBills(userId, month);
  let pending_count = 0;
  let pending_amount = 0;
  let paid_count = 0;
  let paid_amount = 0;
  let overdue_count = 0;
  let overdue_amount = 0;

  for (const bill of bills) {
    if (bill.status === 'paid') {
      paid_count++;
      paid_amount += bill.amount;
    } else if (bill.status === 'overdue') {
      overdue_count++;
      overdue_amount += bill.amount;
    } else {
      pending_count++;
      pending_amount += bill.amount;
    }
  }

  return {
    total_count: bills.length,
    total_amount: pending_amount + paid_amount + overdue_amount,
    pending_count,
    pending_amount,
    paid_count,
    paid_amount,
    overdue_count,
    overdue_amount,
  };
}
