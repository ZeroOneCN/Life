import { Router } from 'express';
import { z } from 'zod';
import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { asyncHandler } from '../../shared/http/async-handler';
import type { AuthenticatedRequest } from '../../shared/http/auth-middleware';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse, buildListData } from '../../shared/http/response';
import { validateBody } from '../../shared/http/validation';
import { parsePagination } from '../../shared/utils/pagination';
import { normalizeDate } from '../../shared/utils/date';
import { BaseUserSettingService } from '../../shared/db/base-user-setting.service';
import { AppError } from '../../shared/errors/app-error';
import { InvestmentForexCapitalFlowEntity } from './entities/investment-forex-capital-flow.entity';
import { InvestmentForexImportBatchEntity } from './entities/investment-forex-import-batch.entity';
import { InvestmentForexSettingEntity } from './entities/investment-forex-setting.entity';
import { InvestmentForexTradeRecordEntity } from './entities/investment-forex-trade-record.entity';

const tradeSchemaBase = z.object({
  tradeDate: z.string().min(1),
  instrument: z.enum(['XAUUSD', 'XAGUSD']),
  orderType: z.enum(['buy', 'sell']),
  openPrice: z.number().positive().max(100000),
  lotSize: z.number().positive().max(1000),
  commission: z.number().min(-1e6).max(1e6).optional(),
  closePrice: z.number().positive().max(100000),
  pnl: z.number().min(-1e10).max(1e10).optional(),
  openTime: z.string().trim().min(1),
  closeTime: z.string().trim().min(1),
  holdTime: z.string().optional().default(''),
  remark: z.string().optional().default(''),
});

const tradeSchema = tradeSchemaBase.transform((data) => ({
  ...data,
  commission: data.commission ?? 0,
  pnl: data.pnl ?? 0,
}));

const capitalFlowSchema = z.object({
  flowDate: z.string().min(1),
  flowType: z.enum(['deposit', 'withdrawal']),
  amount: z.number().min(0).max(1e10),
  remark: z.string().optional().default(''),
});

const settingsSchema = z.object({
  leverage: z.number().min(1).optional(),
  forcedLiquidationRatio: z.number().min(0.1).max(1).optional(),
  dashboardStartDate: z.string().optional(),
  dashboardEndDate: z.string().optional(),
});

const calculatorSchema = z.object({
  leverage: z.number().min(1).max(10000),
  balance: z.number().min(0).max(1e12),
  forcedLiquidationRatio: z.number().min(0.1).max(1),
  positions: z.array(z.object({
    id: z.string(),
    instrument: z.enum(['XAUUSD', 'XAGUSD']),
    orderType: z.enum(['buy', 'sell']),
    openPrice: z.number().positive().max(100000),
    lotSize: z.number().positive().max(1000),
    closePrice: z.number().positive().max(100000).optional(),
  })).max(100).default([]),
});

const importTradeSchema = z.object({
  tradeDate: z.string().optional(),
  instrument: z.string().optional(),
  orderType: z.string().optional(),
  openPrice: z.union([z.number(), z.string()]).optional(),
  lotSize: z.union([z.number(), z.string()]).optional(),
  commission: z.union([z.number(), z.string()]).optional(),
  closePrice: z.union([z.number(), z.string()]).optional(),
  pnl: z.union([z.number(), z.string()]).optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  holdTime: z.string().optional(),
  remark: z.string().optional(),
});

const importSchema = z.object({
  fileName: z.string().trim().optional().default('forex-import.json'),
  rows: z.array(importTradeSchema).default([]),
});

const settingService = new BaseUserSettingService(InvestmentForexSettingEntity);

const CONTRACT_UNITS = {
  XAUUSD: 100,
  XAGUSD: 5000,
} as const;

const POINT_SIZES = {
  XAUUSD: 0.01,
  XAGUSD: 0.001,
} as const;

