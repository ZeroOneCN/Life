export interface TodoTask {
  id: string;
  title: string;
  category: string;
  dueDate: string;
  completed: boolean;
}

export interface TodoPageState {
  tasks: TodoTask[];
  settings: {
    reminderEnabled: boolean;
  };
}

export interface SimCardRecord {
  id: string;
  phone: string;
  carrier: string;
  city: string;
  balance: number;
  monthlyFee: number;
  billingDay: number;
  trafficPlan: string;
}

export interface CardPageState {
  cards: SimCardRecord[];
  settings: {
    balanceLowEnabled: boolean;
    billingUpcomingEnabled: boolean;
    balanceThreshold: number;
    notificationDaysBefore: number;
  };
}

export interface LoanBillRecord {
  id: string;
  platform: string;
  dueDate: string;
  amount: number;
  paid: boolean;
}

export interface LoanPageState {
  bills: LoanBillRecord[];
  settings: {
    repaymentReminderEnabled: boolean;
    overdueReminderEnabled: boolean;
    autoRepaymentOnMarkPaid: boolean;
    notificationFrequency: 'daily' | 'always';
    upcomingDays: number;
  };
}
