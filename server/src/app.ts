import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { errorHandler, notFoundHandler } from './shared/http/error-handler';
import { initSentry } from './shared/http/sentry';
import { setupSwagger } from './shared/http/swagger';
import { createApiRouter } from './routes';
import { appDataSource } from './db/data-source';
import { SystemUserAccountEntity } from './modules/system/entities/system-user-account.entity';

/**
 * 启动时自动检查：如果没有任何 admin 用户，将第一个注册的用户提升为 admin。
 * 确保首次使用时可正常进入用户管理页面。
 */
async function provisionAdminIfNeeded() {
  try {
    const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
    const adminCount = await accountRepo.count({ where: { role: 'admin' } });
    if (adminCount === 0) {
      const firstUser = await accountRepo.findOne({ where: {}, order: { created_at: 'ASC' } });
      if (firstUser) {
        await accountRepo.update({ id: firstUser.id }, { role: 'admin' });
        console.log(`[provision] 已将首个用户 ${firstUser.username} 提升为管理员 (role=admin)`);
      }
    }
  } catch (error) {
    // 数据库未就绪时静默跳过（后续启动会自动重试）
    console.warn('[provision] 管理员检查跳过（数据库可能未就绪）:', (error as Error).message);
  }
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true }));

  initSentry(app);

  app.get('/healthz', (_request, response) => {
    response.json({
      code: 0,
      message: 'ok',
      data: {
        status: 'ok',
      },
    });
  });

  app.use('/api', createApiRouter());

  setupSwagger(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  // 启动后延迟执行管理员检查（等待数据库连接就绪）
  setTimeout(() => {
    void provisionAdminIfNeeded();
  }, 3000);

  return app;
}
