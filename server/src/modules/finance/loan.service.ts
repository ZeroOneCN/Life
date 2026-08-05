import { FinanceLoanRepaymentEntity } from './entities/finance-loan-repayment.entity';
import { FinanceLoanBillEntity } from './entities/finance-loan-bill.entity';
import { toNumber } from '../../shared/utils/number';

/** 还款记录响应 DTO */
export interface LoanRepaymentDto {
  id: string;
  userId: string;
  billId: string | null;
  platformId: string;
  platformName: string;
  amount: number;
  interest: number;
  repaymentDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 计算还款记录总金额（amount 已含利息，利息不再单独累加）。
 * 用于 assistant-query.service.ts queryFinance 的 loan 汇总口径。
 * @param records 还款记录列表
 * @returns 总金额（保留 2 位小数）
 */
export function sumLoanRepaymentAmount(records: FinanceLoanRepaymentEntity[]): number {
  const total = records.reduce((sum, row) => sum + toNumber(row.amount), 0);
  return Number(total.toFixed(2));
}

/**
 * 计算还款记录本金总和。
 * @param records 还款记录列表
 * @returns 本金总和（保留 2 位小数）
 */
export function sumLoanPrincipal(records: FinanceLoanRepaymentEntity[]): number {
  const total = records.reduce((sum, row) => sum + toNumber(row.amount), 0);
  return Number(total.toFixed(2));
}

/**
 * 计算还款记录利息总和。
 * @param records 还款记录列表
 * @returns 利息总和（保留 2 位小数）
 */
export function sumLoanInterest(records: FinanceLoanRepaymentEntity[]): number {
  const total = records.reduce((sum, row) => sum + toNumber(row.interest), 0);
  return Number(total.toFixed(2));
}

/**
 * 将还款记录实体转为前端响应对象。
 * @param entity 还款记录实体
 * @returns 前端响应 DTO
 */
export function mapLoanRepayment(entity: FinanceLoanRepaymentEntity): LoanRepaymentDto {
  return {
    id: entity.id,
    userId: entity.user_id,
    billId: entity.bill_id,
    platformId: entity.platform_id,
    platformName: entity.platform_name,
    amount: Number(entity.amount),
    interest: Number(entity.interest),
    repaymentDate: entity.repayment_date,
    notes: entity.notes ?? '',
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

/**
 * 构建贷款账单总览（基于 bill 表，与 loan.router.ts buildOverview 一致）。
 * @param bills 账单列表
 * @param repayments 还款列表
 * @returns 总览统计
 */
export function buildLoanBillOverview(
  bills: FinanceLoanBillEntity[],
  repayments: FinanceLoanRepaymentEntity[],
) {
  const toNum = (v: unknown) => Number(v) || 0;
  return {
    totalDebt: Number(bills.reduce((sum, bill) => sum + toNum(bill.amount), 0).toFixed(2)),
    totalPaid: Number(repayments.reduce((sum, repayment) => sum + toNum(repayment.amount), 0).toFixed(2)),
    // 待还金额 = 各账单剩余欠款（amount 已含利息，不再单独累加 interest）
    totalUnpaid: Number(
      bills
        .filter((bill) => !bill.is_paid)
        .reduce((sum, bill) => sum + Math.max(0, toNum(bill.amount) - toNum(bill.paid_amount)), 0)
        .toFixed(2),
    ),
    totalInterest: Number(bills.reduce((sum, bill) => sum + toNum(bill.interest), 0).toFixed(2)),
    totalBillCount: bills.length,
    repaymentCount: repayments.length,
  };
}
