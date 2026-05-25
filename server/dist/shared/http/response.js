"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.successResponse = successResponse;
exports.buildListData = buildListData;
function successResponse(data, message = 'ok') {
    return {
        code: 0,
        message,
        data,
    };
}
function buildListData(items, page = 1, pageSize = items.length || 10, total = items.length) {
    return {
        items,
        page,
        page_size: pageSize,
        total,
    };
}
