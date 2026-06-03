"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockJwtAuth = mockJwtAuth;
exports.requireJwtAuth = requireJwtAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
const app_error_1 = require("../errors/app-error");
function mockJwtAuth(request, _response, next) {
    const header = request.header('x-user-id') || request.header('authorization');
    const userId = header?.replace(/^Bearer\s+/i, '').trim() || 'user-001';
    request.auth = {
        userId,
    };
    next();
}
function requireJwtAuth(request, _response, next) {
    const authorization = request.header('authorization');
    if (!authorization) {
        next(new app_error_1.AppError('unauthorized', 401, 401));
        return;
    }
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
        next(new app_error_1.AppError('unauthorized', 401, 401));
        return;
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        if (!payload?.sub) {
            next(new app_error_1.AppError('unauthorized', 401, 401));
            return;
        }
        request.auth = {
            userId: payload.sub,
            username: payload.username,
        };
        next();
    }
    catch {
        next(new app_error_1.AppError('unauthorized', 401, 401));
    }
}
