import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type { PaginatedResponse } from '../types/api';
import type { NotificationLogEntry } from '../types/notifications';
import type {
  ScheduleCalendarParams,
  ScheduleCalendarResponse,
  ScheduleEventDraft,
  ScheduleEventRecord,
  ScheduleFromTodoPayload,
  ScheduleListParams,
  ScheduleOverviewSummary,
  ScheduleSettings,
} from '../types/schedule';

/**
 * 将后端日志字段（snake_case）转为前端 NotificationLogEntry（驼峰）。
 * @param raw 原始日志对象
 * @returns 转换后的日志条目
 */
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

/**
 * 日程模块 API 客户端：封装 /life/schedule 路由所有端点。
 */
export const scheduleApi = {
  /**
   * 获取事件列表（分页）。
   * @param params 查询参数
   */
  list(params: ScheduleListParams) {
    return apiGet<PaginatedResponse<ScheduleEventRecord>>(
      '/life/schedule/events',
      undefined,
      params as Record<string, unknown>,
    );
  },

  /**
   * 获取日历视图数据（展开重复事件）。
   * @param params 时间范围
   */
  getCalendar(params: ScheduleCalendarParams) {
    return apiGet<ScheduleCalendarResponse>('/life/schedule/events/calendar', undefined, params as unknown as Record<string, unknown>);
  },

  /**
   * 创建事件。
   * @param body 事件草稿
   */
  create(body: ScheduleEventDraft) {
    return apiPost<ScheduleEventRecord, ScheduleEventDraft>('/life/schedule/events', body);
  },

  /**
   * 更新事件。
   * @param eventId 事件 ID
   * @param body    部分字段
   */
  update(eventId: string, body: Partial<ScheduleEventDraft> & { completed?: boolean }) {
    return apiPatch<ScheduleEventRecord, Partial<ScheduleEventDraft> & { completed?: boolean }>(
      `/life/schedule/events/${eventId}`,
      body,
    );
  },

  /**
   * 切换完成状态。
   * @param eventId 事件 ID
   * @param completed 是否已完成
   */
  toggleCompleted(eventId: string, completed: boolean) {
    return apiPost<ScheduleEventRecord, { completed: boolean }>(
      `/life/schedule/events/${eventId}/toggle-completed`,
      { completed },
    );
  },

  /**
   * 删除事件（软删除到回收站）。
   * @param eventId 事件 ID
   */
  trash(eventId: string) {
    return apiDelete<{ ok: true }>(`/life/schedule/events/${eventId}`);
  },

  /**
   * 永久删除事件。
   * @param eventId 事件 ID
   */
  deletePermanently(eventId: string) {
    return apiDelete<{ ok: true }>(`/life/schedule/events/${eventId}`, undefined, { mode: 'permanent' });
  },

  /**
   * 从待办转换创建日程。
   * @param payload 待办 ID + 开始时间 + 持续时间
   */
  fromTodo(payload: ScheduleFromTodoPayload) {
    return apiPost<ScheduleEventRecord, ScheduleFromTodoPayload>('/life/schedule/actions/from-todo', payload);
  },

  /**
   * 获取概览统计。
   */
  getOverview() {
    return apiGet<ScheduleOverviewSummary>('/life/schedule/overview');
  },

  /**
   * 获取设置。
   */
  getSettings() {
    return apiGet<ScheduleSettings>('/life/schedule/settings');
  },

  /**
   * 更新设置。
   * @param body 部分设置字段
   */
  updateSettings(body: Partial<ScheduleSettings>) {
    return apiPatch<ScheduleSettings, Partial<ScheduleSettings>>('/life/schedule/settings', body);
  },

  /**
   * 批量删除。
   * @param eventIds 事件 ID 列表
   */
  batchTrash(eventIds: string[]) {
    return apiPost<{ ok: true }, { eventIds: string[] }>('/life/schedule/actions/batch-trash', { eventIds });
  },

  /**
   * 恢复事件。
   * @param eventId 事件 ID
   */
  restore(eventId: string) {
    return apiPost<{ ok: true }, { eventId: string }>('/life/schedule/actions/restore', { eventId });
  },

  /**
   * 清空回收站。
   */
  clearTrash() {
    return apiPost<{ ok: true }>('/life/schedule/actions/clear-trash');
  },

  /**
   * 手动触发提醒。
   * @param title 自定义标题
   */
  triggerReminder(title?: string) {
    return apiPost('/life/schedule/actions/trigger-reminder', title ? { title } : {});
  },

  /**
   * 获取提醒日志。
   * @param page 页码
   * @param pageSize 每页条数
   */
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
    }>>('/life/schedule/logs', undefined, { page, page_size: pageSize });

    return {
      ...result,
      items: result.items.map(normalizeLogEntry),
    };
  },
};
