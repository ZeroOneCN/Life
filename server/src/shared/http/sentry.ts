/**
 * Sentry 服务端错误监控配置。
 * 启用方式：在 .env 中设置 SENTRY_DSN
 */
import { init, setupExpressErrorHandler } from '@sentry/node';
import type { Express } from 'express';

import { env } from '../../config/env';

export function initSentry(app: Express) {
  if (!env.SENTRY_DSN) return;

  init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.2,
  });

  // Sentry Express 错误处理
  setupExpressErrorHandler(app);
}