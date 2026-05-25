import { Router } from 'express';

import { createAuthRouter } from '../modules/system/auth.router';
import { createNotificationCenterRouter } from '../modules/notifications/notification-center.router';
import { createDashboardRouter } from '../modules/system/dashboard.router';
import { createTodoRouter } from '../modules/life/todo.router';
import { createStorageRouter } from '../modules/life/storage.router';
import { createCardRouter } from '../modules/life/card.router';
import { createSubscriptionRouter } from '../modules/finance/subscription.router';
import { createLoanRouter } from '../modules/finance/loan.router';
import { requireJwtAuth } from '../shared/http/auth-middleware';
import { createPlaceholderRouter } from './placeholder-router';

export function createApiRouter() {
  const router = Router();

  router.use('/auth', createAuthRouter());
  router.get('/system/health', (_request, response) => {
    response.json({
      code: 0,
      message: 'ok',
      data: {
        status: 'ok',
      },
    });
  });

  router.use(requireJwtAuth);

  router.use('/notifications', createNotificationCenterRouter());
  router.use('/dashboard', createDashboardRouter());
  router.use('/life/todo', createTodoRouter());
  router.use('/life/storage', createStorageRouter());
  router.use('/life/card', createCardRouter());
  router.use('/finance/subscription', createSubscriptionRouter());
  router.use('/finance/loan', createLoanRouter());

  router.use(createPlaceholderRouter());

  return router;
}
