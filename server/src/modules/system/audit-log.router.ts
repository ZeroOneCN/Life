import { Router } from 'express';
import { FindOptionsWhere, Like } from 'typeorm';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import { requireJwtAuth, type AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { buildListData, successResponse } from '../../shared/http/response';
import { SystemAuditLogEntity } from './entities/system-audit-log.entity';

/**
 * 审计日志查询路由。
 * 提供操作日志的分页查询、筛选和详情查看接口。
 */
export function createAuditLogRouter() {
  const router = Router();

  /**
   * GET /audit-logs
   * 分页查询操作日志。
   * @queryParam page - 页码，默认 1
   * @queryParam page_size - 每页条数，默认 20
   * @queryParam action - 操作类型筛选（CREATE / UPDATE / DELETE / LOGIN / LOGOUT）
   * @queryParam entity_type - 实体类型筛选
   * @queryParam keyword - 关键词搜索（匹配描述和用户名）
   * @queryParam start_date - 开始日期（YYYY-MM-DD）
   * @queryParam end_date - 结束日期（YYYY-MM-DD）
   * @returns 分页日志列表
   */
  router.get('/', requireJwtAuth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = request.auth?.userId;
    if (!userId) {
      response.status(401).json({ code: 401, message: 'unauthorized', data: null });
      return;
    }

    const page = Math.max(1, parseInt(String(request.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(request.query.page_size ?? '20'), 10) || 20));
    const action = String(request.query.action ?? '').trim();
    const entityType = String(request.query.entity_type ?? '').trim();
    const keyword = String(request.query.keyword ?? '').trim();
    const startDate = String(request.query.start_date ?? '').trim();
    const endDate = String(request.query.end_date ?? '').trim();

    const repo = appDataSource.getRepository(SystemAuditLogEntity);
    const where: FindOptionsWhere<SystemAuditLogEntity> = {};

    // 当前用户只能查看自己的操作日志
    where.user_id = userId;

    if (action) {
      where.action = action;
    }
    if (entityType) {
      where.entity_type = entityType;
    }

    const queryBuilder = repo.createQueryBuilder('log')
      .where('log.user_id = :userId', { userId });

    if (action) {
      queryBuilder.andWhere('log.action = :action', { action });
    }
    if (entityType) {
      queryBuilder.andWhere('log.entity_type = :entityType', { entityType });
    }
    if (keyword) {
      queryBuilder.andWhere('(log.description LIKE :keyword OR log.username LIKE :keyword)', { keyword: `%${keyword}%` });
    }
    if (startDate) {
      queryBuilder.andWhere('log.created_at >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('log.created_at <= :endDate', { endDate: `${endDate} 23:59:59` });
    }

    const [items, total] = await queryBuilder
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    response.json(successResponse(buildListData(items, page, pageSize, total)));
  }));

  /**
   * GET /audit-logs/actions
   * 获取所有操作类型列表（用于前端筛选下拉框）。
   * @returns 操作类型枚举值列表
   */
  router.get('/actions', requireJwtAuth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = request.auth?.userId;
    if (!userId) {
      response.status(401).json({ code: 401, message: 'unauthorized', data: null });
      return;
    }

    const repo = appDataSource.getRepository(SystemAuditLogEntity);
    const result = await repo.createQueryBuilder('log')
      .select('DISTINCT log.action', 'action')
      .where('log.user_id = :userId', { userId })
      .orderBy('log.action', 'ASC')
      .getRawMany();

    response.json(successResponse(result.map((r: { action: string }) => r.action)));
  }));

  /**
   * GET /audit-logs/entity-types
   * 获取所有实体类型列表（用于前端筛选下拉框）。
   * @returns 实体类型枚举值列表
   */
  router.get('/entity-types', requireJwtAuth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = request.auth?.userId;
    if (!userId) {
      response.status(401).json({ code: 401, message: 'unauthorized', data: null });
      return;
    }

    const repo = appDataSource.getRepository(SystemAuditLogEntity);
    const result = await repo.createQueryBuilder('log')
      .select('DISTINCT log.entity_type', 'entity_type')
      .where('log.user_id = :userId', { userId })
      .orderBy('log.entity_type', 'ASC')
      .getRawMany();

    response.json(successResponse(result.map((r: { entity_type: string }) => r.entity_type)));
  }));

  /**
   * GET /audit-logs/:id
   * 获取单条日志详情。
   * @param id - 日志 ID
   * @returns 日志详情
   */
  router.get('/:id', requireJwtAuth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = request.auth?.userId;
    if (!userId) {
      response.status(401).json({ code: 401, message: 'unauthorized', data: null });
      return;
    }

    const repo = appDataSource.getRepository(SystemAuditLogEntity);
    const log = await repo.findOne({
      where: { id: String(request.params.id), user_id: userId },
    });

    if (!log) {
      response.status(404).json({ code: 404, message: 'not_found', data: null });
      return;
    }

    response.json(successResponse(log));
  }));

  return router;
}