export type BillType = 'loan' | 'subscription' | 'rent';
export type BillStatus = 'pending' | 'paid' | 'overdue';

/**
 * 统一账单数据结构。
 *
 * 聚合贷款、订阅、房租等各模块的账单数据，统一格式。
 */
export interface UnifiedBill {
  id: string;
  type: BillType;
  title: string;
  amount: number;
  due_date: string;
  status: BillStatus;
  category: string;
  source_id: string;
  source_name: string;
  notes?: string;
}

/**
 * 账单概览统计。
 */
export interface BillSummary {
  total_count: number;
  total_amount: number;
  pending_count: number;
  pending_amount: number;
  paid_count: number;
  paid_amount: number;
  overdue_count: number;
  overdue_amount: number;
}

/**
 * 账单提醒设置。
 */
export interface BillReminderSetting {
  id: string;
  user_id: string;
  reminder_enabled: boolean;
  lead_days: number;
  enabled_types: string;
  reminder_time: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/**
 * 账单类型的显示标签映射。
 */
export const BILL_TYPE_LABELS: Record<BillType, string> = {
  loan: '贷款还款',
  subscription: '服务订阅',
  rent: '房租水电',
};

/**
 * 账单状态的显示标签映射。
 */
export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  pending: '待支付',
  paid: '已支付',
  overdue: '已逾期',
};
