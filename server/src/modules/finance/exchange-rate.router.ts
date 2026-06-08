import { Router } from 'express';
import { z } from 'zod';

import { env } from '../../config/env';
import { asyncHandler } from '../../shared/http/async-handler';
import { requireAuthUser } from '../../shared/http/request';
import { successResponse } from '../../shared/http/response';
import { normalizeText } from '../../shared/utils/text';

interface CachedRate {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
  source: 'exchangerate-api' | 'fallback';
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CachedRate>();

const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: { USD: 1, CNY: 7.18, EUR: 0.92, JPY: 156.4, HKD: 7.82, GBP: 0.78, AUD: 1.52, SGD: 1.34, KRW: 1372, THB: 36.5 },
  CNY: { CNY: 1, USD: 0.139, EUR: 0.128, JPY: 21.8, HKD: 1.09, GBP: 0.109, AUD: 0.212, SGD: 0.187, KRW: 191, THB: 5.08 },
  EUR: { EUR: 1, USD: 1.087, CNY: 7.81, JPY: 170.1, HKD: 8.51, GBP: 0.847, AUD: 1.65, SGD: 1.46, KRW: 1492, THB: 39.7 },
  HKD: { HKD: 1, USD: 0.128, CNY: 0.918, EUR: 0.118, JPY: 20, GBP: 0.0998, AUD: 0.194, SGD: 0.171, KRW: 175.4, THB: 4.67 },
  JPY: { JPY: 1, USD: 0.0064, CNY: 0.0459, EUR: 0.00588, HKD: 0.05, GBP: 0.00499, AUD: 0.0097, SGD: 0.00857, KRW: 8.78, THB: 0.234 },
};

function fallbackRates(base: string): CachedRate {
  const upper = base.toUpperCase();
  const rates = FALLBACK_RATES[upper];
  if (rates) {
    return { base: upper, rates, fetchedAt: Date.now(), source: 'fallback' };
  }
  const inverseSource = Object.values(FALLBACK_RATES).find((value) => value[upper]);
  if (inverseSource) {
    const rate = inverseSource[upper];
    const converted: Record<string, number> = {};
    Object.entries(inverseSource).forEach(([currency, value]) => {
      converted[currency] = Number((value / rate).toFixed(6));
    });
    return { base: upper, rates: converted, fetchedAt: Date.now(), source: 'fallback' };
  }
  // 找不到基础币种时返回 USD 表，让前端能继续展示
  return { base: upper, rates: FALLBACK_RATES.USD, fetchedAt: Date.now(), source: 'fallback' };
}

async function fetchRates(base: string): Promise<CachedRate> {
  const upper = base.toUpperCase();
  if (!env.EXCHANGE_RATE_API_KEY) {
    return fallbackRates(upper);
  }
  try {
    const response = await fetch(`${env.EXCHANGE_RATE_API_BASE_URL}/${env.EXCHANGE_RATE_API_KEY}/latest/${upper}`);
    if (!response.ok) {
      return fallbackRates(upper);
    }
    const data = (await response.json()) as { result?: string; conversion_rates?: Record<string, number> };
    if (data.result !== 'success' || !data.conversion_rates) {
      return fallbackRates(upper);
    }
    const rates: Record<string, number> = {};
    Object.entries(data.conversion_rates).forEach(([currency, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        rates[currency] = value;
      }
    });
    if (Object.keys(rates).length < 5) {
      return fallbackRates(upper);
    }
    return { base: upper, rates, fetchedAt: Date.now(), source: 'exchangerate-api' };
  } catch (error) {
    return fallbackRates(upper);
  }
}

async function getRates(base: string): Promise<CachedRate> {
  const upper = base.toUpperCase();
  const cached = cache.get(upper);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }
  const fresh = await fetchRates(upper);
  cache.set(upper, fresh);
  return fresh;
}

const latestQuerySchema = z.object({
  base: z.string().trim().min(2).max(8).optional().default('USD'),
  symbols: z.string().trim().optional(),
});

const convertQuerySchema = z.object({
  from: z.string().trim().min(2).max(8).optional().default('USD'),
  to: z.string().trim().min(2).max(8).optional().default('CNY'),
  amount: z.coerce.number().min(0).max(1_000_000_000).optional().default(1),
});

export function createExchangeRateRouter() {
  const router = Router();

  router.get('/latest', asyncHandler(async (request, response) => {
    requireAuthUser(request);
    const { base, symbols } = latestQuerySchema.parse(request.query);
    const upperBase = base.toUpperCase();
    const result = await getRates(upperBase);

    let rates = result.rates;
    if (symbols) {
      const wanted = symbols
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
      const filtered: Record<string, number> = {};
      wanted.forEach((currency) => {
        if (rates[currency] !== undefined) {
          filtered[currency] = rates[currency];
        } else {
          // 跨基础货币回退：尝试以 USD 折算
          const usdCached = cache.get('USD');
          const usdRates: Record<string, number> = usdCached?.rates ?? FALLBACK_RATES.USD;
          const targetRate = usdRates[currency];
          const baseToUsd = usdRates[upperBase];
          if (targetRate && baseToUsd) {
            filtered[currency] = Number((baseToUsd / targetRate).toFixed(6));
          }
        }
      });
      rates = filtered;
    }

    response.json(successResponse({
      base: result.base,
      rates,
      source: result.source,
      fetchedAt: new Date(result.fetchedAt).toISOString(),
    }));
  }));

  router.get('/convert', asyncHandler(async (request, response) => {
    requireAuthUser(request);
    const { from, to, amount } = convertQuerySchema.parse(request.query);
    const upperFrom = from.toUpperCase();
    const upperTo = to.toUpperCase();

    let fromRates = await getRates(upperFrom);
    let rate = fromRates.rates[upperTo];

    if (rate === undefined) {
      // 跨基础货币：使用 USD 作为桥梁
      const usd = await getRates('USD');
      const fromInUsd = usd.rates[upperFrom];
      const toInUsd = usd.rates[upperTo];
      if (fromInUsd && toInUsd) {
        rate = Number((toInUsd / fromInUsd).toFixed(6));
      }
    }

    if (rate === undefined) {
      response.status(400).json({ message: `无法换算 ${upperFrom} → ${upperTo}` });
      return;
    }

    response.json(successResponse({
      from: upperFrom,
      to: upperTo,
      rate,
      amount,
      converted: Number((rate * amount).toFixed(4)),
      source: fromRates.source,
      fetchedAt: new Date(fromRates.fetchedAt).toISOString(),
    }));
  }));

  return router;
}
