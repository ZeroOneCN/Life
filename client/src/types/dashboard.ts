import type { NotificationLogEntry } from './notifications';

export interface DashboardOverviewCard {
  id: string;
  label: string;
  value: string;
  helper: string;
  accent?: string;
}

export interface DashboardAgendaItem {
  id: string;
  module: string;
  title: string;
  summary: string;
  severity: 'high' | 'medium' | 'low';
  targetDate: string;
  href: string;
}

export interface DashboardUpcomingSubscription {
  id: string;
  serviceName: string;
  planName: string;
  cyclePrice: number;
  currency: string;
  endDate: string;
  autoRenew: boolean;
  daysLeft: number;
}

export interface DashboardSnapshotMetric {
  label: string;
  value: string;
  helper?: string;
  accent?: string;
}

export interface DashboardSnapshotChartPoint {
  id: string;
  label: string;
  value: number;
  secondaryValue?: number;
  color?: string;
}

export interface DashboardSnapshotListItem {
  id: string;
  title: string;
  meta: string;
  value?: string;
  accent?: string;
}

export interface DashboardModuleSnapshot {
  title: string;
  subtitle: string;
  metrics: DashboardSnapshotMetric[];
  chartTitle: string;
  chartDescription: string;
  chartKind: 'bar' | 'line';
  chartData: DashboardSnapshotChartPoint[];
  listTitle: string;
  listDescription: string;
  listItems: DashboardSnapshotListItem[];
}

export interface DashboardNotificationSnapshot {
  enabledChannels: number;
  enabledScenes: number;
  logCount: number;
  mostActiveSceneLabel: string;
  recentLogs: NotificationLogEntry[];
}

export interface DashboardPageSummary {
  overviewCards: DashboardOverviewCard[];
  agenda: DashboardAgendaItem[];
  health: DashboardModuleSnapshot;
  finance: DashboardModuleSnapshot;
  life: DashboardModuleSnapshot;
  investment: DashboardModuleSnapshot;
  notifications: DashboardNotificationSnapshot;
  upcomingSubscriptions: DashboardUpcomingSubscription[];
  connectedModuleCount: number;
}
