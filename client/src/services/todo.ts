import dayjs from 'dayjs';

import type { TodoPageState as LegacyTodoPageState } from '../types/pages';
import type {
  TodoOverviewSummary,
  TodoPageState,
  TodoPriority,
  TodoReminderPayload,
  TodoReminderSettings,
  TodoTaskDraft,
  TodoTaskRecord,
} from '../types/todo';
import { readStorage } from '../utils/storage';

const DATE_FORMAT = 'YYYY-MM-DD';
const DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm';
const LEGACY_STORAGE_KEY = 'lifeos_todo_page';

export const TODO_PAGE_SIZE = 10;
export const TODO_LOG_PAGE_SIZE = 8;
export const TODO_PRIORITY_ORDER: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
export const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: '高优先级',
  medium: '中优先级',
  low: '低优先级',
};
export const TODO_PRIORITY_TAG_TONES: Record<TodoPriority, 'red' | 'orange' | 'green'> = {
  high: 'red',
  medium: 'orange',
  low: 'green',
};

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function normalizeTrimmedValue(value: unknown, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeDate(value: unknown, fallback = '') {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return fallback;
  }

  const sanitized = raw.replace(/\./g, '-').replace(/\//g, '-');
  const parsed = dayjs(sanitized);
  return parsed.isValid() ? parsed.format(DATE_FORMAT) : fallback;
}

function normalizeTimestamp(value: unknown, fallbackDate = dayjs().format(DATE_FORMAT)) {
  const parsed = dayjs(String(value ?? '').trim());
  return parsed.isValid()
    ? parsed.format(DATE_TIME_FORMAT)
    : dayjs(`${fallbackDate}T12:00`).format(DATE_TIME_FORMAT);
}

function normalizePriority(value: unknown): TodoPriority {
  switch (value) {
    case 'high':
    case 'low':
      return value;
    default:
      return 'medium';
  }
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeTrimmedValue(item))
      .filter(Boolean)
      .filter((item, index, list) => list.indexOf(item) === index);
  }

  const text = normalizeTrimmedValue(value);
  if (!text) {
    return [];
  }

  return text
    .split(/[，,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
}

function getStartOfToday() {
  return dayjs().startOf('day');
}

function sortTasks(tasks: TodoTaskRecord[]) {
  return [...tasks].sort((left, right) => {
    const leftTrashed = Boolean(left.trashedAt);
    const rightTrashed = Boolean(right.trashedAt);

    if (leftTrashed !== rightTrashed) {
      return leftTrashed ? 1 : -1;
    }

    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }

    const leftDue = left.dueDate ? dayjs(left.dueDate).valueOf() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueDate ? dayjs(right.dueDate).valueOf() : Number.MAX_SAFE_INTEGER;
    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    const priorityDiff = TODO_PRIORITY_ORDER[left.priority] - TODO_PRIORITY_ORDER[right.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return dayjs(right.updatedAt).valueOf() - dayjs(left.updatedAt).valueOf();
  });
}

function normalizeTask(record: Partial<TodoTaskRecord>, fallbackSortOrder = 0): TodoTaskRecord {
  const createdAt = normalizeTimestamp(record.createdAt);
  const createdDate = dayjs(createdAt).format(DATE_FORMAT);
  const completedAt = normalizeTrimmedValue(record.completedAt);
  const lastCompletedDate = normalizeDate(record.lastCompletedDate, '');
  const normalizedTask: TodoTaskRecord = {
    id: record.id ?? buildId(),
    title: normalizeTrimmedValue(record.title, '未命名任务'),
    descriptionMarkdown: normalizeTrimmedValue(record.descriptionMarkdown),
    dueDate: normalizeDate(record.dueDate, ''),
    priority: normalizePriority(record.priority),
    tags: normalizeTags(record.tags),
    isDaily: Boolean(record.isDaily),
    completed: Boolean(record.completed),
    completedAt: completedAt ? normalizeTimestamp(completedAt, createdDate) : '',
    lastCompletedDate,
    trashedAt: normalizeTrimmedValue(record.trashedAt),
    sortOrder: Number.isFinite(Number(record.sortOrder)) ? Number(record.sortOrder) : fallbackSortOrder,
    createdAt,
    updatedAt: normalizeTimestamp(record.updatedAt, createdDate),
  };

  if (normalizedTask.isDaily && normalizedTask.completed) {
    const today = getStartOfToday();
    const completedDay = normalizedTask.lastCompletedDate
      ? dayjs(normalizedTask.lastCompletedDate).startOf('day')
      : (normalizedTask.completedAt ? dayjs(normalizedTask.completedAt).startOf('day') : null);

    if (!completedDay || completedDay.isBefore(today, 'day')) {
      normalizedTask.completed = false;
      normalizedTask.completedAt = '';
    }
  }

  if (!normalizedTask.completed) {
    normalizedTask.completedAt = '';
  }

  return normalizedTask;
}

function normalizeSettings(settings?: Partial<TodoReminderSettings>): TodoReminderSettings {
  return {
    reminderEnabled: settings?.reminderEnabled ?? true,
    reminderTime: /^\d{2}:\d{2}$/.test(String(settings?.reminderTime ?? '')) ? String(settings?.reminderTime) : '09:00',
    leadDays: Math.max(0, Math.min(30, Math.round(Number(settings?.leadDays ?? 3) || 3))),
    includeDailyTasks: settings?.includeDailyTasks ?? true,
    includeOverdueTasks: settings?.includeOverdueTasks ?? true,
    lastAutoReminderDate: normalizeDate(settings?.lastAutoReminderDate, ''),
  };
}

function parseLegacyRelativeDueDate(value: string) {
  const today = getStartOfToday();
  const normalized = value.trim();

  if (normalized === '今天') {
    return today.format(DATE_FORMAT);
  }

  if (normalized === '明天') {
    return today.add(1, 'day').format(DATE_FORMAT);
  }

  if (normalized === '本周') {
    return today.endOf('week').format(DATE_FORMAT);
  }

  if (normalized === '待安排') {
    return '';
  }

  return normalizeDate(value, '');
}

function createInitialTasks() {
  const now = dayjs().format(DATE_TIME_FORMAT);
  const today = getStartOfToday();

  return sortTasks([
    normalizeTask({
      id: 'todo-task-1',
      title: '准备本周项目复盘',
      descriptionMarkdown: '## 输出要求\n- 汇总本周完成项\n- 标记下周风险与阻塞',
      dueDate: today.format(DATE_FORMAT),
      priority: 'high',
      tags: ['工作', '复盘'],
      isDaily: false,
      completed: false,
      sortOrder: 1,
      createdAt: now,
      updatedAt: now,
    }, 1),
    normalizeTask({
      id: 'todo-task-2',
      title: '整理差旅报销材料',
      descriptionMarkdown: '- 发票\n- 行程单\n- 银行流水',
      dueDate: today.add(1, 'day').format(DATE_FORMAT),
      priority: 'medium',
      tags: ['财务'],
      isDaily: false,
      completed: false,
      sortOrder: 2,
      createdAt: now,
      updatedAt: now,
    }, 2),
    normalizeTask({
      id: 'todo-task-3',
      title: '每日喝水与拉伸',
      descriptionMarkdown: '> 每天晚饭后完成 10 分钟拉伸。',
      dueDate: today.format(DATE_FORMAT),
      priority: 'low',
      tags: ['健康', '习惯'],
      isDaily: true,
      completed: false,
      sortOrder: 3,
      createdAt: now,
      updatedAt: now,
    }, 3),
    normalizeTask({
      id: 'todo-task-4',
      title: '预约年度体检',
      descriptionMarkdown: '联系体检中心确认可预约日期。',
      dueDate: today.subtract(1, 'day').format(DATE_FORMAT),
      priority: 'high',
      tags: ['健康'],
      isDaily: false,
      completed: false,
      sortOrder: 4,
      createdAt: now,
      updatedAt: now,
    }, 4),
    normalizeTask({
      id: 'todo-task-5',
      title: '更新密码管理器',
      descriptionMarkdown: '已完成主设备的条目同步。',
      dueDate: today.subtract(2, 'day').format(DATE_FORMAT),
      priority: 'medium',
      tags: ['生活'],
      isDaily: false,
      completed: true,
      completedAt: now,
      lastCompletedDate: today.format(DATE_FORMAT),
      sortOrder: 5,
      createdAt: now,
      updatedAt: now,
    }, 5),
  ]);
}

export function migrateLegacyTodoState() {
  const legacy = readStorage<LegacyTodoPageState | null>(LEGACY_STORAGE_KEY, null);

  if (!legacy?.tasks?.length) {
    return null;
  }

  const now = dayjs().format(DATE_TIME_FORMAT);

  return {
    tasks: sortTasks(legacy.tasks.map((task, index) => normalizeTask({
      id: task.id,
      title: task.title,
      descriptionMarkdown: '',
      dueDate: parseLegacyRelativeDueDate(task.dueDate),
      priority: 'medium',
      tags: task.category ? [task.category] : [],
      isDaily: false,
      completed: task.completed,
      completedAt: task.completed ? now : '',
      lastCompletedDate: task.completed ? getStartOfToday().format(DATE_FORMAT) : '',
      trashedAt: '',
      sortOrder: index + 1,
      createdAt: now,
      updatedAt: now,
    }, index + 1))),
    settings: normalizeSettings({
      reminderEnabled: legacy.settings?.reminderEnabled,
    }),
  } satisfies TodoPageState;
}

export function buildInitialTodoState(): TodoPageState {
  const migrated = migrateLegacyTodoState();

  if (migrated) {
    return migrated;
  }

  return {
    tasks: createInitialTasks(),
    settings: normalizeSettings(),
  };
}

export function normalizeTodoPageState(state: TodoPageState | null | undefined): TodoPageState {
  const fallback = buildInitialTodoState();

  return {
    tasks: Array.isArray(state?.tasks) && state.tasks.length
      ? sortTasks(state.tasks.map((task, index) => normalizeTask(task, index + 1)))
      : fallback.tasks,
    settings: normalizeSettings(state?.settings),
  };
}

function buildTaskFromDraft(draft: TodoTaskDraft, partial?: Partial<TodoTaskRecord>) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return normalizeTask({
    ...partial,
    title: draft.title,
    descriptionMarkdown: draft.descriptionMarkdown ?? partial?.descriptionMarkdown ?? '',
    dueDate: draft.dueDate ?? partial?.dueDate ?? '',
    priority: draft.priority ?? partial?.priority ?? 'medium',
    tags: draft.tags ?? partial?.tags ?? [],
    isDaily: draft.isDaily ?? partial?.isDaily ?? false,
    updatedAt: now,
    createdAt: partial?.createdAt ?? now,
  }, Number(partial?.sortOrder ?? 0));
}

