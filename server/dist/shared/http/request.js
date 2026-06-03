"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthUser = requireAuthUser;
const app_error_1 = require("../errors/app-error");
function requireAuthUser(request) {
    if (!request.auth?.userId) {
        throw new app_error_1.AppError('unauthorized', 401, 401);
    }
    return request.auth.userId;
}
