"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createForexRouter = createForexRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const dayjs_1 = __importDefault(require("dayjs"));
const data_source_1 = require("../../db/data-source");
const async_handler_1 = require("../../shared/http/async-handler");
const request_1 = require("../../shared/http/request");
const response_1 = require("../../shared/http/response");
const validation_1 = require("../../shared/http/validation");
const pagination_1 = require("../../shared/utils/pagination");
const date_1 = require("../../shared/utils/date");
const base_user_setting_service_1 = require("../../shared/db/base-user-setting.service");
const app_error_1 = require("../../shared/errors/app-error");
const investment_forex_capital_flow_entity_1 = require("./entities/investment-forex-capital-flow.entity");
const investment_forex_import_batch_entity_1 = require("./entities/investment-forex-import-batch.entity");
const investment_forex_setting_entity_1 = require("./entities/investment-forex-setting.entity");
const investment_forex_trade_record_entity_1 = require("./entities/investment-forex-trade-record.entity");
const tradeSchema = zod_1.z.object({
    tradeDate: zod_1.z.string().min(1),
    instrument: zod_1.z.enum(['XAUUSD', 'XAGUSD']),
    orderType: zod_1.z.enum(['buy', 'sell']),
    openPrice: zod_1.z.number().positive(),
    lotSize: zod_1.z.number().positive(),
    commission: zod_1.z.number().optional(),
    closePrice: zod_1.z.number().positive(),
    pnl: zod_1.z.number().optional(),
    openTime: zod_1.z.string().trim().min(1),
    closeTime: zod_1.z.string().trim().min(1),
    holdTime: zod_1.z.string().optional().default(''),
    remark: zod_1.z.string().optional().default(''),
});
const capitalFlowSchema = zod_1.z.object({
    flowDate: zod_1.z.string().min(1),
    flowType: zod_1.z.enum(['deposit', 'withdrawal']),
    amount: zod_1.z.number().min(0),
    remark: zod_1.z.string().optional().default(''),
});
const settingsSchema = zod_1.z.object({
    leverage: zod_1.z.number().min(1).optional(),
    forcedLiquidationRatio: zod_1.z.number().min(0.1).max(1).optional(),
    dashboardStartDate: zod_1.z.string().optional(),
    dashboardEndDate: zod_1.z.string().optional(),
});
const calculatorSchema = zod_1.z.object({
    leverage: zod_1.z.number().min(1),
    balance: zod_1.z.number().min(0),
    forcedLiquidationRatio: zod_1.z.number().min(0.1).max(1),
    positions: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        instrument: zod_1.z.enum(['XAUUSD', 'XAGUSD']),
        orderType: zod_1.z.enum(['buy', 'sell']),
        openPrice: zod_1.z.number().positive(),
        lotSize: zod_1.z.number().positive(),
        closePrice: zod_1.z.number().positive().optional(),
    })).default([]),
});
const importTradeSchema = zod_1.z.object({
    tradeDate: zod_1.z.string().optional(),
    instrument: zod_1.z.string().optional(),
    orderType: zod_1.z.string().optional(),
    openPrice: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    lotSize: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    commission: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    closePrice: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    pnl: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    openTime: zod_1.z.string().optional(),
    closeTime: zod_1.z.string().optional(),
    holdTime: zod_1.z.string().optional(),
    remark: zod_1.z.string().optional(),
});
const importSchema = zod_1.z.object({
    fileName: zod_1.z.string().trim().optional().default('forex-import.json'),
    rows: zod_1.z.array(importTradeSchema).default([]),
});
const settingService = new base_user_setting_service_1.BaseUserSettingService(investment_forex_setting_entity_1.InvestmentForexSettingEntity);
const CONTRACT_UNITS = {
    XAUUSD: 100,
    XAGUSD: 5000,
};
const POINT_SIZES = {
    XAUUSD: 0.01,
    XAGUSD: 0.001,
};
function normalizeTime(value, fallback = '09:00') {
    const raw = String(value ?? '').trim();
    const matched = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!matched) {
        return fallback;
    }
    const hours = String(Number(matched[1])).padStart(2, '0');
    const minutes = matched[2];
    const seconds = matched[3];
    return seconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
}
function toMoney(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}
function calculateCommission(lotSize) {
    return Number((-6 * lotSize).toFixed(2));
}
function calculatePnl(instrument, orderType, openPrice, closePrice, lotSize) {
    const diff = orderType === 'buy' ? closePrice - openPrice : openPrice - closePrice;
    return Number((diff * lotSize * CONTRACT_UNITS[instrument]).toFixed(2));
}
function calculateHoldTime(openTime, closeTime) {
    const start = (0, dayjs_1.default)(`2020-01-01T${normalizeTime(openTime, '09:00')}`);
    let end = (0, dayjs_1.default)(`2020-01-01T${normalizeTime(closeTime, '10:00')}`);
    if (end.isBefore(start)) {
        end = end.add(1, 'day');
    }
    const diff = end.diff(start, 'second');
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    const parts = [
        hours > 0 ? `${hours}小时` : '',
        minutes > 0 ? `${minutes}分钟` : '',
        seconds > 0 && hours === 0 ? `${seconds}秒` : '',
    ].filter(Boolean);
    return parts.join(' ') || '0分钟';
}
function mapTrade(entity) {
    return {
        id: entity.id,
        tradeDate: (0, dayjs_1.default)(entity.trade_date).format('YYYY-MM-DD'),
        instrument: entity.instrument,
        orderType: entity.order_type,
        openPrice: Number(entity.open_price),
        lotSize: Number(entity.lot_size),
        commission: Number(entity.commission),
        closePrice: Number(entity.close_price),
        pnl: Number(entity.pnl),
        openTime: entity.open_time,
        closeTime: entity.close_time,
        holdTime: entity.hold_time,
        remark: entity.remark,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function mapCapitalFlow(entity) {
    return {
        id: entity.id,
        flowDate: (0, dayjs_1.default)(entity.flow_date).format('YYYY-MM-DD'),
        flowType: entity.flow_type,
        amount: Number(entity.amount),
        remark: entity.remark,
        createdAt: entity.created_at.toISOString(),
        updatedAt: entity.updated_at.toISOString(),
    };
}
function filterByRange(items, startDate, endDate) {
    return items.filter((item) => {
        const date = item.trade_date ?? item.flow_date ?? '';
        if (!date) {
            return false;
        }
        const parsed = (0, dayjs_1.default)(date);
        if (!parsed.isValid() || parsed.year() < 2000 || parsed.year() > 2100) {
            return false;
        }
        return (!startDate || !parsed.isBefore(startDate, 'day')) && (!endDate || !parsed.isAfter(endDate, 'day'));
    });
}
function buildSummary(trades, capitalFlows, startDate, endDate) {
    const scopedTrades = filterByRange(trades, startDate, endDate);
    const scopedFlows = filterByRange(capitalFlows, startDate, endDate);
    const winners = scopedTrades.filter((item) => Number(item.pnl) > 0);
    const losers = scopedTrades.filter((item) => Number(item.pnl) < 0);
    const grossPnl = scopedTrades.reduce((sum, item) => sum + Number(item.pnl), 0);
    const totalCommission = scopedTrades.reduce((sum, item) => sum + Number(item.commission), 0);
    const realizedNetPnl = grossPnl + totalCommission;
    const deposits = scopedFlows.filter((item) => item.flow_type === 'deposit').reduce((sum, item) => sum + Number(item.amount), 0);
    const withdrawals = scopedFlows.filter((item) => item.flow_type === 'withdrawal').reduce((sum, item) => sum + Number(item.amount), 0);
    const netCapital = deposits - withdrawals;
    return {
        tradeCount: scopedTrades.length,
        grossPnl: Number(grossPnl.toFixed(2)),
        totalCommission: Number(totalCommission.toFixed(2)),
        realizedNetPnl: Number(realizedNetPnl.toFixed(2)),
        winRate: scopedTrades.length ? winners.length / scopedTrades.length : 0,
        profitLossRatio: losers.length ? winners.reduce((sum, item) => sum + Number(item.pnl), 0) / Math.abs(losers.reduce((sum, item) => sum + Number(item.pnl), 0)) : winners.length ? winners.reduce((sum, item) => sum + Number(item.pnl), 0) : 0,
        longCount: scopedTrades.filter((item) => item.order_type === 'buy').length,
        shortCount: scopedTrades.filter((item) => item.order_type === 'sell').length,
        xauCount: scopedTrades.filter((item) => item.instrument === 'XAUUSD').length,
        xagCount: scopedTrades.filter((item) => item.instrument === 'XAGUSD').length,
        totalDeposit: Number(deposits.toFixed(2)),
        totalWithdrawal: Number(withdrawals.toFixed(2)),
        netCapital: Number(netCapital.toFixed(2)),
        equity: Number((netCapital + realizedNetPnl).toFixed(2)),
        roi: netCapital > 0 ? realizedNetPnl / netCapital : 0,
    };
}
function createForexRouter() {
    const router = (0, express_1.Router)();
    router.get('/trades', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity);
        const [items, total] = await repository.findAndCount({
            where: { user_id: userId },
            order: { trade_date: 'DESC', updated_at: 'DESC' },
            skip,
            take: pageSize,
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapTrade), page, pageSize, total)));
    }));
    router.post('/trades', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(tradeSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity);
        const item = await repository.save(repository.create({
            user_id: userId,
            trade_date: (0, date_1.normalizeDate)(payload.tradeDate),
            instrument: payload.instrument,
            order_type: payload.orderType,
            open_price: payload.openPrice,
            lot_size: payload.lotSize,
            commission: payload.commission ?? calculateCommission(payload.lotSize),
            close_price: payload.closePrice,
            pnl: payload.pnl ?? calculatePnl(payload.instrument, payload.orderType, payload.openPrice, payload.closePrice, payload.lotSize),
            open_time: normalizeTime(payload.openTime, '09:00'),
            close_time: normalizeTime(payload.closeTime, '10:00'),
            hold_time: payload.holdTime || calculateHoldTime(payload.openTime, payload.closeTime),
            remark: payload.remark,
        }));
        response.json((0, response_1.successResponse)(mapTrade(item), 'create_forex_trade_success'));
    }));
    router.patch('/trades/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const tradeId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(tradeSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity);
        const current = await repository.findOne({
            where: { id: tradeId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('forex_trade_not_found', 404, 404);
        }
        const nextInstrument = payload.instrument ?? current.instrument;
        const nextOrderType = payload.orderType ?? current.order_type;
        const nextOpenPrice = payload.openPrice ?? Number(current.open_price);
        const nextClosePrice = payload.closePrice ?? Number(current.close_price);
        const nextLotSize = payload.lotSize ?? Number(current.lot_size);
        const nextOpenTime = payload.openTime ? normalizeTime(payload.openTime, '09:00') : current.open_time;
        const nextCloseTime = payload.closeTime ? normalizeTime(payload.closeTime, '10:00') : current.close_time;
        const item = await repository.save({
            ...current,
            trade_date: payload.tradeDate ? (0, date_1.normalizeDate)(payload.tradeDate) : current.trade_date,
            instrument: nextInstrument,
            order_type: nextOrderType,
            open_price: nextOpenPrice,
            lot_size: nextLotSize,
            commission: payload.commission ?? calculateCommission(nextLotSize),
            close_price: nextClosePrice,
            pnl: payload.pnl ?? calculatePnl(nextInstrument, nextOrderType, nextOpenPrice, nextClosePrice, nextLotSize),
            open_time: nextOpenTime,
            close_time: nextCloseTime,
            hold_time: payload.holdTime ?? calculateHoldTime(nextOpenTime, nextCloseTime),
            remark: payload.remark ?? current.remark,
        });
        response.json((0, response_1.successResponse)(mapTrade(item), 'update_forex_trade_success'));
    }));
    router.delete('/trades/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const tradeId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity);
        const current = await repository.findOne({
            where: { id: tradeId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('forex_trade_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_forex_trade_success'));
    }));
    router.get('/capital-flows', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const { page, pageSize, skip } = (0, pagination_1.parsePagination)(request.query);
        const repository = data_source_1.appDataSource.getRepository(investment_forex_capital_flow_entity_1.InvestmentForexCapitalFlowEntity);
        const [items, total] = await repository.findAndCount({
            where: { user_id: userId },
            order: { flow_date: 'DESC', updated_at: 'DESC' },
            skip,
            take: pageSize,
        });
        response.json((0, response_1.successResponse)((0, response_1.buildListData)(items.map(mapCapitalFlow), page, pageSize, total)));
    }));
    router.post('/capital-flows', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(capitalFlowSchema, request.body);
        const repository = data_source_1.appDataSource.getRepository(investment_forex_capital_flow_entity_1.InvestmentForexCapitalFlowEntity);
        const item = await repository.save(repository.create({
            user_id: userId,
            flow_date: (0, date_1.normalizeDate)(payload.flowDate),
            flow_type: payload.flowType,
            amount: payload.amount,
            remark: payload.remark,
        }));
        response.json((0, response_1.successResponse)(mapCapitalFlow(item), 'create_forex_capital_flow_success'));
    }));
    router.patch('/capital-flows/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const flowId = String(request.params.id ?? '');
        const payload = (0, validation_1.validateBody)(capitalFlowSchema.partial(), request.body);
        const repository = data_source_1.appDataSource.getRepository(investment_forex_capital_flow_entity_1.InvestmentForexCapitalFlowEntity);
        const current = await repository.findOne({
            where: { id: flowId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('forex_capital_flow_not_found', 404, 404);
        }
        const item = await repository.save({
            ...current,
            flow_date: payload.flowDate ? (0, date_1.normalizeDate)(payload.flowDate) : current.flow_date,
            flow_type: payload.flowType ?? current.flow_type,
            amount: payload.amount ?? current.amount,
            remark: payload.remark ?? current.remark,
        });
        response.json((0, response_1.successResponse)(mapCapitalFlow(item), 'update_forex_capital_flow_success'));
    }));
    router.delete('/capital-flows/:id', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const flowId = String(request.params.id ?? '');
        const repository = data_source_1.appDataSource.getRepository(investment_forex_capital_flow_entity_1.InvestmentForexCapitalFlowEntity);
        const current = await repository.findOne({
            where: { id: flowId, user_id: userId },
        });
        if (!current) {
            throw new app_error_1.AppError('forex_capital_flow_not_found', 404, 404);
        }
        await repository.remove(current);
        response.json((0, response_1.successResponse)({ ok: true }, 'delete_forex_capital_flow_success'));
    }));
    router.get('/dashboard-summary', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            leverage: 100,
            forced_liquidation_ratio: 0.5,
            dashboard_start_date: null,
            dashboard_end_date: null,
        });
        const [trades, capitalFlows] = await Promise.all([
            data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(investment_forex_capital_flow_entity_1.InvestmentForexCapitalFlowEntity).find({ where: { user_id: userId } }),
        ]);
        response.json((0, response_1.successResponse)(buildSummary(trades, capitalFlows, settings.dashboard_start_date ?? undefined, settings.dashboard_end_date ?? undefined)));
    }));
    router.get('/daily-pnl-trend', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity);
        const items = await repository.find({ where: { user_id: userId } });
        const grouped = new Map();
        items.forEach((item) => {
            const current = grouped.get(item.trade_date) ?? { grossPnl: 0, commission: 0, tradeCount: 0 };
            current.grossPnl += Number(item.pnl);
            current.commission += Number(item.commission);
            current.tradeCount += 1;
            grouped.set(item.trade_date, current);
        });
        const result = Array.from(grouped.entries())
            .map(([date, value]) => ({
            date,
            grossPnl: Number(value.grossPnl.toFixed(2)),
            commission: Number(value.commission.toFixed(2)),
            netPnl: Number((value.grossPnl + value.commission).toFixed(2)),
            tradeCount: value.tradeCount,
        }))
            .sort((left, right) => (0, dayjs_1.default)(left.date).valueOf() - (0, dayjs_1.default)(right.date).valueOf());
        response.json((0, response_1.successResponse)(result));
    }));
    router.get('/instrument-summary', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const repository = data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity);
        const items = await repository.find({ where: { user_id: userId } });
        const result = ['XAUUSD', 'XAGUSD'].map((instrument) => {
            const scoped = items.filter((item) => item.instrument === instrument);
            const winners = scoped.filter((item) => Number(item.pnl) > 0).length;
            const grossPnl = scoped.reduce((sum, item) => sum + Number(item.pnl), 0);
            const totalCommission = scoped.reduce((sum, item) => sum + Number(item.commission), 0);
            return {
                instrument,
                tradeCount: scoped.length,
                grossPnl: Number(grossPnl.toFixed(2)),
                totalCommission: Number(totalCommission.toFixed(2)),
                netPnl: Number((grossPnl + totalCommission).toFixed(2)),
                avgLotSize: scoped.length ? Number((scoped.reduce((sum, item) => sum + Number(item.lot_size), 0) / scoped.length).toFixed(2)) : 0,
                winRate: scoped.length ? winners / scoped.length : 0,
                longCount: scoped.filter((item) => item.order_type === 'buy').length,
                shortCount: scoped.filter((item) => item.order_type === 'sell').length,
            };
        });
        response.json((0, response_1.successResponse)(result));
    }));
    router.get('/insights', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const [trades, capitalFlows] = await Promise.all([
            data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity).find({ where: { user_id: userId } }),
            data_source_1.appDataSource.getRepository(investment_forex_capital_flow_entity_1.InvestmentForexCapitalFlowEntity).find({ where: { user_id: userId } }),
        ]);
        const summary = buildSummary(trades, capitalFlows);
        const insights = [];
        if (!trades.length) {
            insights.push({
                id: 'empty',
                tone: 'neutral',
                title: '当前还没有交易样本',
                description: '先录入几笔 XAUUSD 或 XAGUSD 交易，这里就会开始输出胜率、盈亏比和手续费分析。',
            });
            response.json((0, response_1.successResponse)(insights));
            return;
        }
        if (summary.tradeCount >= 5 && summary.winRate < 0.4) {
            insights.push({
                id: 'low-win-rate',
                tone: 'warning',
                title: '胜率偏低',
                description: '当前区间的有效胜率还没有站上 40%，建议回看入场条件是否过宽。',
                metric: `${(summary.winRate * 100).toFixed(1)}%`,
            });
        }
        if (summary.tradeCount >= 5 && summary.profitLossRatio > 0 && summary.profitLossRatio < 1) {
            insights.push({
                id: 'weak-profit-loss',
                tone: 'warning',
                title: '盈亏比偏弱',
                description: '平均盈利还不足以覆盖平均亏损，说明止盈空间或止损纪律仍需优化。',
                metric: summary.profitLossRatio.toFixed(2),
            });
        }
        if (Math.abs(summary.totalCommission) > Math.max(Math.abs(summary.grossPnl) * 0.2, 10)) {
            insights.push({
                id: 'commission',
                tone: 'warning',
                title: '手续费侵蚀明显',
                description: '手续费已经占到较高比例，频繁短打的收益正在被成本吞掉。',
                metric: summary.totalCommission.toFixed(2),
            });
        }
        if (!insights.length) {
            insights.push({
                id: 'balanced',
                tone: summary.realizedNetPnl >= 0 ? 'positive' : 'neutral',
                title: summary.realizedNetPnl >= 0 ? '当前交易结构相对稳定' : '当前交易结构较为均衡',
                description: '当前没有出现特别突出的结构性风险信号，可以继续围绕高质量 setup 复盘。',
                metric: summary.realizedNetPnl.toFixed(2),
            });
        }
        response.json((0, response_1.successResponse)(insights));
    }));
    router.get('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const settings = await settingService.getOrCreate(userId, {
            leverage: 100,
            forced_liquidation_ratio: 0.5,
            dashboard_start_date: null,
            dashboard_end_date: null,
        });
        response.json((0, response_1.successResponse)({
            leverage: Number(settings.leverage),
            forcedLiquidationRatio: Number(settings.forced_liquidation_ratio),
            dashboardStartDate: settings.dashboard_start_date ? (0, dayjs_1.default)(settings.dashboard_start_date).format('YYYY-MM-DD') : '',
            dashboardEndDate: settings.dashboard_end_date ? (0, dayjs_1.default)(settings.dashboard_end_date).format('YYYY-MM-DD') : '',
        }));
    }));
    router.patch('/settings', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(settingsSchema, request.body);
        const settings = await settingService.update(userId, {
            leverage: payload.leverage,
            forced_liquidation_ratio: payload.forcedLiquidationRatio,
            dashboard_start_date: payload.dashboardStartDate ? (0, date_1.normalizeDate)(payload.dashboardStartDate) : undefined,
            dashboard_end_date: payload.dashboardEndDate ? (0, date_1.normalizeDate)(payload.dashboardEndDate) : undefined,
        }, {
            leverage: 100,
            forced_liquidation_ratio: 0.5,
            dashboard_start_date: null,
            dashboard_end_date: null,
        });
        response.json((0, response_1.successResponse)({
            leverage: Number(settings.leverage),
            forcedLiquidationRatio: Number(settings.forced_liquidation_ratio),
            dashboardStartDate: settings.dashboard_start_date ? (0, dayjs_1.default)(settings.dashboard_start_date).format('YYYY-MM-DD') : '',
            dashboardEndDate: settings.dashboard_end_date ? (0, dayjs_1.default)(settings.dashboard_end_date).format('YYYY-MM-DD') : '',
        }, 'update_forex_settings_success'));
    }));
    router.post('/calculator', (0, async_handler_1.asyncHandler)(async (request, response) => {
        (0, validation_1.validateBody)(zod_1.z.object({}), {});
        const payload = (0, validation_1.validateBody)(calculatorSchema, request.body);
        const positionsInput = payload.positions ?? [];
        const positions = positionsInput.map((position) => {
            const contractValue = Number((position.openPrice * position.lotSize * CONTRACT_UNITS[position.instrument]).toFixed(2));
            const margin = Number((contractValue / payload.leverage).toFixed(2));
            const pointValue = Number((position.lotSize * CONTRACT_UNITS[position.instrument] * POINT_SIZES[position.instrument]).toFixed(2));
            const pnl = position.closePrice
                ? calculatePnl(position.instrument, position.orderType, position.openPrice, position.closePrice, position.lotSize)
                : null;
            const allowedLoss = Math.max(payload.balance - (margin * payload.forcedLiquidationRatio), 0);
            const priceMove = allowedLoss / (position.lotSize * CONTRACT_UNITS[position.instrument]);
            const forcedLiquidationPrice = Number((position.orderType === 'buy'
                ? Math.max(0, position.openPrice - priceMove)
                : position.openPrice + priceMove).toFixed(2));
            return {
                id: position.id,
                instrument: position.instrument,
                orderType: position.orderType,
                contractValue,
                margin,
                pointValue,
                pnl,
                forcedLiquidationPrice,
            };
        });
        const totalContractValue = positions.reduce((sum, item) => sum + item.contractValue, 0);
        const totalMargin = positions.reduce((sum, item) => sum + item.margin, 0);
        const totalPnl = positions.reduce((sum, item) => sum + (item.pnl ?? 0), 0);
        response.json((0, response_1.successResponse)({
            positions,
            accountSummary: {
                balance: payload.balance,
                leverage: payload.leverage,
                forcedLiquidationRatio: payload.forcedLiquidationRatio,
                totalContractValue: Number(totalContractValue.toFixed(2)),
                totalMargin: Number(totalMargin.toFixed(2)),
                totalPnl: Number(totalPnl.toFixed(2)),
                equityIfClosed: Number((payload.balance + totalPnl).toFixed(2)),
                marginUsageRatio: payload.balance > 0 ? totalMargin / payload.balance : 0,
                remainingAvailableMargin: Number((payload.balance - totalMargin).toFixed(2)),
            },
        }));
    }));
    router.post('/actions/import', (0, async_handler_1.asyncHandler)(async (request, response) => {
        const userId = (0, request_1.requireAuthUser)(request);
        const payload = (0, validation_1.validateBody)(importSchema, request.body);
        const rows = payload.rows ?? [];
        const repository = data_source_1.appDataSource.getRepository(investment_forex_trade_record_entity_1.InvestmentForexTradeRecordEntity);
        const batchRepo = data_source_1.appDataSource.getRepository(investment_forex_import_batch_entity_1.InvestmentForexImportBatchEntity);
        const existing = await repository.find({ where: { user_id: userId } });
        const seen = new Set(existing.map((item) => [
            item.trade_date,
            item.instrument,
            item.order_type,
            Number(item.open_price).toFixed(2),
            Number(item.lot_size).toFixed(2),
            Number(item.close_price).toFixed(2),
            item.open_time,
            item.close_time,
        ].join('|')));
        let importedCount = 0;
        let duplicateCount = 0;
        let invalidCount = 0;
        const toSave = [];
        rows.forEach((row) => {
            const instrument = row.instrument === 'XAGUSD' ? 'XAGUSD' : row.instrument === 'XAUUSD' ? 'XAUUSD' : null;
            const orderType = row.orderType === 'sell' ? 'sell' : row.orderType === 'buy' ? 'buy' : null;
            const tradeDate = row.tradeDate ? (0, date_1.normalizeDate)(row.tradeDate) : '';
            const openPrice = Number(row.openPrice);
            const closePrice = Number(row.closePrice);
            const lotSize = Number(row.lotSize);
            const openTime = normalizeTime(row.openTime, '');
            const closeTime = normalizeTime(row.closeTime, '');
            if (!instrument || !orderType || !tradeDate || !openTime || !closeTime || !Number.isFinite(openPrice) || !Number.isFinite(closePrice) || !Number.isFinite(lotSize) || openPrice <= 0 || closePrice <= 0 || lotSize <= 0) {
                invalidCount += 1;
                return;
            }
            const key = [
                tradeDate,
                instrument,
                orderType,
                openPrice.toFixed(2),
                lotSize.toFixed(2),
                closePrice.toFixed(2),
                openTime,
                closeTime,
            ].join('|');
            if (seen.has(key)) {
                duplicateCount += 1;
                return;
            }
            seen.add(key);
            importedCount += 1;
            toSave.push(repository.create({
                user_id: userId,
                trade_date: tradeDate,
                instrument,
                order_type: orderType,
                open_price: openPrice,
                lot_size: lotSize,
                commission: Number.isFinite(Number(row.commission)) ? Number(Number(row.commission).toFixed(2)) : calculateCommission(lotSize),
                close_price: closePrice,
                pnl: Number.isFinite(Number(row.pnl)) ? Number(Number(row.pnl).toFixed(2)) : calculatePnl(instrument, orderType, openPrice, closePrice, lotSize),
                open_time: openTime,
                close_time: closeTime,
                hold_time: row.holdTime?.trim() || calculateHoldTime(openTime, closeTime),
                remark: row.remark ?? '',
            }));
        });
        if (toSave.length) {
            await repository.save(toSave);
        }
        await batchRepo.save(batchRepo.create({
            user_id: userId,
            file_name: payload.fileName,
            total_rows: rows.length,
            imported_count: importedCount,
            duplicate_count: duplicateCount,
            invalid_count: invalidCount,
            summary_json: {
                importedCount,
                duplicateCount,
                invalidCount,
            },
        }));
        response.json((0, response_1.successResponse)({
            total_rows: rows.length,
            imported_count: importedCount,
            duplicate_count: duplicateCount,
            invalid_count: invalidCount,
        }, 'import_forex_trades_success'));
    }));
    router.get('/actions/download-template', (0, async_handler_1.asyncHandler)(async (_request, response) => {
        response.json((0, response_1.successResponse)({
            fileName: 'forex-import-template.json',
            headers: ['tradeDate', 'instrument', 'orderType', 'openPrice', 'lotSize', 'commission', 'closePrice', 'pnl', 'openTime', 'closeTime', 'holdTime', 'remark'],
            sample: {
                tradeDate: (0, dayjs_1.default)().format('YYYY-MM-DD'),
                instrument: 'XAUUSD',
                orderType: 'buy',
                openPrice: 2340.5,
                lotSize: 0.1,
                commission: -0.6,
                closePrice: 2346.2,
                pnl: 57,
                openTime: '09:35',
                closeTime: '11:10',
                holdTime: '1小时 35分钟',
                remark: '示例数据',
            },
        }));
    }));
    return router;
}
