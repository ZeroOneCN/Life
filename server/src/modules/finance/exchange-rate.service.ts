/**
 * 汇率转换服务。
 *
 * 把 exchange-rate.router.ts 中的汇率获取/缓存/降级逻辑抽出来作为可复用 service，
 * 让其他后端模块（如 finance-report）能在不经过 HTTP 路由的情况下调用汇率转换。
 *
 * 数据来源：exchangerate-api.com v6（可通过 env.EXCHANGE_RATE_API_KEY 配置）。
 * 缓存策略：1 小时 TTL，进程内 Map 缓存。
 * 降级策略：API 不可用或未配置 key 时使用内置的 FALLBACK_RATES。
 */
import { env } from '../../config/env';

export interface ExchangeRateResult {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
  source: 'exchangerate-api' | 'fallback';
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, ExchangeRateResult>();

const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: { USD: 1, CNY: 7.18, EUR: 0.92, JPY: 156.4, HKD: 7.82, GBP: 0.78, AUD: 1.52, SGD: 1.34, KRW: 1372, THB: 36.5 },
  CNY: { CNY: 1, USD: 0.139, EUR: 0.128, JPY: 21.8, HKD: 1.09, GBP: 0.109, AUD: 0.212, SGD: 0.187, KRW: 191, THB: 5.08 },
  EUR: { EUR: 1, USD: 1.087, CNY: 7.81, JPY: 170.1, HKD: 8.51, GBP: 0.847, AUD: 1.65, SGD: 1.46, KRW: 1492, THB: 39.7 },
  HKD: { HKD: 1, USD: 0.128, CNY: 0.918, EUR: 0.118, JPY: 20, GBP: 0.0998, AUD: 0.194, SGD: 0.171, KRW: 175.4, THB: 4.67 },
  JPY: { JPY: 1, USD: 0.0064, CNY: 0.0459, EUR: 0.00588, HKD: 0.05, GBP: 0.00499, AUD: 0.0097, SGD: 0.00857, KRW: 8.78, THB: 0.234 },
};

function fallbackRates(base: string): ExchangeRateResult {
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
  return { base: upper, rates: FALLBACK_RATES.USD, fetchedAt: Date.now(), source: 'fallback' };
}

async function fetchRates(base: string): Promise<ExchangeRateResult> {
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
  } catch {
    return fallbackRates(upper);
  }
}

/**
 * 获取指定基础货币的汇率表（含缓存）。
 *
 * @param base 基础货币代码（如 USD、CNY）
 * @returns 汇率结果，包含 rates / source / fetchedAt
 */
export async function getRates(base: string): Promise<ExchangeRateResult> {
  const upper = base.toUpperCase();
  const cached = cache.get(upper);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }
  const fresh = await fetchRates(upper);
  cache.set(upper, fresh);
  return fresh;
}

/**
 * 获取两币种之间的汇率（from → to）。
 *
 * 支持跨基础货币：若 to 不在 from 的汇率表中，则以 USD 作为桥梁折算。
 *
 * @param from 源货币代码
 * @param to   目标货币代码
 * @returns 汇率数值；若无法换算返回 null
 */
export async function getExchangeRate(from: string, to: string): Promise<number | null> {
  const upperFrom = from.toUpperCase();
  const upperTo = to.toUpperCase();
  if (upperFrom === upperTo) {
    return 1;
  }

  const fromRates = await getRates(upperFrom);
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

  return rate ?? null;
}

export interface ConvertCurrencyResult {
  from: string;
  to: string;
  rate: number;
  amount: number;
  converted: number;
  source: ExchangeRateResult['source'];
  fetchedAt: string;
}

/**
 * 将金额从一种货币转换为另一种货币。
 *
 * @param from   源货币代码
 * @param to     目标货币代码
 * @param amount 源金额
 * @returns 转换结果，包含汇率、转换后金额、数据来源等；若无法换算返回 null
 */
export async function convertCurrency(
  from: string,
  to: string,
  amount: number,
): Promise<ConvertCurrencyResult | null> {
  const upperFrom = from.toUpperCase();
  const upperTo = to.toUpperCase();
  const fromRates = await getRates(upperFrom);

  let rate = fromRates.rates[upperTo];
  if (rate === undefined) {
    const usd = await getRates('USD');
    const fromInUsd = usd.rates[upperFrom];
    const toInUsd = usd.rates[upperTo];
    if (fromInUsd && toInUsd) {
      rate = Number((toInUsd / fromInUsd).toFixed(6));
    }
  }

  if (rate === undefined) {
    return null;
  }

  return {
    from: upperFrom,
    to: upperTo,
    rate,
    amount,
    converted: Number((rate * amount).toFixed(4)),
    source: fromRates.source,
    fetchedAt: new Date(fromRates.fetchedAt).toISOString(),
  };
}
