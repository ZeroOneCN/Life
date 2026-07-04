export type GoalType = 'saving' | 'debt_repayment' | 'investment' | 'other';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type ContributionType = 'deposit' | 'withdrawal';
export type ContributionSource = 'manual' | 'auto_transfer' | 'interest' | 'other';

export interface FinanceGoal {
  id: string;
  name: string;
  description: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  startDate: string;
  targetDate: string;
  status: GoalStatus;
  icon: string;
  color: string;
  warningThresholdPercent: number;
  alertEnabled: boolean;
  sortOrder: number;
  notes: string | null;
  progressPercent: number;
  timeProgressPercent: number;
  daysRemaining: number;
  remainingAmount: number;
  monthlySavingsNeeded: number;
  isOnTrack: boolean;
  isWarning: boolean;
  isDanger: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  type: ContributionType;
  contributionDate: string;
  description: string;
  source: ContributionSource;
  createdAt: string;
}

export interface GoalSummary {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTarget: number;
  totalCurrent: number;
  overallProgress: number;
  thisMonthSaved: number;
}

export interface GoalDraft {
  name: string;
  description?: string;
  type?: GoalType;
  targetAmount: number;
  currentAmount?: number;
  currency?: string;
  startDate?: string;
  targetDate: string;
  status?: GoalStatus;
  icon?: string;
  color?: string;
  warningThresholdPercent?: number;
  alertEnabled?: boolean;
  sortOrder?: number;
  notes?: string;
}

export interface ContributionDraft {
  goalId: string;
  amount: number;
  type?: ContributionType;
  contributionDate?: string;
  description?: string;
  source?: ContributionSource;
}

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  saving: '储蓄',
  debt_repayment: '还债',
  investment: '投资',
  other: '其他',
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: '进行中',
  paused: '已暂停',
  completed: '已完成',
  cancelled: '已取消',
};

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  deposit: '存入',
  withdrawal: '取出',
};

export const CONTRIBUTION_SOURCE_LABELS: Record<ContributionSource, string> = {
  manual: '手动',
  auto_transfer: '自动转账',
  interest: '利息',
  other: '其他',
};

export const GOAL_TYPE_COLORS: Record<GoalType, string> = {
  saving: '#10b981',
  debt_repayment: '#ef4444',
  investment: '#8b5cf6',
  other: '#6b7280',
};
