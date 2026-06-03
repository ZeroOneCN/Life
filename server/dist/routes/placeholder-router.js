"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlaceholderRouter = createPlaceholderRouter;
const express_1 = require("express");
const response_1 = require("../shared/http/response");
const resource_registry_1 = require("./resource-registry");
function buildMockPayload(path, method) {
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
            || path.endsWith('/notification-snapshot')) {
            return {
                resource: path,
                mode: 'summary',
                implemented: false,
            };
        }
        return (0, response_1.buildListData)([], 1, 20, 0);
    }
    return {
        resource: path,
        method,
        implemented: false,
    };
}
const implementedPrefixes = [
    '/dashboard',
    '/notifications',
    '/health/step',
    '/health/fitness',
    '/health/checkup',
    '/health/medication',
    '/finance/shopping',
    '/finance/travel',
    '/life/todo',
    '/life/storage',
    '/life/card',
    '/finance/subscription',
    '/finance/loan',
    '/finance/rent',
    '/investment/forex',
];
function createPlaceholderRouter() {
    const router = (0, express_1.Router)();
    resource_registry_1.resourceRouteDefinitions
        .filter((definition) => !implementedPrefixes.some((prefix) => definition.path.startsWith(prefix)))
        .forEach((definition) => {
        router[definition.method](definition.path, (request, response) => {
            response.json((0, response_1.successResponse)(buildMockPayload(request.route.path, request.method.toLowerCase()), definition.summary));
        });
    });
    return router;
}
