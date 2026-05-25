import { Router } from 'express';

import { createAuthRouter } from '../modules/system/auth.router';
import { createNotificationCenterRouter } from '../modules/notifications/notification-center.router';
import { createDashboardRouter } from '../modules/system/dashboard.router';
import { createTodoRouter } from '../modules/life/todo.router';
import { createStorageRouter } from '../modules/life/storage.router';
import { createCardRouter } from '../modules/life/card.router';
import { createSubscriptionRouter } from '../modules/finance/subscription.router';
import { createLoanRouter } from '../modules/finance/loan.router';
import { createRentRouter } from '../modules/finance/rent.router';
import { createShoppingRouter } from '../modules/finance/shopping.router';
import { createTravelRouter } from '../modules/finance/travel.router';
import { createStepRouter } from '../modules/health/step.router';
import { createFitnessRouter } from '../modules/health/fitness.router';
import { createMedicationRouter } from '../modules/health/medication.router';
import { createCheckupRouter } from '../modules/health/checkup.router';
import { createForexRouter } from '../modules/investment/forex.router';
import { requireJwtAuth } from '../shared/http/auth-middleware';

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
  router.use('/finance/rent', createRentRouter());
  router.use('/finance/shopping', createShoppingRouter());
  router.use('/finance/travel', createTravelRouter());
  router.use('/health/step', createStepRouter());
  router.use('/health/fitness', createFitnessRouter());
  router.use('/health/medication', createMedicationRouter());
  router.use('/health/checkup', createCheckupRouter());
  router.use('/investment/forex', createForexRouter());

  return router;
}