export function createTodoTask(tasks: TodoTaskRecord[], draft: TodoTaskDraft) {
  const maxSortOrder = tasks.reduce((max, task) => Math.max(max, task.sortOrder), 0);
  const nextTask = buildTaskFromDraft(draft, {
    id: buildId(),
    completed: false,
    completedAt: '',
    lastCompletedDate: '',
    trashedAt: '',
    sortOrder: maxSortOrder + 1,
  });

  return sortTasks([nextTask, ...tasks]);
}

export function updateTodoTask(tasks: TodoTaskRecord[], taskId: string, draft: TodoTaskDraft) {
  return sortTasks(tasks.map((task) => (
    task.id === taskId
      ? buildTaskFromDraft(draft, task)
      : task
  )));
}

export function setTodoTaskCompleted(tasks: TodoTaskRecord[], taskId: string, completed: boolean) {
  const now = dayjs().format(DATE_TIME_FORMAT);
  const today = getStartOfToday().format(DATE_FORMAT);

  return sortTasks(tasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return normalizeTask({
      ...task,
      completed,
      completedAt: completed ? now : '',
      lastCompletedDate: completed ? today : task.lastCompletedDate,
      updatedAt: now,
    }, task.sortOrder);
  }));
}

export function trashTodoTask(tasks: TodoTaskRecord[], taskId: string) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortTasks(tasks.map((task) => (
    task.id === taskId
      ? normalizeTask({ ...task, trashedAt: now, updatedAt: now }, task.sortOrder)
      : task
  )));
}