function normalizeTime(value: unknown, fallback = '09:00') {
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

function toMoney(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : fallback;
}

function calculateCommission(lotSize: number) {
  if (!Number.isFinite(lotSize) || lotSize <= 0 || lotSize > 1000) {
    return 0;
  }
  return Number((-6 * lotSize).toFixed(2));
}

function calculatePnl(instrument: 'XAUUSD' | 'XAGUSD', orderType: 'buy' | 'sell', openPrice: number, closePrice: number, lotSize: number) {
  if (!Number.isFinite(openPrice) || !Number.isFinite(closePrice) || !Number.isFinite(lotSize)) {
    return 0;
  }
  if (openPrice <= 0 || closePrice <= 0 || lotSize <= 0) {
    return 0;
  }
  if (openPrice > 100000 || closePrice > 100000 || lotSize > 1000) {
    return 0;
  }
  const diff = orderType === 'buy' ? closePrice - openPrice : openPrice - closePrice;
  const rawPnl = diff * lotSize * CONTRACT_UNITS[instrument];
  if (!Number.isFinite(rawPnl)) {
    return 0;
  }
  const clampedPnl = Math.max(-1e10, Math.min(1e10, rawPnl));
  return Number(clampedPnl.toFixed(2));
}

function calculateHoldTime(openTime: string, closeTime: string) {
  const start = dayjs(`2020-01-01T${normalizeTime(openTime, '09:00')}`);
  let end = dayjs(`2020-01-01T${normalizeTime(closeTime, '10:00')}`);
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

function mapTrade(entity: InvestmentForexTradeRecordEntity) {
  return {
    id: entity.id,
    tradeDate: dayjs(entity.trade_date).format('YYYY-MM-DD'),
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

function mapCapitalFlow(entity: InvestmentForexCapitalFlowEntity) {
  return {
    id: entity.id,
    flowDate: dayjs(entity.flow_date).format('YYYY-MM-DD'),
    flowType: entity.flow_type,
    amount: Number(entity.amount),
    remark: entity.remark,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

function filterByRange<T extends { trade_date?: string; flow_date?: string }>(items: T[], startDate?: string, endDate?: string) {
  return items.filter((item) => {
    const date = (item as { trade_date?: string; flow_date?: string }).trade_date ?? (item as { flow_date?: string }).flow_date ?? '';

    if (!date) {
      return false;
    }

    const parsed = dayjs(date);
    if (!parsed.isValid() || parsed.year() < 2000 || parsed.year() > 2100) {
      return false;
    }

    return (!startDate || !parsed.isBefore(startDate, 'day')) && (!endDate || !parsed.isAfter(endDate, 'day'));
  });
}

function buildSummary(
  trades: InvestmentForexTradeRecordEntity[],
  capitalFlows: InvestmentForexCapitalFlowEntity[],
  startDate?: string,
  endDate?: string,
) {
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

export function createForexRouter() {
  const router = Router();

  router.get('/trades', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(InvestmentForexTradeRecordEntity);
    const [items, total] = await repository.findAndCount({
      where: { user_id: userId },
      order: { trade_date: 'DESC', updated_at: 'DESC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items.map(mapTrade), page, pageSize, total)));
  }));

  router.post('/trades', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(tradeSchema, request.body);
    const repository = appDataSource.getRepository(InvestmentForexTradeRecordEntity);
    const item = await repository.save(repository.create({
      user_id: userId,
      trade_date: normalizeDate(payload.tradeDate),
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

    response.json(successResponse(mapTrade(item), 'create_forex_trade_success'));
  }));

  router.patch('/trades/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const tradeId = String(request.params.id ?? '');
    const payload = validateBody(tradeSchemaBase.partial(), request.body);
    const repository = appDataSource.getRepository(InvestmentForexTradeRecordEntity);
    const current = await repository.findOne({
      where: { id: tradeId, user_id: userId },
    });

    if (!current) {
      throw new AppError('forex_trade_not_found', 404, 404);
    }

    const nextInstrument: 'XAUUSD' | 'XAGUSD' = payload.instrument ?? (current.instrument as 'XAUUSD' | 'XAGUSD');
    const nextOrderType: 'buy' | 'sell' = payload.orderType ?? (current.order_type as 'buy' | 'sell');
    const nextOpenPrice = payload.openPrice ?? Number(current.open_price);
    const nextClosePrice = payload.closePrice ?? Number(current.close_price);
    const nextLotSize = payload.lotSize ?? Number(current.lot_size);
    const nextOpenTime = payload.openTime ? normalizeTime(payload.openTime, '09:00') : current.open_time;
    const nextCloseTime = payload.closeTime ? normalizeTime(payload.closeTime, '10:00') : current.close_time;

    const item = await repository.save({
      ...current,
      trade_date: payload.tradeDate ? normalizeDate(payload.tradeDate) : current.trade_date,
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

    response.json(successResponse(mapTrade(item), 'update_forex_trade_success'));
  }));

  router.delete('/trades/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const tradeId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(InvestmentForexTradeRecordEntity);
    const current = await repository.findOne({
      where: { id: tradeId, user_id: userId },
    });

    if (!current) {
      throw new AppError('forex_trade_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_forex_trade_success'));
  }));

  router.get('/capital-flows', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const { page, pageSize, skip } = parsePagination(request.query as Record<string, unknown>);
    const repository = appDataSource.getRepository(InvestmentForexCapitalFlowEntity);
    const [items, total] = await repository.findAndCount({
      where: { user_id: userId },
      order: { flow_date: 'DESC', updated_at: 'DESC' },
      skip,
      take: pageSize,
    });

    response.json(successResponse(buildListData(items.map(mapCapitalFlow), page, pageSize, total)));
  }));

  router.post('/capital-flows', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(capitalFlowSchema, request.body);
    const repository = appDataSource.getRepository(InvestmentForexCapitalFlowEntity);
    const item = await repository.save(repository.create({
      user_id: userId,
      flow_date: normalizeDate(payload.flowDate),
      flow_type: payload.flowType,
      amount: payload.amount,
      remark: payload.remark,
    }));

    response.json(successResponse(mapCapitalFlow(item), 'create_forex_capital_flow_success'));
  }));

  router.patch('/capital-flows/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const flowId = String(request.params.id ?? '');
    const payload = validateBody(capitalFlowSchema.partial(), request.body);
    const repository = appDataSource.getRepository(InvestmentForexCapitalFlowEntity);
    const current = await repository.findOne({
      where: { id: flowId, user_id: userId },
    });

    if (!current) {
      throw new AppError('forex_capital_flow_not_found', 404, 404);
    }

    const item = await repository.save({
      ...current,
      flow_date: payload.flowDate ? normalizeDate(payload.flowDate) : current.flow_date,
      flow_type: payload.flowType ?? current.flow_type,
      amount: payload.amount ?? current.amount,
      remark: payload.remark ?? current.remark,
    });

    response.json(successResponse(mapCapitalFlow(item), 'update_forex_capital_flow_success'));
  }));

  router.delete('/capital-flows/:id', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const flowId = String(request.params.id ?? '');
    const repository = appDataSource.getRepository(InvestmentForexCapitalFlowEntity);
    const current = await repository.findOne({
      where: { id: flowId, user_id: userId },
    });

    if (!current) {
      throw new AppError('forex_capital_flow_not_found', 404, 404);
    }

    await repository.remove(current);
    response.json(successResponse({ ok: true }, 'delete_forex_capital_flow_success'));
  }));

  router.get('/dashboard-summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      leverage: 100,
      forced_liquidation_ratio: 0.5,
      dashboard_start_date: null,
      dashboard_end_date: null,
    });
    const [trades, capitalFlows] = await Promise.all([
      appDataSource.getRepository(InvestmentForexTradeRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(InvestmentForexCapitalFlowEntity).find({ where: { user_id: userId } }),
    ]);

    response.json(successResponse(buildSummary(
      trades,
      capitalFlows,
      settings.dashboard_start_date ?? undefined,
      settings.dashboard_end_date ?? undefined,
    )));
  }));

  router.get('/daily-pnl-trend', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(InvestmentForexTradeRecordEntity);
    const items = await repository.find({ where: { user_id: userId } });
    const grouped = new Map<string, { grossPnl: number; commission: number; tradeCount: number }>();

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
      .sort((left, right) => dayjs(left.date).valueOf() - dayjs(right.date).valueOf());

    response.json(successResponse(result));
  }));

  router.get('/instrument-summary', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const repository = appDataSource.getRepository(InvestmentForexTradeRecordEntity);
    const items = await repository.find({ where: { user_id: userId } });
    const result = (['XAUUSD', 'XAGUSD'] as const).map((instrument) => {
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

    response.json(successResponse(result));
  }));

  router.get('/insights', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const [trades, capitalFlows] = await Promise.all([
      appDataSource.getRepository(InvestmentForexTradeRecordEntity).find({ where: { user_id: userId } }),
      appDataSource.getRepository(InvestmentForexCapitalFlowEntity).find({ where: { user_id: userId } }),
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
      response.json(successResponse(insights));
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

    response.json(successResponse(insights));
  }));

  router.get('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const settings = await settingService.getOrCreate(userId, {
      leverage: 100,
      forced_liquidation_ratio: 0.5,
      dashboard_start_date: null,
      dashboard_end_date: null,
    });

    response.json(successResponse({
      leverage: Number(settings.leverage),
      forcedLiquidationRatio: Number(settings.forced_liquidation_ratio),
      dashboardStartDate: settings.dashboard_start_date ? dayjs(settings.dashboard_start_date).format('YYYY-MM-DD') : '',
      dashboardEndDate: settings.dashboard_end_date ? dayjs(settings.dashboard_end_date).format('YYYY-MM-DD') : '',
    }));
  }));

  router.patch('/settings', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(settingsSchema, request.body);
    const settings = await settingService.update(userId, {
      leverage: payload.leverage,
      forced_liquidation_ratio: payload.forcedLiquidationRatio,
      dashboard_start_date: payload.dashboardStartDate ? normalizeDate(payload.dashboardStartDate) : undefined,
      dashboard_end_date: payload.dashboardEndDate ? normalizeDate(payload.dashboardEndDate) : undefined,
    }, {
      leverage: 100,
      forced_liquidation_ratio: 0.5,
      dashboard_start_date: null,
      dashboard_end_date: null,
    });

    response.json(successResponse({
      leverage: Number(settings.leverage),
      forcedLiquidationRatio: Number(settings.forced_liquidation_ratio),
      dashboardStartDate: settings.dashboard_start_date ? dayjs(settings.dashboard_start_date).format('YYYY-MM-DD') : '',
      dashboardEndDate: settings.dashboard_end_date ? dayjs(settings.dashboard_end_date).format('YYYY-MM-DD') : '',
    }, 'update_forex_settings_success'));
  }));

  router.post('/calculator', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const payload = validateBody(calculatorSchema, request.body);
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
      const forcedLiquidationPrice = Number((
        position.orderType === 'buy'
          ? Math.max(0, position.openPrice - priceMove)
          : position.openPrice + priceMove
      ).toFixed(2));

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

    response.json(successResponse({
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

  router.post('/actions/import', asyncHandler(async (request: AuthenticatedRequest, response) => {
    const userId = requireAuthUser(request);
    const payload = validateBody(importSchema, request.body);
    const rows = payload.rows ?? [];
    const repository = appDataSource.getRepository(InvestmentForexTradeRecordEntity);
    const batchRepo = appDataSource.getRepository(InvestmentForexImportBatchEntity);
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
    const toSave: InvestmentForexTradeRecordEntity[] = [];

    rows.forEach((row) => {
      const instrument = row.instrument === 'XAGUSD' ? 'XAGUSD' : row.instrument === 'XAUUSD' ? 'XAUUSD' : null;
      const orderType = row.orderType === 'sell' ? 'sell' : row.orderType === 'buy' ? 'buy' : null;
      const tradeDate = row.tradeDate ? normalizeDate(row.tradeDate) : '';
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

    response.json(successResponse({
      total_rows: rows.length,
      imported_count: importedCount,
      duplicate_count: duplicateCount,
      invalid_count: invalidCount,
    }, 'import_forex_trades_success'));
  }));

  router.get('/actions/download-template', asyncHandler(async (_request: AuthenticatedRequest, response) => {
    response.json(successResponse({
      fileName: 'forex-import-template.json',
      headers: ['tradeDate', 'instrument', 'orderType', 'openPrice', 'lotSize', 'commission', 'closePrice', 'pnl', 'openTime', 'closeTime', 'holdTime', 'remark'],
      formulas: {
        G: '=-F2/0.01*0.06',
        I: '=IF(OR(B2="XAUUSD",B2="XAGUSD"),IF(D2="buy",(H2-E2)*IF(B2="XAUUSD",100,5000)*F2,(E2-H2)*IF(B2="XAUUSD",100,5000)*F2),"")',
        L: '=IF(K2-J2>=TIME(1,0,0),INT((K2-J2)*24)&"时"&MINUTE(K2-J2)&"分"&SECOND(K2-J2)&"秒",MINUTE(K2-J2)&"分"&SECOND(K2-J2)&"秒")',
      },
      sample: {
        tradeDate: dayjs().format('YYYY-MM-DD'),
        instrument: 'XAUUSD',
        orderType: 'buy',
        openPrice: 2340.5,
        lotSize: 0.1,
        commission: -0.6,
        closePrice: 2346.2,
        pnl: 57,
        openTime: '09:35',
        closeTime: '11:10',
        holdTime: '1时35分',
        remark: '示例数据',
      },
    }));
  }));

  return router;
}
