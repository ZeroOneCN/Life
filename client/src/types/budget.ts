export type BudgetType = 'income' | 'expense';
export type BudgetPeriodType = 'monthly' | 'yearly' | 'custom';
export type BudgetStatus = 'on_track' | 'warning' | 'over_budget';

export interface BudgetCategory {
  id: string;
  name: string;
  description: string;
  type: BudgetType;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  periodType: BudgetPeriodType;
  type: BudgetType;
  startDate: string;
  endDate: string;
  warningThresholdPercent: number;
  isActive: boolean;
  alertEnabled: boolean;
  lastWarningMarker: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetProgress {
  budgetId: string;
  budgetName: string;
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  actualAmount: number;
  remainingAmount: number;
  progressPercent: number;
  warningThresholdPercent: number;
  status: BudgetStatus;
  periodType: BudgetPeriodType;
  type: BudgetType;
}

export interface BudgetProgressOverview {
  month: string;
  year: number;
  totalBudget: number;
  totalActual: number;
  totalRemaining: number;
  overallPercent: number;
  overBudgetCount: number;
  warningCount: number;
  onTrackCount: number;
  items: BudgetProgress[];
}

export interface BudgetDetailProgress {
  progress: BudgetProgress;
  trend: Array<{ month: string; actual: number; budget: number }>;
  history: BudgetHistory[];
}

export interface BudgetHistory {
  id: string;
  budgetId: string;
  budgetName: string;
  categoryId: string;
  categoryName: string;
  previousAmount: number;
  newAmount: number;
  periodType: BudgetPeriodType;
  changeReason: string;
  effectiveDate: string;
  createdAt: string;
}

export interface BudgetYearlyComparison {
  year: number;
  totalBudgeted: number;
  totalActual: number;
  totalDifference: number;
  monthly: Array<{
    month: string;
    budgeted: number;
    actual: number;
    difference: number;
    percent: number;
  }>;
}

export interface BudgetAlertTriggerResult {
  logs: Array<{
    id: string;
    channel: string;
    status: string;
    title: string;
    message: string;
    sceneId: string;
  }>;
  count: number;
}

export interface BudgetCategoryListResponse {
  items: BudgetCategory[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BudgetListResponse {
  items: Budget[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BudgetHistoryListResponse {
  items: BudgetHistory[];
  total: number;
  page: number;
  pageSize: number;
}