export function restoreTodoTask(tasks: TodoTaskRecord[], taskId: string) {
  const now = dayjs().format(DATE_TIME_FORMAT);

  return sortTasks(tasks.map((task) => (
    task.id === taskId
      ? normalizeTask({ ...task, trashedAt: '', updatedAt: now }, task.sortOrder)
      : task
  )));
}

export function deleteTodoTaskPermanently(tasks: TodoTaskRecord[], taskId: string) {
  return sortTasks(tasks.filter((task) => task.id !== taskId));
}

export function clearTrashedTodoTasks(tasks: TodoTaskRecord[]) {
  return sortTasks(tasks.filter((task) => !task.trashedAt));
}

export function batchCompleteTodoTasks(tasks: TodoTaskRecord[], taskIds: string[]) {
  return taskIds.reduce((current, taskId) => setTodoTaskCompleted(current, taskId, true), tasks);
}

export function batchTrashTodoTasks(tasks: TodoTaskRecord[], taskIds: string[]) {
  return taskIds.reduce((current, taskId) => trashTodoTask(current, taskId), tasks);
}

export function getTodoTaskStatus(task: TodoTaskRecord) {
  if (task.trashedAt) {
    return 'trashed' as const;
  }

  if (task.completed) {
    return 'completed' as const;
  }

  if (task.dueDate && dayjs(task.dueDate).isBefore(getStartOfToday(), 'day')) {
    return 'overdue' as const;
  }

  return 'active' as const;
}

