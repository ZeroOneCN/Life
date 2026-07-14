import { SectionCard } from '../page';
import { DataTable, Tag } from '../ui';
import { formatMoney, formatPercent } from '../../services/stockCalc';
import {
  type StockDashboardSummary,
  INVESTMENT_MARKET_CONFIG,
} from '../../types/investment';
import { type StockMarketType } from '../../services/stockStorage';

interface StockDashboardSectionProps {
  summary: StockDashboardSummary;
  market: StockMarketType;
}

export function StockDashboardSection({ summary, market }: StockDashboardSectionProps) {
  const config = INVESTMENT_MARKET_CONFIG[market];

  const statCards = [
    {
      label: '总交易',
      value: summary.totalTrades,
      subtext: `笔`,
    },
    {
      label: '持仓数',
      value: summary.openPositionsCount,
      subtext: '个标的',
    },
    {
      label: '已平仓',
      value: summary.closedTradesCount,
      subtext: '笔',
    },
    {
      label: '总手续费',
      value: formatMoney(summary.totalFees, config.currencySymbol),
      subtext: '',
      color: '#6b7280',
    },
  ];

  const pnlCards = [
    {
      label: '已实现盈亏',
      value: formatMoney(summary.realizedPnl, config.currencySymbol),
      color: summary.realizedPnl >= 0 ? config.upColor : config.downColor,
    },
    {
      label: '未实现盈亏',
      value: formatMoney(summary.unrealizedPnl, config.currencySymbol),
      color: summary.unrealizedPnl >= 0 ? config.upColor : config.downColor,
    },
    {
      label: '胜率',
      value: `${summary.winRate}%`,
      color: summary.winRate >= 50 ? config.upColor : config.downColor,
    },
    {
      label: '盈亏比',
      value: summary.profitFactor.toString(),
      color: summary.profitFactor >= 1 ? config.upColor : config.downColor,
    },
  ];

  const tradeStatsCards = [
    {
      label: '最佳交易',
      value: formatMoney(summary.bestTradePnl, config.currencySymbol),
      color: config.upColor,
    },
    {
      label: '最差交易',
      value: formatMoney(summary.worstTradePnl, config.currencySymbol),
      color: config.downColor,
    },
    {
      label: '平均持仓',
      value: `${summary.averageHoldDays}天`,
      color: '#6b7280',
    },
  ];

  const platformColumns = [
    { key: 'platformName', title: '平台', render: (_: unknown, row: { platformName: string }) => row.platformName },
    { key: 'tradeCount', title: '交易数', render: (_: unknown, row: { tradeCount: number }) => row.tradeCount },
    { key: 'fees', title: '手续费', render: (_: unknown, row: { fees: number }) => formatMoney(row.fees, config.currencySymbol) },
    { key: 'pnl', title: '盈亏', render: (_: unknown, row: { pnl: number }) => (
      <strong style={{ color: row.pnl >= 0 ? config.upColor : config.downColor }}>
        {formatMoney(row.pnl, config.currencySymbol)}
      </strong>
    )},
  ];

  const symbolColumns = [
    { key: 'symbol', title: '标的', render: (_: unknown, row: { symbol: string; name: string }) => (
      <div>
        <strong>{row.symbol}</strong>
        <span style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--fs-caption)' }}>{row.name}</span>
      </div>
    )},
    { key: 'tradeCount', title: '交易数', render: (_: unknown, row: { tradeCount: number }) => row.tradeCount },
    { key: 'fees', title: '手续费', render: (_: unknown, row: { fees: number }) => formatMoney(row.fees, config.currencySymbol) },
    { key: 'pnl', title: '盈亏', render: (_: unknown, row: { pnl: number }) => (
      <strong style={{ color: row.pnl >= 0 ? config.upColor : config.downColor }}>
        {formatMoney(row.pnl, config.currencySymbol)}
      </strong>
    )},
  ];

  const monthColumns = [
    { key: 'month', title: '月份', render: (_: unknown, row: { month: string }) => row.month },
    { key: 'tradeCount', title: '交易数', render: (_: unknown, row: { tradeCount: number }) => row.tradeCount },
    { key: 'fees', title: '手续费', render: (_: unknown, row: { fees: number }) => formatMoney(row.fees, config.currencySymbol) },
    { key: 'pnl', title: '盈亏', render: (_: unknown, row: { pnl: number }) => (
      <strong style={{ color: row.pnl >= 0 ? config.upColor : config.downColor }}>
        {formatMoney(row.pnl, config.currencySymbol)}
      </strong>
    )},
  ];

  const positionColumns = [
    { key: 'symbol', title: '标的', render: (_: unknown, row: { symbol: string; name: string }) => (
      <div>
        <strong>{row.symbol}</strong>
        <span style={{ color: 'var(--color-ink-mute)', fontSize: 'var(--fs-caption)' }}>{row.name}</span>
      </div>
    )},
    { key: 'side', title: '方向', render: (_: unknown, row: { side: 'buy' | 'sell' }) => (
      <Tag tone={row.side === 'buy' ? 'green' : 'red'}>
        {row.side === 'buy' ? '买入' : '卖出'}
      </Tag>
    )},
    { key: 'quantity', title: '数量', render: (_: unknown, row: { quantity: number }) => `${row.quantity} ${config.quantityUnit}` },
    { key: 'avgCost', title: '成本价', render: (_: unknown, row: { avgCost: number }) => formatMoney(row.avgCost, config.currencySymbol, 2) },
    { key: 'currentPrice', title: '现价', render: (_: unknown, row: { currentPrice: number }) => formatMoney(row.currentPrice, config.currencySymbol, 2) },
    { key: 'unrealizedPnl', title: '浮动盈亏', render: (_: unknown, row: { unrealizedPnl: number }) => (
      <strong style={{ color: row.unrealizedPnl >= 0 ? config.upColor : config.downColor }}>
        {formatMoney(row.unrealizedPnl, config.currencySymbol)}
      </strong>
    )},
    { key: 'unrealizedPnlPercent', title: '盈亏比例', render: (_: unknown, row: { unrealizedPnlPercent: number }) => (
      <strong style={{ color: row.unrealizedPnlPercent >= 0 ? config.upColor : config.downColor }}>
        {formatPercent(row.unrealizedPnlPercent)}
      </strong>
    )},
  ];

  return (
    <div>
      <SectionCard title="概览">
        <div className="invest-stat-grid">
          {statCards.map((card) => (
            <div key={card.label} className="invest-stat-card">
              <div className="invest-stat-label">{card.label}</div>
              <div className="invest-stat-value" style={card.color ? { color: card.color } : {}}>
                {card.value}
              </div>
              {card.subtext && <div className="invest-stat-sub">{card.subtext}</div>}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="盈亏统计">
        <div className="invest-pnl-grid">
          {pnlCards.map((card) => (
            <div key={card.label} className="invest-pnl-card">
              <div className="invest-pnl-label">{card.label}</div>
              <div className="invest-pnl-value" style={{ color: card.color }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {summary.bestTradePnl !== 0 || summary.worstTradePnl !== 0 ? (
        <SectionCard title="交易统计">
          <div className="invest-trade-stats-grid">
            {tradeStatsCards.map((card) => (
              <div key={card.label} className="invest-stat-card">
                <div className="invest-stat-label">{card.label}</div>
                <div className="invest-stat-value" style={{ color: card.color }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {summary.positions.length > 0 && (
        <SectionCard title="持仓明细">
          <DataTable columns={positionColumns} data={summary.positions} rowKey="key" />
        </SectionCard>
      )}

      {summary.platformPnl.length > 0 && (
        <SectionCard title="按平台统计">
          <DataTable columns={platformColumns} data={summary.platformPnl} rowKey="platformName" />
        </SectionCard>
      )}

      {summary.symbolPnl.length > 0 && (
        <SectionCard title="按标的统计">
          <DataTable columns={symbolColumns} data={summary.symbolPnl} rowKey="symbol" />
        </SectionCard>
      )}

      {summary.monthlyPnl.length > 0 && (
        <SectionCard title="按月统计">
          <DataTable columns={monthColumns} data={summary.monthlyPnl} rowKey="month" />
        </SectionCard>
      )}
    </div>
  );
}