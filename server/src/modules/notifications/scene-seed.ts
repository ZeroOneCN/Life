/**
 * 通知场景的默认元数据种子。
 *
 * 第一次进入通知中心时一次性 seed 到用户记录，后续新加的 scene 也会自动补齐到已有用户。
 * 抽取到独立文件是为了让 shared/domain/notification.ts 中的 ensureNotificationScenesForUser
 * 能够复用同一份种子数据，避免 scheduler 在 scene 未初始化时静默丢弃通知。
 */
export interface NotificationSceneSeed {
  scene_id: string;
  label: string;
  enabled: boolean;
  summary: string;
  description: string;
}

export const SCENE_SEED: ReadonlyArray<NotificationSceneSeed> = [
  { scene_id: 'todo.reminder', label: '待办提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'card.balance_low', label: '号卡低余额提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'card.billing_upcoming', label: '号卡账单日前提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'loan.repayment_upcoming', label: '贷款还款提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'loan.repayment_overdue', label: '贷款逾期提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'checkup.followup_reminder', label: '体检复查提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'checkup.abnormal_alert', label: '体检异常提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'medication.dose_reminder', label: '服药提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'medication.stock_low', label: '低库存提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'subscription.renewal_upcoming', label: '订阅即将到期', enabled: false, summary: '', description: '' },
  { scene_id: 'subscription.expired', label: '订阅到期或逾期', enabled: false, summary: '', description: '' },
  { scene_id: 'finance.report.monthly', label: '月度财务报告', enabled: false, summary: '', description: '' },
  { scene_id: 'finance.budget.warning', label: '预算预警提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'finance.budget.overspend', label: '预算超支警告', enabled: false, summary: '', description: '' },
  { scene_id: 'finance.bill.upcoming', label: '账单即将到期提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'finance.bill.overdue', label: '账单逾期提醒', enabled: false, summary: '', description: '' },
  { scene_id: 'finance.goal.completed', label: '储蓄目标达成庆祝', enabled: false, summary: '', description: '' },
  { scene_id: 'finance.goal.warning', label: '储蓄目标进度预警', enabled: false, summary: '', description: '' },
  { scene_id: 'travel.followup', label: '旅行归档跟进', enabled: false, summary: '', description: '' },
  { scene_id: 'schedule.reminder', label: '日程提醒', enabled: false, summary: '', description: '' },
];
