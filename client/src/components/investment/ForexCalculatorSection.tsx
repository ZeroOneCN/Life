import { useEffect, useMemo, useState } from 'react';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, Field, SelectField, Tag } from '../ui';
import {
  FOREX_INSTRUMENT_OPTIONS,
  FOREX_ORDER_TYPE_OPTIONS,
  computeForexMultiPosition,
  formatForexAmount,
  formatForexMoney,
  formatForexPercent,
  getForexInstrumentLabel,
  getForexOrderTypeLabel,
} from '../../services/forex';
import type { ForexCalculationResult, ForexCalculatorPositionDraft, ForexInstrument, ForexOrderType } from '../../types/forex';

interface ForexCalculatorSectionProps {
  leverage: number;
  forcedLiquidationRatio: number;
  defaultBalance: number;
  onLeverageChange: (value: number) => void;
  onForcedLiquidationRatioChange: (value: number) => void;
}

interface SharedFormState {
  leverage: string;
  balance: string;
  forcedLiquidationRatio: string;
}

interface PositionFormState {
  id: string;
  instrument: ForexInstrument;
  orderType: ForexOrderType;
  openPrice: string;
  lotSize: string;
  closePrice: string;
}

function buildPositionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 10);
}

function createPosition(): PositionFormState {
  return {
    id: buildPositionId(),
    instrument: 'XAUUSD',
    orderType: 'buy',
    openPrice: '',
    lotSize: '0.01',
    closePrice: '',
  };
}

function toDraftPositions(positions: PositionFormState[]): ForexCalculatorPositionDraft[] {
  return positions
    .map((position) => ({
      id: position.id,
      instrument: position.instrument,
      orderType: position.orderType,
      openPrice: Number(position.openPrice),
      lotSize: Number(position.lotSize),
      closePrice: position.closePrice ? Number(position.closePrice) : null,
    }))
    .filter((position) => Number.isFinite(position.openPrice) && position.openPrice > 0 && Number.isFinite(position.lotSize) && position.lotSize > 0);
}

