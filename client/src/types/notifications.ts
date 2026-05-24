export type NotificationChannelType = 'email' | 'wechatWork' | 'webhook';

export type NotificationSceneId =
  | 'todo.reminder'
  | 'card.balance_low'
  | 'card.billing_upcoming'
  | 'loan.repayment_upcoming'
  | 'loan.repayment_overdue'
  | 'checkup.followup_reminder'
  | 'checkup.abnormal_alert';

export interface NotificationChannelConfig {
  type: NotificationChannelType;
  label: string;
  enabled: boolean;
  status: 'ready' | 'incomplete' | 'disabled';
  recipient?: string;
  senderName?: string;
  webhookUrl?: string;
  secret?: string;
  notes?: string;
  lastTestAt?: string;
}

export interface NotificationSceneConfig {
  id: NotificationSceneId;
  label: string;
  enabled: boolean;
  channels: NotificationChannelType[];
  summary: string;
  description: string;
}

export interface NotificationTemplate {
  sceneId: NotificationSceneId;
  title: string;
  body: string;
}

export interface NotificationLogEntry {
  id: string;
  createdAt: string;
  channel: NotificationChannelType;
  sceneId: NotificationSceneId | null;
  kind: 'test' | 'scene';
  status: 'success' | 'skipped' | 'error';
  title: string;
  message: string;
}

export interface NotificationTestResult {
  success: boolean;
  message: string;
  logEntry: NotificationLogEntry;
}

export interface NotificationCenterState {
  channels: Record<NotificationChannelType, NotificationChannelConfig>;
  scenes: Record<NotificationSceneId, NotificationSceneConfig>;
  templates: Record<NotificationSceneId, NotificationTemplate>;
  logs: NotificationLogEntry[];
}
