"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
const app_error_1 = require("../errors/app-error");
function notFoundHandler(_request, response) {
    response.status(404).json({
        code: 404,
        message: 'not_found',
        data: null,
    });
}
function errorHandler(error, _request, response, _next) {
    if (error instanceof app_error_1.AppError) {
        response.status(error.statusCode).json({
            code: error.code,
            message: error.message,
            data: error.details ?? null,
        });
        return;
    }
    const message = error instanceof Error ? error.message : 'internal_server_error';
    response.status(500).json({
        code: 500,
        message,
        data: null,
    });
}