function SummaryBlock({
  result,
}: {
  result: ForexCalculationResult;
}) {
  return (
    <StatGrid
      items={[
        { label: '总合约价值', value: formatForexMoney(result.accountSummary.totalContractValue) },
        { label: '总占用保证金', value: formatForexMoney(result.accountSummary.totalMargin) },
        { label: '总浮动盈亏', value: formatForexAmount(result.accountSummary.totalPnl), accent: result.accountSummary.totalPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
        { label: '平仓后净值', value: formatForexMoney(result.accountSummary.equityIfClosed) },
        { label: '保证金占用', value: formatForexPercent(result.accountSummary.marginUsageRatio) },
        { label: '可用保证金', value: formatForexMoney(result.accountSummary.remainingAvailableMargin), accent: result.accountSummary.remainingAvailableMargin >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
      ]}
      className="forex-calculator-stat-grid"
    />
  );
}

export function ForexCalculatorSection({
  leverage,
  forcedLiquidationRatio,
  defaultBalance,
  onLeverageChange,
  onForcedLiquidationRatioChange,
}: ForexCalculatorSectionProps) {
  const [shared, setShared] = useState<SharedFormState>({
    leverage: String(leverage),
    balance: defaultBalance > 0 ? defaultBalance.toFixed(2) : '',
    forcedLiquidationRatio: String(forcedLiquidationRatio),
  });
  const [positions, setPositions] = useState<PositionFormState[]>([createPosition()]);

  useEffect(() => {
    setShared((current) => ({
      ...current,
      leverage: String(leverage),
      forcedLiquidationRatio: String(forcedLiquidationRatio),
      balance: current.balance || (defaultBalance > 0 ? defaultBalance.toFixed(2) : ''),
    }));
  }, [defaultBalance, forcedLiquidationRatio, leverage]);

  const result = useMemo(() => {
    const draftPositions = toDraftPositions(positions);

    return computeForexMultiPosition(draftPositions, {
      leverage: Number(shared.leverage) || leverage,
      balance: Number(shared.balance) || 0,
      forcedLiquidationRatio: Number(shared.forcedLiquidationRatio) || forcedLiquidationRatio,
    });
  }, [forcedLiquidationRatio, leverage, positions, shared.balance, shared.forcedLiquidationRatio, shared.leverage]);

  return (
    <SectionCard
      title="交易计算"
      description="支持多仓位同时计算保证金、点值、盈亏和风险阈值，适合做贵金属仓位组合的本地演练。"
      action={<Tag tone="blue">自动计算</Tag>}
    >
      <div className="page-stack">
        <div className="forex-calculator-shared-grid">
          <Field
            label="杠杆"
            value={shared.leverage}
            onChange={(event) => {
              const value = event.target.value;
              setShared((current) => ({ ...current, leverage: value }));
              onLeverageChange(Math.max(1, Number(value) || leverage));
            }}
            placeholder="500"
          />
          <Field
            label="账户余额"
            value={shared.balance}
            onChange={(event) => setShared((current) => ({ ...current, balance: event.target.value }))}
            placeholder="可手动改写"
          />
          <Field
            label="强平比例"
            value={shared.forcedLiquidationRatio}
            onChange={(event) => {
              const value = event.target.value;
              setShared((current) => ({ ...current, forcedLiquidationRatio: value }));
              onForcedLiquidationRatioChange(Number(value) || forcedLiquidationRatio);
            }}
            placeholder="0.5"
            hint="例如 0.5 代表账户权益接近保证金的 50% 时视作风险边界。"
          />
        </div>

        <div className="forex-position-list">
          {positions.map((position, index) => (
            <div className="forex-position-row" key={position.id}>
              <div className="forex-position-row-head">
                <strong>{`仓位 ${index + 1}`}</strong>
                <Btn
                  tone="danger"
                  disabled={positions.length === 1}
                  onClick={() => setPositions((current) => current.filter((item) => item.id !== position.id))}
                >
                  删除
                </Btn>
              </div>
              <div className="forex-position-grid">
                <SelectField
                  label="品种"
                  value={position.instrument}
                  onChange={(event) => setPositions((current) => current.map((item) => (
                    item.id === position.id ? { ...item, instrument: event.target.value as ForexInstrument } : item
                  )))}
                >
                  {FOREX_INSTRUMENT_OPTIONS.map((instrument) => (
                    <option key={instrument} value={instrument}>{getForexInstrumentLabel(instrument)}</option>
                  ))}
                </SelectField>
                <SelectField
                  label="方向"
                  value={position.orderType}
                  onChange={(event) => setPositions((current) => current.map((item) => (
                    item.id === position.id ? { ...item, orderType: event.target.value as ForexOrderType } : item
                  )))}
                >
                  {FOREX_ORDER_TYPE_OPTIONS.map((orderType) => (
                    <option key={orderType} value={orderType}>{getForexOrderTypeLabel(orderType)}</option>
                  ))}
                </SelectField>
                <Field
                  label="开仓价"
                  value={position.openPrice}
                  onChange={(event) => setPositions((current) => current.map((item) => (
                    item.id === position.id ? { ...item, openPrice: event.target.value } : item
                  )))}
                  placeholder="2340.50"
                />
                <Field
                  label="手数"
                  value={position.lotSize}
                  onChange={(event) => setPositions((current) => current.map((item) => (
                    item.id === position.id ? { ...item, lotSize: event.target.value } : item
                  )))}
                  placeholder="0.01"
                />
                <Field
                  label="平仓价"
                  value={position.closePrice}
                  onChange={(event) => setPositions((current) => current.map((item) => (
                    item.id === position.id ? { ...item, closePrice: event.target.value } : item
                  )))}
                  placeholder="可留空只算保证金"
                />
              </div>
            </div>
          ))}

          <div className="forex-action-row">
            <Btn tone="secondary" onClick={() => setPositions((current) => [...current, createPosition()])}>新增仓位</Btn>
          </div>
        </div>

        {result.positions.length ? (
          <>
            <SummaryBlock result={result} />
            <div className="forex-calculator-result-grid">
              {result.positions.map((position, index) => (
                <article className="forex-result-card" key={position.id}>
                  <div className="forex-result-card-head">
                    <strong>{`仓位 ${index + 1}`}</strong>
                    <Tag tone={position.orderType === 'buy' ? 'green' : 'orange'}>
                      {`${getForexInstrumentLabel(position.instrument)} · ${getForexOrderTypeLabel(position.orderType)}`}
                    </Tag>
                  </div>
                  <div className="forex-result-card-metrics">
                    <span>{`合约价值 ${formatForexMoney(position.contractValue)}`}</span>
                    <span>{`保证金 ${formatForexMoney(position.margin)}`}</span>
                    <span>{`点值 ${formatForexMoney(position.pointValue)}`}</span>
                    <span>{`强平参考价 ${formatForexMoney(position.forcedLiquidationPrice)}`}</span>
                    <span style={{ color: (position.pnl ?? 0) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {position.pnl === null ? '未提供平仓价' : `平仓盈亏 ${formatForexAmount(position.pnl)}`}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="先补全至少一笔仓位" description="只要补齐开仓价和手数，这里就会开始计算保证金和风险结果。" />
        )}
      </div>
    </SectionCard>
  );
}
