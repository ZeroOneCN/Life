/**
 * 通知场景的默认元数据种子。
 *
 * 第一次进入通知中心时一次性 seed 到用户记录，后续新加的 scene 也会自动补齐到已有用户。
 * 抽取到独立文件是为了让 shared/domain/notification.ts 中的 ensureNotificationScenesForUser
 * 能够复用同一份种子数据，避免 scheduler 在 scene 未初始化时静默丢弃通知。
 */
import { NOTIFICATION_SCENE_IDS } from './notification-scenes';

export interface NotificationSceneSeed {
  scene_id: string;
  label: string;
  enabled: boolean;
  summary: string;
  description: string;
}

export const SCENE_SEED: ReadonlyArray<NotificationSceneSeed> = [
  { scene_id: NOTIFICATION_SCENE_IDS.TODO_REMINDER, label: '待办提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.CARD_BALANCE_LOW, label: '号卡低余额提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.CARD_BILLING_UPCOMING, label: '号卡账单日前提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_UPCOMING, label: '贷款还款提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.LOAN_REPAYMENT_OVERDUE, label: '贷款逾期提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.CHECKUP_FOLLOWUP_REMINDER, label: '体检复查提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.CHECKUP_ABNORMAL_ALERT, label: '体检异常提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.MEDICATION_DOSE_REMINDER, label: '服药提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.MEDICATION_STOCK_LOW, label: '低库存提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.SUBSCRIPTION_RENEWAL_UPCOMING, label: '订阅即将到期', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.SUBSCRIPTION_EXPIRED, label: '订阅到期或逾期', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.FINANCE_REPORT_MONTHLY, label: '月度财务报告', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.FINANCE_BUDGET_WARNING, label: '预算预警提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.FINANCE_BUDGET_OVERSPEND, label: '预算超支警告', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.FINANCE_BILL_UPCOMING, label: '账单即将到期提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.FINANCE_BILL_OVERDUE, label: '账单逾期提醒', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.FINANCE_GOAL_COMPLETED, label: '储蓄目标达成庆祝', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.FINANCE_GOAL_WARNING, label: '储蓄目标进度预警', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.TRAVEL_FOLLOWUP, label: '旅行归档跟进', enabled: false, summary: '', description: '' },
  { scene_id: NOTIFICATION_SCENE_IDS.SCHEDULE_REMINDER, label: '日程提醒', enabled: false, summary: '', description: '' },
];
