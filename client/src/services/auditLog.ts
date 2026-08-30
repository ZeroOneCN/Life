import { apiGet } from '../lib/api';
import type { PaginatedResponse } from '../types/api';

/** 审计日志条目 */
export interface AuditLogEntry {
  id: string;
  user_id: string;
  username: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string;
  detail_json: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/** 审计日志查询参数 */
export interface AuditLogQueryParams {
  page?: number;
  page_size?: number;
  action?: string;
  entity_type?: string;
  keyword?: string;
  start_date?: string;
  end_date?: string;
}

/**
 * 分页查询审计日志。
 * @param params - 查询参数
 * @returns 分页日志列表
 */
export async function getAuditLogs(params: AuditLogQueryParams = {}) {
  return apiGet<PaginatedResponse<AuditLogEntry>>('/audit-logs', undefined, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    action: params.action || undefined,
    entity_type: params.entity_type || undefined,
    keyword: params.keyword || undefined,
    start_date: params.start_date || undefined,
    end_date: params.end_date || undefined,
  });
}

/**
 * 获取所有操作类型列表。
 * @returns 操作类型数组
 */
export async function getAuditLogActions() {
  return apiGet<string[]>('/audit-logs/actions');
}

/**
 * 获取所有实体类型列表。
 * @returns 实体类型数组
 */
export async function getAuditLogEntityTypes() {
  return apiGet<string[]>('/audit-logs/entity-types');
}

/**
 * 获取单条审计日志详情。
 * @param id - 日志 ID
 * @returns 日志详情
 */
export async function getAuditLogDetail(id: string) {
  return apiGet<AuditLogEntry>(`/audit-logs/${id}`);
}

/** 操作类型中文映射 */
export const actionLabels: Record<string, string> = {
  CREATE: '创建',
  UPDATE: '修改',
  DELETE: '删除',
  LOGIN: '登录',
  LOGOUT: '登出',
  EXPORT: '导出',
};

/** 操作类型颜色映射 */
export const actionColors: Record<string, 'green' | 'blue' | 'red' | 'default' | 'orange'> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  LOGIN: 'default',
  LOGOUT: 'orange',
  EXPORT: 'blue',
};