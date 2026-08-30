import type { Request } from 'express';

import { appDataSource } from '../../db/data-source';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { SystemAuditLogEntity } from './entities/system-audit-log.entity';

/**
 * 审计日志记录选项。
 */
export interface AuditLogOptions {
  /** 操作用户 ID（从 request.auth 获取） */
  userId: string;
  /** 操作用户名 */
  username: string;
  /** 操作类型：CREATE / UPDATE / DELETE / LOGIN / LOGOUT / EXPORT */
  action: string;
  /** 操作实体类型（模块/表名） */
  entityType: string;
  /** 操作实体 ID */
  entityId?: string | null;
  /** 操作描述（人类可读） */
  description: string;
  /** 操作详情 JSON */
  detailJson?: Record<string, unknown> | null;
  /** 请求 IP 地址 */
  ipAddress?: string | null;
  /** 请求 User-Agent */
  userAgent?: string | null;
}

/**
 * 记录一条审计日志。
 * @param options - 审计日志记录选项
 */
export async function logAudit(options: AuditLogOptions): Promise<void> {
  const repo = appDataSource.getRepository(SystemAuditLogEntity);
  await repo.save(repo.create({
    user_id: options.userId,
    username: options.username,
    action: options.action,
    entity_type: options.entityType,
    entity_id: options.entityId ?? null,
    description: options.description,
    detail_json: options.detailJson ?? null,
    ip_address: options.ipAddress ?? null,
    user_agent: options.userAgent ?? null,
  }));
}

/**
 * 从 Express Request 中提取 IP 和 User-Agent。
 * @param request - Express Request 对象
 * @returns 包含 ip_address 和 user_agent 的对象
 */
function extractRequestMeta(request: Request) {
  return {
    ipAddress: (request.ip ?? request.socket?.remoteAddress ?? null)?.slice(0, 64) ?? null,
    userAgent: (request.header('user-agent') ?? null)?.slice(0, 512) ?? null,
  };
}

/**
 * 记录登录审计日志。
 * @param request - 认证后的请求对象
 * @param description - 日志描述
 */
export async function logLoginAudit(request: AuthenticatedRequest, description = '登录系统') {
  const userId = request.auth?.userId;
  const username = request.auth?.username ?? 'unknown';
  if (!userId) return;

  await logAudit({
    userId,
    username,
    action: 'LOGIN',
    entityType: 'auth_login',
    description,
    ...extractRequestMeta(request),
  });
}

/**
 * 记录登出审计日志。
 * @param request - 认证后的请求对象
 * @param description - 日志描述
 */
export async function logLogoutAudit(request: AuthenticatedRequest, description = '登出系统') {
  const userId = request.auth?.userId;
  const username = request.auth?.username ?? 'unknown';
  if (!userId) return;

  await logAudit({
    userId,
    username,
    action: 'LOGOUT',
    entityType: 'auth_logout',
    description,
    ...extractRequestMeta(request),
  });
}

/**
 * 记录 CRUD 操作审计日志。
 * @param request - 认证后的请求对象
 * @param action - 操作类型：CREATE / UPDATE / DELETE
 * @param entityType - 实体类型
 * @param entityId - 实体 ID
 * @param description - 操作描述
 * @param detailJson - 操作详情 JSON
 */
export async function logCrudAudit(
  request: AuthenticatedRequest,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entityType: string,
  entityId: string | null,
  description: string,
  detailJson?: Record<string, unknown> | null,
) {
  const userId = request.auth?.userId;
  const username = request.auth?.username ?? 'unknown';
  if (!userId) return;

  await logAudit({
    userId,
    username,
    action,
    entityType,
    entityId,
    description,
    detailJson,
    ...extractRequestMeta(request),
  });
}