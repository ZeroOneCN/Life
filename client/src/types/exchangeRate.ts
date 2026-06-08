export interface ExchangeRateLatest {
  base: string;
  rates: Record<string, number>;
  source: 'exchangerate-api' | 'fallback';
  fetchedAt: string;
}

export interface ExchangeRateConvert {
  from: string;
  to: string;
  rate: number;
  amount: number;
  converted: number;
  source: 'exchangerate-api' | 'fallback';
  fetchedAt: string;
}
