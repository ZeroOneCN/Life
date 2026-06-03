import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type { NotificationLogEntry } from '../types/notifications';
import type { TodoOverviewSummary, TodoReminderSettings, TodoTaskDraft, TodoTaskRecord } from '../types/todo';

export interface TodoListParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: 'all' | 'active' | 'completed' | 'overdue' | 'daily';
  priority?: 'all' | 'high' | 'medium' | 'low';
  tag?: string;
  dueStartDate?: string;
  dueEndDate?: string;
  trashed?: boolean;
}

function normalizeLogEntry(raw: {
  id: string;
  created_at: string;
  channel: NotificationLogEntry['channel'];
  scene_id: NotificationLogEntry['sceneId'];
  kind: NotificationLogEntry['kind'];
  status: NotificationLogEntry['status'];
  title: string;
  message: string;
}): NotificationLogEntry {
  return {
    id: raw.id,
    createdAt: raw.created_at,
    channel: raw.channel,
    sceneId: raw.scene_id,
    kind: raw.kind,
    status: raw.status,
    title: raw.title,
    message: raw.message,
  };
}

export const todoApi = {
  list(params: TodoListParams) {
    return apiGet<PaginatedResponse<TodoTaskRecord>>('/life/todo/tasks', undefined, params as Record<string, unknown>);
  },

  create(body: TodoTaskDraft) {
    return apiPost<TodoTaskRecord, TodoTaskDraft>('/life/todo/tasks', body);
  },

  update(taskId: string, body: Partial<TodoTaskDraft> & { completed?: boolean }) {
    return apiPatch<TodoTaskRecord, Partial<TodoTaskDraft> & { completed?: boolean }>(`/life/todo/tasks/${taskId}`, body);
  },

  toggleCompleted(taskId: string, completed: boolean) {
    return apiPost<TodoTaskRecord, { completed: boolean }>(`/life/todo/tasks/${taskId}/toggle-completed`, { completed });
  },

  trash(taskId: string) {
    return apiDelete<{ ok: true }>(`/life/todo/tasks/${taskId}`);
  },

  deletePermanently(taskId: string) {
    return apiDelete<{ ok: true }>(`/life/todo/tasks/${taskId}`, undefined, { mode: 'permanent' });
  },

  getOverview() {
    return apiGet<TodoOverviewSummary>('/life/todo/overview');
  },

  getSettings() {
    return apiGet<TodoReminderSettings>('/life/todo/settings');
  },

  updateSettings(body: Partial<TodoReminderSettings>) {
    return apiPatch<TodoReminderSettings, Partial<TodoReminderSettings>>('/life/todo/settings', body);
  },

  batchComplete(taskIds: string[]) {
    return apiPost<{ ok: true }, { taskIds: string[] }>('/life/todo/actions/batch-complete', { taskIds });
  },

  batchTrash(taskIds: string[]) {
    return apiPost<{ ok: true }, { taskIds: string[] }>('/life/todo/actions/batch-trash', { taskIds });
  },

  restore(taskId: string) {
    return apiPost<{ ok: true }, { taskId: string }>('/life/todo/actions/restore', { taskId });
  },

  clearTrash() {
    return apiPost<{ ok: true }>('/life/todo/actions/clear-trash');
  },

  triggerReminder(title?: string) {
    return apiPost('/life/todo/actions/trigger-reminder', title ? { title } : {});
  },

  async getLogs(page = 1, pageSize = 8) {
    const result = await apiGet<PaginatedResponse<{
      id: string;
      created_at: string;
      channel: NotificationLogEntry['channel'];
      scene_id: NotificationLogEntry['sceneId'];
      kind: NotificationLogEntry['kind'];
      status: NotificationLogEntry['status'];
      title: string;
      message: string;
    }>>('/life/todo/logs', undefined, { page, page_size: pageSize });

    return {
      ...result,
      items: result.items.map(normalizeLogEntry),
    };
  },
};