export function filterTodoTasks(
  tasks: TodoTaskRecord[],
  filter: {
    keyword?: string;
    status?: 'all' | 'active' | 'completed' | 'overdue' | 'daily';
    priority?: 'all' | TodoPriority;
    tag?: string;
    dueStartDate?: string;
    dueEndDate?: string;
    includeTrashed?: boolean;
  },
) {
  const keyword = normalizeTrimmedValue(filter.keyword).toLowerCase();
  const tag = normalizeTrimmedValue(filter.tag);
  const startDate = filter.dueStartDate ? dayjs(filter.dueStartDate) : null;
  const endDate = filter.dueEndDate ? dayjs(filter.dueEndDate) : null;

  return sortTasks(tasks.filter((task) => {
    if (!filter.includeTrashed && task.trashedAt) {
      return false;
    }

    if (filter.includeTrashed && !task.trashedAt) {
      return false;
    }

    if (keyword) {
      const haystack = `${task.title} ${task.descriptionMarkdown} ${task.tags.join(' ')}`.toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    if (filter.status && filter.status !== 'all') {
      if (filter.status === 'daily') {
        if (!task.isDaily) {
          return false;
        }
      } else if (getTodoTaskStatus(task) !== filter.status) {
        return false;
      }
    }

    if (filter.priority && filter.priority !== 'all' && task.priority !== filter.priority) {
      return false;
    }

    if (tag && !task.tags.includes(tag)) {
      return false;
    }

    if (startDate?.isValid()) {
      if (!task.dueDate || dayjs(task.dueDate).isBefore(startDate, 'day')) {
        return false;
      }
    }

    if (endDate?.isValid()) {
      if (!task.dueDate || dayjs(task.dueDate).isAfter(endDate, 'day')) {
        return false;
      }
    }

    return true;
  }));
}

export function buildTodoOverview(tasks: TodoTaskRecord[]): TodoOverviewSummary {
  const today = getStartOfToday();

  return tasks.reduce<TodoOverviewSummary>((summary, task) => {
    if (task.trashedAt) {
      return summary;
    }

    summary.totalCount += 1;

    if (task.completed) {
      summary.completedCount += 1;
    } else {
      summary.activeCount += 1;
    }

    if (task.isDaily) {
      summary.dailyCount += 1;
    }

    if (task.priority === 'high') {
      summary.highPriorityCount += 1;
    } else if (task.priority === 'medium') {
      summary.mediumPriorityCount += 1;
    } else {
      summary.lowPriorityCount += 1;
    }

    if (task.dueDate && dayjs(task.dueDate).isSame(today, 'day')) {
      summary.dueTodayCount += 1;
    }

    return summary;
  }, {
    totalCount: 0,
    activeCount: 0,
    completedCount: 0,
    dailyCount: 0,
    highPriorityCount: 0,
    mediumPriorityCount: 0,
    lowPriorityCount: 0,
    dueTodayCount: 0,
  });
}

export function buildTodoReminderPayload(tasks: TodoTaskRecord[], settings: TodoReminderSettings): TodoReminderPayload {
  const today = getStartOfToday();
  const scopedTasks = tasks.filter((task) => {
    if (task.trashedAt || task.completed) {
      return false;
    }

    if (!settings.includeDailyTasks && task.isDaily) {
      return false;
    }

    if (!settings.includeOverdueTasks && task.dueDate && dayjs(task.dueDate).isBefore(today, 'day')) {
      return false;
    }

    return true;
  });

  const overdueCount = scopedTasks.filter((task) => task.dueDate && dayjs(task.dueDate).isBefore(today, 'day')).length;
  const dueTodayCount = scopedTasks.filter((task) => task.dueDate && dayjs(task.dueDate).isSame(today, 'day')).length;
  const leadWindowCount = scopedTasks.filter((task) => {
    if (!task.dueDate) {
      return false;
    }

    const diff = dayjs(task.dueDate).startOf('day').diff(today, 'day');
    return diff > 0 && diff <= settings.leadDays;
  }).length;

  const topTasks = [...scopedTasks]
    .sort((left, right) => {
      const leftDue = left.dueDate ? dayjs(left.dueDate).valueOf() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueDate ? dayjs(right.dueDate).valueOf() : Number.MAX_SAFE_INTEGER;
      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }

      return TODO_PRIORITY_ORDER[left.priority] - TODO_PRIORITY_ORDER[right.priority];
    })
    .slice(0, 5);

  const taskPreview = topTasks.length
    ? topTasks.map((task) => `- ${task.title}${task.dueDate ? `（${task.dueDate}）` : ''}`).join('\n')
    : '- 当前没有符合提醒条件的待办任务。';

  return {
    date: today.format(DATE_FORMAT),
    taskCount: scopedTasks.length,
    overdueCount,
    dueTodayCount,
    leadWindowCount,
    message: [
      `今天共有 ${scopedTasks.length} 项待办需要关注。`,
      overdueCount ? `其中逾期 ${overdueCount} 项。` : '当前没有逾期待办。',
      dueTodayCount ? `今天到期 ${dueTodayCount} 项。` : '今天没有到期待办。',
      leadWindowCount
        ? `未来 ${settings.leadDays} 天内还有 ${leadWindowCount} 项临近截止任务。`
        : `未来 ${settings.leadDays} 天内暂无临近截止任务。`,
      '',
      '优先关注：',
      taskPreview,
    ].join('\n'),
  };
}

