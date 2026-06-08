import { apiGet } from '../lib/api';
import type { ExchangeRateConvert, ExchangeRateLatest } from '../types/exchangeRate';

export const exchangeRateApi = {
  latest(base: string, symbols?: string[]) {
    return apiGet<ExchangeRateLatest>('/finance/exchange-rate/latest', undefined, {
      base,
      symbols: symbols && symbols.length ? symbols.join(',') : undefined,
    });
  },

  convert(from: string, to: string, amount: number) {
    return apiGet<ExchangeRateConvert>('/finance/exchange-rate/convert', undefined, {
      from,
      to,
      amount,
    });
  },
};
