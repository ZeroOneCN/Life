import { useEffect, useMemo, useState } from 'react';

import { EmptyState, SectionCard } from '../../components/page';
import { Btn, Field, SelectField, Tag } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { exchangeRateApi } from '../../services/exchangeRateApi';
import type { ExchangeRateConvert } from '../../types/exchangeRate';

const COMMON_CURRENCIES = ['CNY', 'USD', 'EUR', 'HKD', 'JPY', 'GBP', 'AUD', 'SGD', 'KRW', 'THB'];

interface CurrencyConverterProps {
  defaultFrom?: string;
  defaultTo?: string;
  defaultAmount?: number;
}

export function CurrencyConverter({
  defaultFrom = 'USD',
  defaultTo = 'CNY',
  defaultAmount = 100,
}: CurrencyConverterProps) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [result, setResult] = useState<ExchangeRateConvert | null>(null);
  const [loading, setLoading] = useState(false);

  const currencyOptions = useMemo(() => {
    const set = new Set<string>([...COMMON_CURRENCIES, from, to]);
    return [...set].sort();
  }, [from, to]);

  const convert = async () => {
    if (!Number.isFinite(amount) || amount < 0) {
      return;
    }
    setLoading(true);
    try {
      const data = await exchangeRateApi.convert(from, to, amount);
      setResult(data);
    } catch (error) {
      setResult(null);
      // eslint-disable-next-line no-alert
      alert(buildApiErrorMessage(error, '汇率换算失败。'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void convert();
  }, []);

  return (
    <SectionCard
      title="汇率换算"
      description="基于 Exchange Rate API（v6）实时拉取，按基础货币折算。"
      action={(
        <div className="inline-row">
          <Tag tone="blue">{result?.source === 'exchangerate-api' ? '实时汇率' : '降级回退'}</Tag>
          {result ? <Tag tone="green">更新于 {new Date(result.fetchedAt).toLocaleTimeString('zh-CN')}</Tag> : null}
        </div>
      )}
    >
      <div className="currency-converter-grid">
        <SelectField
          label="原币种"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        >
          {currencyOptions.map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </SelectField>
        <SelectField
          label="目标币种"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        >
          {currencyOptions.map((currency) => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </SelectField>
        <Field
          label="金额"
          type="number"
          min={0}
          step={0.01}
          value={String(amount)}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
        <div className="currency-converter-action">
          <Btn tone="primary" onClick={() => void convert()} disabled={loading}>
            {loading ? '计算中…' : '换算'}
          </Btn>
          <Btn
            tone="ghost"
            onClick={() => {
              const nextFrom = to;
              const nextTo = from;
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          >
            互换
          </Btn>
        </div>
      </div>
      {result ? (
        <div className="currency-converter-result">
          <div>
            <span className="subtle-text">{result.from} × {result.rate.toFixed(4)} = </span>
            <strong>
              {result.to} {result.converted.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
            </strong>
          </div>
          <span className="subtle-text">单笔金额：{result.amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} {result.from}</span>
        </div>
      ) : (
        <EmptyState title="暂无换算结果" description="输入金额后点击「换算」获取最新汇率。" icon="💱" />
      )}
    </SectionCard>
  );
}
