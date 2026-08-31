import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth-middleware';
import { logAudit } from '../../modules/system/audit-log.service';

/**
 * 从请求路径推断实体类型。
 * 如 /finance/rent/xxx → rent, /health/fitness/xxx → fitness
 */
function inferEntityType(path: string): string {
  const parts = path.replace(/^\/api\//, '').split('/');
  // 取前两段作为实体类型，如 finance/rent、health/fitness
  const type = parts.slice(0, 2).join('_') || parts[0] || 'unknown';
  return type;
}

/**
 * 审计日志中间件 — 自动记录所有非 GET 请求的操作。
 * 拦截 res.json，在响应成功时写入审计日志。
 *
 * @param entityType - 可选，显式指定实体类型；未指定时从路径推断
 * @returns Express 中间件
 */
export function auditLogMiddleware(entityType?: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return next();
    }

    const action = (
      req.method === 'POST' ? 'CREATE' :
      req.method === 'DELETE' ? 'DELETE' :
      'UPDATE'
    ) as 'CREATE' | 'UPDATE' | 'DELETE';

    const type = entityType ?? inferEntityType(req.path);

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // 只在响应成功（状态码 < 400 且 code === 0）时记录
      if (res.statusCode < 400 && body && typeof body === 'object' && 'code' in (body as Record<string, unknown>) && (body as Record<string, unknown>).code === 0) {
        const data = (body as Record<string, unknown>).data as Record<string, unknown> | undefined;
        const entityId = data?.id != null ? String(data.id) : null;
        void logAudit({
          userId: req.auth!.userId!,
          username: req.auth!.username ?? 'unknown',
          action,
          entityType: type,
          entityId,
          description: `${action} ${type}`,
          ipAddress: req.ip ?? null,
          userAgent: req.header('user-agent') ?? null,
        });
      }
      return originalJson(body);
    };
    next();
  };
}