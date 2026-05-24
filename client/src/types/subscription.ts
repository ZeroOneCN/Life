export type SubscriptionTab = 'records' | 'dashboard' | 'categories' | 'settings';

export type SubscriptionBillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'one_time';

export type SubscriptionStatus = 'active' | 'upcoming' | 'expired';

export interface SubscriptionRecord {
  id: string;
  serviceName: string;
  planName: string;
  categoryId: string;
  categoryName: string;
  startDate: string;
  endDate: string;
  billingCycle: SubscriptionBillingCycle;
  cyclePrice: number;
  autoRenew: boolean;
  notes: string;
  lastUpcomingReminderMarker?: string;
  lastExpiredReminderMarker?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRecordDraft {
  serviceName: string;
  planName?: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  billingCycle: SubscriptionBillingCycle;
  cyclePrice: number;
  autoRenew?: boolean;
  notes?: string;
}

export interface SubscriptionCategory {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionCategoryDraft {
  name: string;
  description?: string;
}

export interface SubscriptionOverviewSummary {
  totalCount: number;
  activeCount: number;
  upcomingCount: number;
  expiredCount: number;
  autoRenewCount: number;
  monthlyEstimate: number;
  annualEstimate: number;
  nearestExpiryDate: string;
}

export interface SubscriptionCategoryBreakdownPoint {
  categoryId: string;
  categoryName: string;
  count: number;
  monthlyAmount: number;
  annualAmount: number;
  color: string;
}

export interface SubscriptionExpiryPoint {
  date: string;
  label: string;
  count: number;
  annualAmount: number;
  monthlyAmount: number;
  services: string[];
}

export interface SubscriptionReminderItem {
  recordId: string;
  serviceName: string;
  endDate: string;
  sceneId: 'subscription.renewal_upcoming' | 'subscription.expired';
  marker: string;
  message: string;
}

export interface SubscriptionPageState {
  records: SubscriptionRecord[];
  categories: SubscriptionCategory[];
  settings: {
    recordsKeyword: string;
    recordsCategoryId: string;
    recordsStatus: 'all' | SubscriptionStatus;
    recordsAutoRenewFilter: 'all' | 'auto' | 'manual';
    recordsExpiryStartDate: string;
    recordsExpiryEndDate: string;
    dashboardRangeDays: 90 | 180 | 365;
    reminderEnabled: boolean;
    expiryDayReminderEnabled: boolean;
    leadDays: number;
    includeAutoRenewInReminders: boolean;
  };
}
