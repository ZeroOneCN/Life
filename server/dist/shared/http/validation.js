"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
const zod_1 = require("zod");
const app_error_1 = require("../errors/app-error");
function validateBody(schema, body) {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        throw new app_error_1.AppError('invalid_request', 400, 400, parsed.error.flatten());
    }
    return parsed.data;
}
function validateQuery(shape, query) {
    const parsed = zod_1.z.object(shape).safeParse(query);
    if (!parsed.success) {
        throw new app_error_1.AppError('invalid_query', 400, 400, parsed.error.flatten());
    }
    return parsed.data;
}