export function buildDueTodoReminder(tasks: TodoTaskRecord[], settings: TodoReminderSettings) {
  if (!settings.reminderEnabled) {
    return null;
  }

  const now = dayjs();
  const today = now.format(DATE_FORMAT);

  if (settings.lastAutoReminderDate === today) {
    return null;
  }

  const [hour, minute] = settings.reminderTime.split(':').map((value) => Number(value));
  if (Number.isFinite(hour) && Number.isFinite(minute)) {
    const scheduled = now.startOf('day').hour(hour).minute(minute);
    if (now.isBefore(scheduled)) {
      return null;
    }
  }

  const payload = buildTodoReminderPayload(tasks, settings);
  if (payload.taskCount === 0) {
    return null;
  }

  if (
    !settings.includeOverdueTasks
    && payload.overdueCount === payload.taskCount
    && payload.dueTodayCount === 0
    && payload.leadWindowCount === 0
  ) {
    return null;
  }

  return payload;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

export function renderTodoMarkdownPreview(markdown: string) {
  const source = normalizeTrimmedValue(markdown);

  if (!source) {
    return '<p>暂无描述内容。</p>';
  }

  const lines = escapeHtml(source).split(/\r?\n/);
  const blocks: string[] = [];
  let inCode = false;
  let codeBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) {
      return;
    }

    blocks.push(`<ul>${listBuffer.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
    listBuffer = [];
  };

  const flushCode = () => {
    blocks.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
    codeBuffer = [];
  };

  lines.forEach((line) => {
    if (line.trim().startsWith('```')) {
      flushList();
      if (inCode) {
        flushCode();
      }
      inCode = !inCode;
      return;
    }

    if (inCode) {
      codeBuffer.push(line);
      return;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      listBuffer.push(line.replace(/^\s*[-*]\s+/, ''));
      return;
    }

    flushList();

    if (!line.trim()) {
      return;
    }

    if (/^###\s+/.test(line)) {
      blocks.push(`<h3>${renderInlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`);
      return;
    }

    if (/^##\s+/.test(line)) {
      blocks.push(`<h2>${renderInlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`);
      return;
    }

    if (/^#\s+/.test(line)) {
      blocks.push(`<h1>${renderInlineMarkdown(line.replace(/^#\s+/, ''))}</h1>`);
      return;
    }

    if (/^>\s?/.test(line)) {
      blocks.push(`<blockquote>${renderInlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`);
      return;
    }

    blocks.push(`<p>${renderInlineMarkdown(line)}</p>`);
  });

  flushList();

  if (inCode) {
    flushCode();
  }

  return blocks.join('');
}

export function getTodoPriorityLabel(priority: TodoPriority) {
  return TODO_PRIORITY_LABELS[priority];
}

export function getTodoStatusLabel(task: TodoTaskRecord) {
  const status = getTodoTaskStatus(task);

  switch (status) {
    case 'completed':
      return '已完成';
    case 'overdue':
      return '已逾期';
    case 'trashed':
      return '回收站';
    case 'active':
    default:
      return task.isDaily ? '每日待办' : '进行中';
  }
}
