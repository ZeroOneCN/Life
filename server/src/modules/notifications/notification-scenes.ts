/**
 * 通知场景 ID 常量定义（唯一真相源）。
 *
 * server 端 scene-seed.ts、provision-user-defaults.ts、shared/domain/notification.ts
 * 与 client 端 types/notifications.ts 均引用本文件，消除散落的字符串字面量。
 *
 * 新增场景时只需在此处添加一行常量，并同步到 SCENE_SEED 元数据。
 */

export const NOTIFICATION_SCENE_IDS = {
  /** 待办提醒 */
  TODO_REMINDER: 'todo.reminder',
  /** 号卡低余额提醒 */
  CARD_BALANCE_LOW: 'card.balance_low',
  /** 号卡账单日前提醒 */
  CARD_BILLING_UPCOMING: 'card.billing_upcoming',
  /** 贷款还款提醒 */
  LOAN_REPAYMENT_UPCOMING: 'loan.repayment_upcoming',
  /** 贷款逾期提醒 */
  LOAN_REPAYMENT_OVERDUE: 'loan.repayment_overdue',
  /** 体检复查提醒 */
  CHECKUP_FOLLOWUP_REMINDER: 'checkup.followup_reminder',
  /** 体检异常提醒 */
  CHECKUP_ABNORMAL_ALERT: 'checkup.abnormal_alert',
  /** 服药提醒 */
  MEDICATION_DOSE_REMINDER: 'medication.dose_reminder',
  /** 低库存提醒 */
  MEDICATION_STOCK_LOW: 'medication.stock_low',
  /** 订阅即将到期 */
  SUBSCRIPTION_RENEWAL_UPCOMING: 'subscription.renewal_upcoming',
  /** 订阅到期或逾期 */
  SUBSCRIPTION_EXPIRED: 'subscription.expired',
  /** 月度财务报告 */
  FINANCE_REPORT_MONTHLY: 'finance.report.monthly',
  /** 预算预警提醒 */
  FINANCE_BUDGET_WARNING: 'finance.budget.warning',
  /** 预算超支警告 */
  FINANCE_BUDGET_OVERSPEND: 'finance.budget.overspend',
  /** 账单即将到期提醒 */
  FINANCE_BILL_UPCOMING: 'finance.bill.upcoming',
  /** 账单逾期提醒 */
  FINANCE_BILL_OVERDUE: 'finance.bill.overdue',
  /** 储蓄目标达成庆祝 */
  FINANCE_GOAL_COMPLETED: 'finance.goal.completed',
  /** 储蓄目标进度预警 */
  FINANCE_GOAL_WARNING: 'finance.goal.warning',
  /** 旅行归档跟进 */
  TRAVEL_FOLLOWUP: 'travel.followup',
  /** 日程提醒 */
  SCHEDULE_REMINDER: 'schedule.reminder',
} as const;

/** 通知场景 ID 字面量联合类型（编译时校验拼写） */
export type NotificationSceneId = typeof NOTIFICATION_SCENE_IDS[keyof typeof NOTIFICATION_SCENE_IDS];

/**
 * 通知渠道类型常量（唯一真相源）。
 * server 与 client 共享同一份定义，避免 3/6/3 不一致。
 */
export const NOTIFICATION_CHANNEL_TYPES = {
  EMAIL: 'email',
  WECHAT_WORK: 'wechatWork',
  DING_TALK: 'dingTalk',
  FEISHU: 'feishu',
  TELEGRAM: 'telegram',
  WEBHOOK: 'webhook',
} as const;

/** 通知渠道类型字面量联合类型 */
export type NotificationChannelType = typeof NOTIFICATION_CHANNEL_TYPES[keyof typeof NOTIFICATION_CHANNEL_TYPES];

/**
 * 默认渠道列表（6 种全量）。
 * provision-user-defaults 与通知中心均引用此列表，消除 3/6 不一致。
 */
export const DEFAULT_CHANNEL_TYPES: ReadonlyArray<NotificationChannelType> = [
  NOTIFICATION_CHANNEL_TYPES.EMAIL,
  NOTIFICATION_CHANNEL_TYPES.WECHAT_WORK,
  NOTIFICATION_CHANNEL_TYPES.DING_TALK,
  NOTIFICATION_CHANNEL_TYPES.FEISHU,
  NOTIFICATION_CHANNEL_TYPES.TELEGRAM,
  NOTIFICATION_CHANNEL_TYPES.WEBHOOK,
];
