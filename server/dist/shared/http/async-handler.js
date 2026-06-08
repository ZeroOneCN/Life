"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
const env_1 = require("../../config/env");
function asyncHandler(handler) {
    return (request, response, next) => {
        Promise.resolve(handler(request, response, next)).catch((error) => {
            if (env_1.env.NODE_ENV === 'development') {
                console.error('[asyncHandler] Unhandled error:', error);
            }
            next(error);
        });
    };
}
