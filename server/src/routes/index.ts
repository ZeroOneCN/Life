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
import { createAnalysisRouter } from '../modules/system/analysis.router';
import { createAssistantRouter } from '../modules/system/assistant.router';
import { createFinanceReportRouter } from '../modules/finance/finance-report.router';
import { createExchangeRateRouter } from '../modules/finance/exchange-rate.router';
import { requireJwtAuth } from '../shared/http/auth-middleware';
import { asyncHandler } from '../shared/http/async-handler';
import { successResponse } from '../shared/http/response';
import { getSystemHealthSnapshot } from '../modules/system/system-health';

export function createApiRouter() {
  const router = Router();

  router.use('/auth', createAuthRouter());
  router.get('/system/health', asyncHandler(async (_request, response) => {
    response.json(successResponse(await getSystemHealthSnapshot()));
  }));

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
  router.use('/analysis', createAnalysisRouter());
  router.use('/assistant', createAssistantRouter());
  router.use('/finance/report', createFinanceReportRouter());
  router.use('/finance/exchange-rate', createExchangeRateRouter());

  return router;
}
