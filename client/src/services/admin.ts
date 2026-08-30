import { apiGet, apiPatch, buildApiErrorMessage } from '../lib/api';
import type { PaginatedResponse } from '../types/api';

/** 用户管理条目 */
export interface AdminUserEntry {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'readonly';
  is_active: boolean;
  nickname: string;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

/** 用户查询参数 */
export interface AdminUserQueryParams {
  page?: number;
  page_size?: number;
  keyword?: string;
  role?: string;
}

/**
 * 获取用户列表（admin 权限）。
 * @param params - 查询参数
 * @returns 分页用户列表
 */
export async function getAdminUsers(params: AdminUserQueryParams = {}) {
  return apiGet<PaginatedResponse<AdminUserEntry>>('/admin/users', undefined, {
    page: params.page ?? 1,
    page_size: params.page_size ?? 20,
    keyword: params.keyword || undefined,
    role: params.role || undefined,
  });
}

/**
 * 更新用户角色（admin 权限）。
 * @param userId - 用户 ID
 * @param role - 新角色
 */
export async function updateUserRole(userId: string, role: string) {
  return apiPatch<{ id: string; role: string }, { role: string }>(`/admin/users/${userId}/role`, { role });
}

/**
 * 启用/停用用户（admin 权限）。
 * @param userId - 用户 ID
 */
export async function toggleUserActive(userId: string) {
  return apiPatch<{ id: string; is_active: boolean }>(`/admin/users/${userId}/toggle-active`);
}

/** 角色显示文本映射 */
export const roleLabels: Record<string, string> = {
  admin: '管理员',
  user: '普通用户',
  readonly: '只读用户',
};

/** 角色颜色映射 */
export const roleColors: Record<string, 'red' | 'blue' | 'default' | 'orange'> = {
  admin: 'red',
  user: 'blue',
  readonly: 'default',
};