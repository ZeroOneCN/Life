import dayjs from 'dayjs';

import type { LoanBill, LoanBillStatus, LoanPlatform } from '../types/loan';

const DATE_FORMAT = 'YYYY-MM-DD';
const MONTH_FORMAT = 'YYYY-MM';

export const LOAN_ALL_PLATFORMS = 'all';
export const LOAN_BILL_PAGE_SIZE = 10;
export const LOAN_REPAYMENT_PAGE_SIZE = 10;

export function formatLoanAmount(value: number) {
  const amount = Number.isFinite(value) ? value : 0;
  return `¥${amount.toFixed(2)}`;
}

export function getLoanBillStatus(bill: LoanBill, referenceDate = dayjs()): LoanBillStatus {
  if (bill.isPaid) {
    return 'paid';
  }

  return dayjs(bill.dueDate).isBefore(referenceDate, 'day') ? 'overdue' : 'unpaid';
}

export function suggestLoanDueDate(platform: LoanPlatform | null | undefined, billingMonth: string) {
  const monthSeed = normalizeMonth(billingMonth);

  if (!platform) {
    return dayjs(`${monthSeed}-01`).format(DATE_FORMAT);
  }

  const baseMonth = dayjs(`${monthSeed}-01`);
  const day = Math.min(platform.repaymentDay, baseMonth.daysInMonth());
  return baseMonth.date(day).format(DATE_FORMAT);
}

function normalizeMonth(value: string) {
  if (/^\d{4}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(MONTH_FORMAT) : dayjs().format(MONTH_FORMAT);
}
