import { Router } from 'express';

import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { generateBindCode, getBindingStatus } from './services/bind.service';

/**
 * 创建 Telegram 模块的 Web API 路由
 * 提供绑定码生成和绑定状态查询接口
 */
export function createTelegramRouter() {
  const router = Router();

  // POST /api/telegram/bind-code — 生成新绑定码
  router.post('/bind-code', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const code = await generateBindCode(userId);
    response.json(successResponse({ code }, 'bind_code_generated'));
  }));

  // GET /api/telegram/status — 查看当前绑定状态
  router.get('/status', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const status = await getBindingStatus(userId);
    response.json(successResponse(status));
  }));

  return router;
}
