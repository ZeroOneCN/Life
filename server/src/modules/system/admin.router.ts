import { Router } from 'express';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import { requireJwtAuth, type AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { buildListData, successResponse } from '../../shared/http/response';
import { SystemUserAccountEntity } from './entities/system-user-account.entity';
import { SystemUserProfileEntity } from './entities/system-user-profile.entity';
import { logCrudAudit } from './audit-log.service';

/**
 * 系统管理路由（用户管理、角色管理等）。
 * 仅 admin 角色可访问，用于 B 端用户管理。
 */
export function createAdminRouter() {
  const router = Router();

  /**
   * 检查当前用户是否为 admin。
   */
  async function requireAdmin(request: AuthenticatedRequest): Promise<boolean> {
    const userId = request.auth?.userId;
    if (!userId) return false;

    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const account = await accountRepo.findOneBy({ id: userId });
    return account?.role === 'admin';
  }

  /**
   * GET /admin/users
   * 获取用户列表（仅 admin）。
   * @queryParam page - 页码，默认 1
   * @queryParam page_size - 每页条数，默认 20
   * @queryParam keyword - 关键词搜索
   * @queryParam role - 角色筛选
   * @returns 用户列表
   */
  router.get('/users', requireJwtAuth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    const isAdmin = await requireAdmin(request);
    if (!isAdmin) {
      response.status(403).json({ code: 403, message: 'forbidden', data: null });
      return;
    }

    const page = Math.max(1, parseInt(String(request.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(request.query.page_size ?? '20'), 10) || 20));
    const keyword = String(request.query.keyword ?? '').trim();
    const role = String(request.query.role ?? '').trim();

    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const profileRepo = appDataSource.getRepository(SystemUserProfileEntity);

    const queryBuilder = accountRepo.createQueryBuilder('account');

    if (keyword) {
      queryBuilder.andWhere(
        '(account.username LIKE :keyword OR account.email LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }
    if (role) {
      queryBuilder.andWhere('account.role = :role', { role });
    }

    const [accounts, total] = await queryBuilder
      .orderBy('account.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // 批量获取用户 profile
    const userIds = accounts.map((a) => a.id);
    const profiles = userIds.length > 0
      ? await profileRepo.find({ where: userIds.map((id) => ({ user_id: id })) })
      : [];
    const profileMap = new Map(profiles.map((p) => [p.user_id, p]));

    const items = accounts.map((account) => {
      const profile = profileMap.get(account.id);
      return {
        id: account.id,
        username: account.username,
        email: account.email,
        role: account.role,
        is_active: Boolean(account.is_active),
        nickname: profile?.nickname ?? account.username,
        timezone: profile?.timezone ?? null,
        created_at: account.created_at,
        updated_at: account.updated_at,
      };
    });

    response.json(successResponse(buildListData(items, page, pageSize, total)));
  }));

  /**
   * PATCH /admin/users/:id/role
   * 更新用户角色（仅 admin）。
   * @param id - 用户 ID
   * @bodyParam role - 新角色：admin / user / readonly
   */
  router.patch('/users/:id/role', requireJwtAuth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    const isAdmin = await requireAdmin(request);
    if (!isAdmin) {
      response.status(403).json({ code: 403, message: 'forbidden', data: null });
      return;
    }

    const targetId = String(request.params.id);
    const { role } = request.body as { role?: string };

    if (!role || !['admin', 'user', 'readonly'].includes(role)) {
      response.status(400).json({ code: 400, message: 'invalid_role', data: null });
      return;
    }

    // 不允许修改自己的角色（避免误操作）
    if (targetId === request.auth?.userId) {
      response.status(400).json({ code: 400, message: 'cannot_modify_own_role', data: null });
      return;
    }

    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const account = await accountRepo.findOneBy({ id: targetId });

    if (!account) {
      response.status(404).json({ code: 404, message: 'user_not_found', data: null });
      return;
    }

    const oldRole = account.role;
    await accountRepo.update({ id: targetId }, { role });

    void logCrudAudit(request, 'UPDATE', 'admin_user_role', targetId, `修改用户 ${account.username} 角色：${oldRole} → ${role}`, {
      oldRole,
      newRole: role,
      username: account.username,
    });

    response.json(successResponse({ id: targetId, role }, 'role_updated'));
  }));

  /**
   * PATCH /admin/users/:id/toggle-active
   * 启用/停用用户（仅 admin）。
   * @param id - 用户 ID
   */
  router.patch('/users/:id/toggle-active', requireJwtAuth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    const isAdmin = await requireAdmin(request);
    if (!isAdmin) {
      response.status(403).json({ code: 403, message: 'forbidden', data: null });
      return;
    }

    const targetId = String(request.params.id);

    // 不允许停用自己
    if (targetId === request.auth?.userId) {
      response.status(400).json({ code: 400, message: 'cannot_modify_own_status', data: null });
      return;
    }

    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const account = await accountRepo.findOneBy({ id: targetId });

    if (!account) {
      response.status(404).json({ code: 404, message: 'user_not_found', data: null });
      return;
    }

    const newActive = !account.is_active;
    await accountRepo.update({ id: targetId }, { is_active: newActive });

    void logCrudAudit(request, 'UPDATE', 'admin_user_active', targetId, `${newActive ? '启用' : '停用'}用户 ${account.username}`, {
      username: account.username,
      isActive: newActive,
    });

    response.json(successResponse({ id: targetId, is_active: newActive }, 'status_updated'));
  }));

  return router;
}