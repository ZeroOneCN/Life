import type { NotificationSceneId } from './notifications';

export type CheckupStatus = 'normal' | 'abnormal' | 'attention' | 'unknown';

export type CheckupTab = 'records' | 'batch' | 'templates' | 'insights';

export interface CheckupRecord {
  id: string;
  userId: string;
  testDate: string;
  testType: string;
  testName: string;
  value: number;
  unit: string;
  referenceRange: string;
  notes: string;
  followUpDate?: string;
  status: CheckupStatus;
  createdAt: string;
  updatedAt: string;
  lastAbnormalAlertAt?: string;
  lastFollowUpReminderAt?: string;
}

export interface CheckupRecordDraft {
  userId: string;
  testDate: string;
  testType: string;
  testName: string;
  value: number;
  unit: string;
  referenceRange: string;
  notes?: string;
  followUpDate?: string;
  status?: CheckupStatus | '';
}

export interface CheckupTemplateItem {
  id: string;
  testName: string;
  unit: string;
  referenceRange: string;
}

export interface CheckupTemplate {
  id: string;
  name: string;
  testType: string;
  items: CheckupTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CheckupTrendPoint {
  date: string;
  label: string;
  value: number;
  status: CheckupStatus;
}

export interface CheckupInsight {
  id: string;
  level: 'success' | 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedCount?: number;
  sceneId?: NotificationSceneId;
}

export interface CheckupOverviewSummary {
  totalRecords: number;
  abnormalCount: number;
  attentionCount: number;
  dueFollowUpCount: number;
  uniqueIndicatorCount: number;
  recentTestDate: string | null;
}

export interface CheckupDueFollowUpItem {
  id: string;
  userId: string;
  testName: string;
  testType: string;
  testDate: string;
  followUpDate: string;
  status: CheckupStatus;
  daysUntilDue: number;
}

export interface CheckupPageState {
  records: CheckupRecord[];
  templates: CheckupTemplate[];
  settings: {
    activeUserId: string;
    recordsUserId: string;
    trendUserId: string;
    insightUserId: string;
    reminderEnabled: boolean;
    abnormalAlertEnabled: boolean;
    followUpLeadDays: number;
  };
}
