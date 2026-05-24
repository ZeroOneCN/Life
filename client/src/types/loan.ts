export type LoanTab = 'dashboard' | 'platforms' | 'bills' | 'repayments' | 'statistics' | 'settings';

export type LoanBillStatus = 'paid' | 'unpaid' | 'overdue';

export interface LoanPlatform {
  id: string;
  userId: string;
  name: string;
  billingDay: number;
  repaymentDay: number;
  creditLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoanPlatformDraft {
  userId: string;
  name: string;
  billingDay: number;
  repaymentDay: number;
  creditLimit?: number;
}

export interface LoanBill {
  id: string;
  userId: string;
  platformId: string;
  platformName: string;
  amount: number;
  interest: number;
  billingMonth: string;
  dueDate: string;
  notes: string;
  isPaid: boolean;
  paidAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanBillDraft {
  userId: string;
  platformId: string;
  amount: number;
  interest?: number;
  billingMonth: string;
  dueDate?: string;
  notes?: string;
  isPaid?: boolean;
}

export interface LoanRepayment {
  id: string;
  userId: string;
  billId: string;
  platformId: string;
  platformName: string;
  amount: number;
  interest: number;
  repaymentDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoanRepaymentDraft {
  userId: string;
  billId?: string;
  platformId: string;
  amount: number;
  interest?: number;
  repaymentDate: string;
  notes?: string;
}

export interface LoanOverviewSummary {
  totalDebt: number;
  totalPaid: number;
  totalUnpaid: number;
  totalInterest: number;
  totalBillCount: number;
  repaymentCount: number;
  upcomingCount: number;
  overdueCount: number;
}

export interface LoanMonthlyStats {
  month: string;
  totalBills: number;
  totalAmount: number;
  totalInterest: number;
  paidAmount: number;
  unpaidAmount: number;
  overdueAmount: number;
}

export interface LoanTrendPoint {
  date: string;
  label: string;
  repaymentAmount: number;
  interestAmount: number;
  count: number;
}

export interface LoanPlatformBreakdownPoint {
  platformId: string;
  platformName: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  totalInterest: number;
  billCount: number;
  color: string;
}

export interface LoanPageState {
  platforms: LoanPlatform[];
  bills: LoanBill[];
  repayments: LoanRepayment[];
  settings: {
    activeUserId: string;
    billsUserId: string;
    repaymentsUserId: string;
    statisticsUserId: string;
    repaymentReminderEnabled: boolean;
    overdueReminderEnabled: boolean;
    autoRepaymentOnMarkPaid: boolean;
    notificationFrequency: 'daily' | 'always';
    upcomingDays: number;
  };
}
