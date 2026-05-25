import { Router } from 'express';

import { buildListData, successResponse } from '../shared/http/response';
import { resourceRouteDefinitions } from './resource-registry';

function buildMockPayload(path: string, method: string) {
  if (method === 'get' && !path.includes('/actions/')) {
    if (path.endsWith('/summary')
      || path.endsWith('/overview')
      || path.endsWith('/trend')
      || path.endsWith('/breakdown')
      || path.endsWith('/agenda')
      || path.endsWith('/snapshot')
      || path.endsWith('/leaderboard')
      || path.endsWith('/report')
      || path.endsWith('/analysis')
      || path.endsWith('/stock')
      || path.endsWith('/insights')
      || path.endsWith('/month-compare')
      || path.endsWith('/monthly-stats')
      || path.endsWith('/reminders')
      || path.endsWith('/ranking')
      || path.endsWith('/logs')
      || path.endsWith('/dashboard-summary')
      || path.endsWith('/daily-pnl-trend')
      || path.endsWith('/instrument-summary')
      || path.endsWith('/notification-snapshot')
    ) {
      return {
        resource: path,
        mode: 'summary',
        implemented: false,
      };
    }

    return buildListData([], 1, 20, 0);
  }

  return {
    resource: path,
    method,
    implemented: false,
  };
}

export function createApiRouter() {
  const router = Router();

  resourceRouteDefinitions.forEach((definition) => {
    router[definition.method](definition.path, (request, response) => {
      response.json(successResponse(buildMockPayload(request.route.path, request.method.toLowerCase()), definition.summary));
    });
  });

  return router;
}
