export type TodoTab = 'tasks' | 'settings' | 'logs' | 'trash';

export type TodoPriority = 'high' | 'medium' | 'low';

export interface TodoTaskRecord {
  id: string;
  title: string;
  descriptionMarkdown: string;
  dueDate: string;
  priority: TodoPriority;
  tags: string[];
  isDaily: boolean;
  completed: boolean;
  completedAt: string;
  lastCompletedDate: string;
  trashedAt: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TodoTaskDraft {
  title: string;
  descriptionMarkdown?: string;
  dueDate?: string;
  priority?: TodoPriority;
  tags?: string[];
  isDaily?: boolean;
}

export interface TodoReminderSettings {
  reminderEnabled: boolean;
  reminderTime: string;
  leadDays: number;
  includeDailyTasks: boolean;
  includeOverdueTasks: boolean;
  lastAutoReminderDate: string;
}

export interface TodoOverviewSummary {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  dailyCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  dueTodayCount: number;
}

export interface TodoReminderPayload {
  date: string;
  taskCount: number;
  overdueCount: number;
  dueTodayCount: number;
  leadWindowCount: number;
  message: string;
}

export interface TodoPageState {
  tasks: TodoTaskRecord[];
  settings: TodoReminderSettings;
}
