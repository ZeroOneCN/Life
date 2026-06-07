import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, PageHeader, SectionCard, StatGrid } from '../page';
import {
  Btn,
  DataTable,
  DeleteModal,
  Field,
  Modal,
  Pagination,
  PillTabs,
  SelectField,
  Tag,
  TextArea,
  Toast,
  useToastState,
} from '../ui';
import {
  buildDashboardSummary,
  buildPositions,
  estimatePnl,
  formatInvestmentMoney,
  formatInvestmentPercent,
} from '../../services/investmentCalc';
import {
  closeTrade,
  createCapitalFlow,
  createTrade,
  deleteCapitalFlow,
  deleteTrade,
  listCapitalFlows,
  listTrades,
  reopenTrade,
  seedSampleData,
  updateCapitalFlow,
  updateTrade,
} from '../../services/investmentStorage';
import {
  type InvestmentCapitalFlow,
  type InvestmentCapitalFlowDraft,
  type InvestmentMarket,
  type InvestmentMarketConfig,
  type InvestmentTab,
  type InvestmentTrade,
  type InvestmentTradeDraft,
  INVESTMENT_MARKET_CONFIG,
} from '../../types/investment';
import { CHART_CATEGORY_8 } from '../../lib/chartPalette';

interface InvestmentTradePageProps {
  market: InvestmentMarket;
}

const PAGE_SIZE = 10;

const TAB_OPTIONS: Array<{ value: InvestmentTab; label: string }> = [
  { value: 'dashboard', label: '统计看板' },
  { value: 'positions', label: '当前持仓' },
  { value: 'trades', label: '交易记录' },
  { value: 'capital', label: '出入金' },
];

// ============================================
// 表单状态
// ============================================
interface TradeFormState {
  symbol: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string;
  fee: string;
  tradeDate: string;
  tags: string;
  remark: string;
}

function createDefaultTradeForm(): TradeFormState {
  return {
    symbol: '',
    name: '',
    side: 'buy',
    quantity: '',
    price: '',
    fee: '',
    tradeDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    tags: '',
    remark: '',
  };
}

interface CapitalFormState {
  flowDate: string;
  flowType: 'deposit' | 'withdrawal';
  amount: string;
  remark: string;
}

function createDefaultCapitalForm(): CapitalFormState {
  return {
    flowDate: dayjs().format('YYYY-MM-DD'),
    flowType: 'deposit',
    amount: '',
    remark: '',
  };
}

// ============================================
// 主组件
// ============================================
export function InvestmentTradePage({ market }: InvestmentTradePageProps) {
  const config = INVESTMENT_MARKET_CONFIG[market];
  const [tab, setTab] = useState<InvestmentTab>('dashboard');
  const [trades, setTrades] = useState<InvestmentTrade[]>([]);
  const [capitalFlows, setCapitalFlows] = useState<InvestmentCapitalFlow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const { toast, showToast } = useToastState();

  useEffect(() => {
    setTrades(listTrades(market));
    setCapitalFlows(listCapitalFlows(market));
  }, [market, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const positions = useMemo(() => buildPositions(trades), [trades]);
  const summary = useMemo(
    () => buildDashboardSummary(trades, capitalFlows, market),
    [trades, capitalFlows, market],
  );

  const handleSeed = () => {
    const hasData = trades.length > 0 || capitalFlows.length > 0;
    if (hasData && !window.confirm('已有数据，确认覆盖为示例数据吗？')) return;
    const result = seedSampleData(market);
    showToast(`已植入示例：${result.trades} 笔交易 + ${result.flows} 笔出入金。`);
    reload();
  };

  return (
    <div className="invest-trade-page" style={{
      '--invest-accent': config.accent,
      '--invest-accent-soft': config.accentSoft,
      '--invest-up': config.upColor,
      '--invest-down': config.downColor,
    } as React.CSSProperties}>
      <PageHeader
        title={config.name}
        subtitle={`${config.shortName} · 计价 ${config.currencyCode} · 记录你的每一笔实盘单子并自动算盈亏`}
      />

      <div className="invest-trade-meta">
        <span className="tag tag-orange">本地存储 · LocalStorage</span>
        <span className="invest-trade-meta-divider">·</span>
        <span>共 {trades.length} 笔交易 · {positions.length} 个持仓 · {capitalFlows.length} 笔出入金</span>
        <span className="invest-trade-spacer" />
        <Btn tone="ghost" onClick={handleSeed}>载入示例数据</Btn>
      </div>

      <StatGrid
        items={[
          {
            label: '净入金',
            value: formatInvestmentMoney(summary.netCapital, config.currencySymbol),
            helper: `入金 ${formatInvestmentMoney(summary.totalDeposit, config.currencySymbol)} · 出金 ${formatInvestmentMoney(summary.totalWithdrawal, config.currencySymbol)}`,
          },
          {
            label: '已实现盈亏',
            value: formatInvestmentMoney(summary.realizedPnl, config.currencySymbol),
            accent: summary.realizedPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            helper: `手续费合计 ${formatInvestmentMoney(summary.totalFees, config.currencySymbol)}`,
          },
          {
            label: '浮盈',
            value: formatInvestmentMoney(summary.unrealizedPnl, config.currencySymbol),
            accent: summary.unrealizedPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            helper: `当前持仓 ${summary.openPositionsCount} 个`,
          },
          {
            label: 'ROI',
            value: formatInvestmentPercent(summary.roi),
            accent: summary.roi >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            helper: `胜率 ${(summary.winRate * 100).toFixed(0)}% · 盈亏比 ${summary.profitFactor.toFixed(2)}`,
          },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="看板聚合自全部交易与出入金；持仓/交易/出入金三个 tab 负责录入与维护。"
      >
        <PillTabs
          options={TAB_OPTIONS}
          value={tab}
          onChange={(value) => setTab(value as InvestmentTab)}
        />
      </SectionCard>

      {tab === 'dashboard' ? (
        <DashboardView summary={summary} config={config} trades={trades} positions={positions} />
      ) : null}

      {tab === 'positions' ? (
        <PositionsView
          positions={positions}
          trades={trades}
          config={config}
          onCloseTrade={(tradeId, closePrice) => {
            closeTrade(market, tradeId, closePrice, dayjs().format('YYYY-MM-DD HH:mm:ss'));
            showToast('已平仓，盈亏已计入已实现。');
            reload();
          }}
          onReopenTrade={(tradeId) => {
            reopenTrade(market, tradeId);
            showToast('已重开为持仓中。');
            reload();
          }}
          onDeleteTrade={(tradeId) => {
            deleteTrade(market, tradeId);
            showToast('记录已删除。');
            reload();
          }}
        />
      ) : null}

      {tab === 'trades' ? (
        <TradesView
          trades={trades}
          config={config}
          onCreateTrade={(draft) => {
            createTrade(draft);
            showToast('交易已保存。');
            reload();
          }}
          onUpdateTrade={(id, patch) => {
            updateTrade(market, id, patch);
            showToast('交易已更新。');
            reload();
          }}
          onDeleteTrade={(id) => {
            deleteTrade(market, id);
            showToast('交易已删除。');
            reload();
          }}
          onCloseTrade={(tradeId, closePrice) => {
            closeTrade(market, tradeId, closePrice, dayjs().format('YYYY-MM-DD HH:mm:ss'));
            showToast('已平仓。');
            reload();
          }}
          onReopenTrade={(tradeId) => {
            reopenTrade(market, tradeId);
            showToast('已重开。');
            reload();
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'capital' ? (
        <CapitalView
          capitalFlows={capitalFlows}
          config={config}
          summary={summary}
          onCreate={(draft) => {
            createCapitalFlow(draft);
            showToast('出入金已保存。');
            reload();
          }}
          onUpdate={(id, patch) => {
            updateCapitalFlow(market, id, patch);
            showToast('出入金已更新。');
            reload();
          }}
          onDelete={(id) => {
            deleteCapitalFlow(market, id);
            showToast('出入金已删除。');
            reload();
          }}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}

// ============================================
// Dashboard View
// ============================================
function DashboardView({
  summary,
  config,
  trades,
  positions,
}: {
  summary: ReturnType<typeof buildDashboardSummary>;
  config: InvestmentMarketConfig;
  trades: InvestmentTrade[];
  positions: ReturnType<typeof buildPositions>;
}) {
  const symbolColors = [...CHART_CATEGORY_8];
  const maxPnl = Math.max(...summary.symbolPnl.map((s) => Math.abs(s.pnl)), 1);

  if (trades.length === 0) {
    return (
      <SectionCard title="统计看板" description="录入交易后会开始计算所有统计。">
        <EmptyState
          title="还没有交易记录"
          description={`点击页面顶部「载入示例数据」快速体验，或切到「交易记录」开始录入你的第一笔${config.name}实盘单。`}
          icon="📈"
        />
      </SectionCard>
    );
  }

  return (
    <div className="invest-trade-dashboard">
      <SectionCard title="资金概览" description="净入金、当前现金、可用余额、ROI 走势">
        <div className="invest-capital-grid">
          <div className="invest-capital-cell">
            <span>累计入金</span>
            <strong>{formatInvestmentMoney(summary.totalDeposit, config.currencySymbol)}</strong>
          </div>
          <div className="invest-capital-cell">
            <span>累计出金</span>
            <strong>{formatInvestmentMoney(summary.totalWithdrawal, config.currencySymbol)}</strong>
          </div>
          <div className="invest-capital-cell">
            <span>净入金</span>
            <strong>{formatInvestmentMoney(summary.netCapital, config.currencySymbol)}</strong>
          </div>
          <div className="invest-capital-cell">
            <span>已用资金</span>
            <strong>{formatInvestmentMoney(summary.netCapital - summary.cash, config.currencySymbol)}</strong>
          </div>
          <div className="invest-capital-cell invest-capital-cell-accent">
            <span>当前现金</span>
            <strong>{formatInvestmentMoney(summary.cash, config.currencySymbol)}</strong>
            <small>现金 = 净入金 − 持仓总成本</small>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="按标的盈亏" description="已实现盈亏排行（仅统计已平仓）">
        {summary.symbolPnl.length === 0 ? (
          <EmptyState title="尚无已平仓交易" description="平仓后这里会开始形成排行。" icon="🎯" />
        ) : (
          <ul className="invest-symbol-list">
            {summary.symbolPnl.map((item, index) => {
              const isUp = item.pnl >= 0;
              const color = isUp ? config.upColor : config.downColor;
              const widthPct = Math.min(100, (Math.abs(item.pnl) / maxPnl) * 100);
              return (
                <li key={item.symbol} className="invest-symbol-row">
                  <span className="invest-symbol-rank" style={{ background: symbolColors[index % symbolColors.length] }}>
                    {index + 1}
                  </span>
                  <div className="invest-symbol-main">
                    <strong>{item.symbol}</strong>
                    <span>{item.name}</span>
                  </div>
                  <div className="invest-symbol-bar">
                    <div
                      className="invest-symbol-bar-fill"
                      style={{ width: `${widthPct}%`, background: color }}
                    />
                  </div>
                  <div className="invest-symbol-value">
                    <strong style={{ color }}>
                      {formatInvestmentMoney(item.pnl, config.currencySymbol)}
                    </strong>
                    <span>{item.trades} 笔</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="月度盈亏" description="按月聚合的已实现盈亏">
        {summary.monthlyPnl.length === 0 ? (
          <EmptyState title="暂无月度数据" description="开始交易后会按月聚合。" />
        ) : (
          <div className="invest-month-chart">
            {summary.monthlyPnl.map((m) => {
              const isUp = m.pnl >= 0;
              const color = isUp ? config.upColor : config.downColor;
              const heightPct = Math.min(100, (Math.abs(m.pnl) / maxPnl) * 100);
              return (
                <div className="invest-month-col" key={m.month}>
                  <div className="invest-month-bar-wrap">
                    <div
                      className="invest-month-bar"
                      style={{ height: `${heightPct}%`, background: color }}
                      title={`${m.month} · ${formatInvestmentMoney(m.pnl, config.currencySymbol)}`}
                    />
                  </div>
                  <span className="invest-month-label">{m.month.slice(2)}</span>
                  <span className="invest-month-value" style={{ color }}>
                    {formatInvestmentMoney(m.pnl, config.currencySymbol, 0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="P&L 区间分布" description="按盈亏金额分桶统计">
        <ul className="invest-bucket-list">
          {summary.pnlBuckets.map((bucket) => {
            const isUp = bucket.pnl >= 0;
            const color = isUp ? config.upColor : config.downColor;
            return (
              <li key={bucket.range} className="invest-bucket-row">
                <span className="invest-bucket-range">{bucket.range}</span>
                <div className="invest-bucket-bar">
                  <div
                    className="invest-bucket-bar-fill"
                    style={{
                      width: `${Math.min(100, (bucket.count / Math.max(1, summary.closedTradesCount)) * 100)}%`,
                      background: color,
                    }}
                  />
                </div>
                <span className="invest-bucket-count">{bucket.count} 笔</span>
                <span className="invest-bucket-pnl" style={{ color }}>
                  {formatInvestmentMoney(bucket.pnl, config.currencySymbol, 0)}
                </span>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      <SectionCard title="净值曲线" description="按已平仓时间累加的 P&L 走势">
        {summary.equityCurve.length === 0 ? (
          <EmptyState title="尚未有平仓交易" description="开始平仓后这里会画出累计 P&L 曲线。" icon="📉" />
        ) : (
          <EquityCurve
            points={summary.equityCurve}
            color={config.accent}
            currencySymbol={config.currencySymbol}
          />
        )}
      </SectionCard>

      <SectionCard title="交易风格" description="胜率、盈亏比、平均持仓天数与极值">
        <div className="invest-style-grid">
          <div className="invest-style-cell">
            <span>胜率</span>
            <strong>{(summary.winRate * 100).toFixed(0)}%</strong>
          </div>
          <div className="invest-style-cell">
            <span>盈亏比</span>
            <strong>{summary.profitFactor.toFixed(2)}</strong>
          </div>
          <div className="invest-style-cell">
            <span>平均持仓天数</span>
            <strong>{summary.averageHoldDays.toFixed(1)} 天</strong>
          </div>
          <div className="invest-style-cell">
            <span>最佳单笔</span>
            <strong style={{ color: config.upColor }}>
              {formatInvestmentMoney(summary.bestTradePnl, config.currencySymbol)}
            </strong>
          </div>
          <div className="invest-style-cell">
            <span>最差单笔</span>
            <strong style={{ color: config.downColor }}>
              {formatInvestmentMoney(summary.worstTradePnl, config.currencySymbol)}
            </strong>
          </div>
          <div className="invest-style-cell">
            <span>总交易数</span>
            <strong>{summary.totalTrades}</strong>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ============================================
// Equity Curve (纯 SVG 折线)
// ============================================
function EquityCurve({
  points,
  color,
  currencySymbol,
}: {
  points: Array<{ date: string; value: number }>;
  color: string;
  currencySymbol: string;
}) {
  const width = 800;
  const height = 200;
  const padding = 24;
  const values = points.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / Math.max(1, points.length - 1);

  const linePath = points
    .map((p, i) => {
      const x = padding + i * stepX;
      const y = height - padding - ((p.value - min) / range) * (height - padding * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const fillPath = `${linePath} L${padding + (points.length - 1) * stepX},${height - padding} L${padding},${height - padding} Z`;
  const zeroY = height - padding - ((0 - min) / range) * (height - padding * 2);

  return (
    <div className="invest-equity-curve">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height}>
        <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="var(--color-hairline)" strokeDasharray="3 3" />
        <path d={fillPath} fill={color} opacity="0.12" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const x = padding + i * stepX;
          const y = height - padding - ((p.value - min) / range) * (height - padding * 2);
          return (
            <circle key={p.date} cx={x} cy={y} r="3" fill={color}>
              <title>{`${p.date} · ${formatInvestmentMoney(p.value, currencySymbol)}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

// ============================================
// Positions View
// ============================================
function PositionsView({
  positions,
  trades,
  config,
  onCloseTrade,
  onReopenTrade,
  onDeleteTrade,
}: {
  positions: ReturnType<typeof buildPositions>;
  trades: InvestmentTrade[];
  config: InvestmentMarketConfig;
  onCloseTrade: (tradeId: string, closePrice: number) => void;
  onReopenTrade: (tradeId: string) => void;
  onDeleteTrade: (tradeId: string) => void;
}) {
  const openTrades = trades.filter((t) => t.status === 'open');
  const [closingTrade, setClosingTrade] = useState<InvestmentTrade | null>(null);
  const [closePrice, setClosePrice] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  return (
    <div className="invest-trade-stack">
      <SectionCard
        title="当前持仓"
        description={`共 ${positions.length} 个聚合持仓 · 按市场价值降序`}
      >
        {positions.length === 0 ? (
          <EmptyState title="当前无持仓" description="新建一笔 open 状态的交易会出现在这里。" icon="📊" />
        ) : (
          <div className="invest-position-grid">
            {positions.map((pos) => {
              const isUp = pos.unrealizedPnl >= 0;
              const color = isUp ? config.upColor : config.downColor;
              return (
                <article className="invest-position-card" key={`${pos.symbol}-${pos.side}`}>
                  <div className="invest-position-head">
                    <div>
                      <strong>{pos.symbol}</strong>
                      <span>{pos.name}</span>
                    </div>
                    <Tag tone={pos.side === 'buy' ? 'green' : 'red'}>
                      {pos.side === 'buy' ? '做多' : '做空'}
                    </Tag>
                  </div>
                  <div className="invest-position-stats">
                    <div>
                      <span>持仓数量</span>
                      <strong>{pos.quantity} {config.quantityUnit}</strong>
                    </div>
                    <div>
                      <span>平均成本</span>
                      <strong>{formatInvestmentMoney(pos.avgCost, config.currencySymbol, config.priceDecimals)}</strong>
                    </div>
                    <div>
                      <span>当前价</span>
                      <strong>{formatInvestmentMoney(pos.currentPrice, config.currencySymbol, config.priceDecimals)}</strong>
                    </div>
                  </div>
                  <div className="invest-position-value">
                    <div>
                      <span>市值</span>
                      <strong>{formatInvestmentMoney(pos.marketValue, config.currencySymbol)}</strong>
                    </div>
                    <div>
                      <span>浮盈</span>
                      <strong style={{ color }}>
                        {formatInvestmentMoney(pos.unrealizedPnl, config.currencySymbol)}
                      </strong>
                      <small style={{ color }}>{formatInvestmentPercent(pos.unrealizedPnlPercent)}</small>
                    </div>
                  </div>
                  <div className="invest-position-foot">
                    <span>{pos.tradeIds.length} 笔交易 · 始于 {pos.openedAt.slice(0, 10)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="未平仓交易"
        description="每笔 open 状态的交易，可以单独平仓或重开"
      >
        {openTrades.length === 0 ? (
          <EmptyState title="没有未平仓交易" description="录入的交易会出现在这里。" />
        ) : (
          <ul className="invest-open-list">
            {openTrades.map((trade) => (
              <li key={trade.id} className="invest-open-item">
                <div className="invest-open-main">
                  <span className="invest-open-symbol">{trade.symbol}</span>
                  <span className="invest-open-name">{trade.name}</span>
                  <Tag tone={trade.side === 'buy' ? 'green' : 'red'}>
                    {trade.side === 'buy' ? '买入' : '卖出'}
                  </Tag>
                </div>
                <span className="invest-open-meta">
                  {trade.quantity} @ {formatInvestmentMoney(trade.price, config.currencySymbol, config.priceDecimals)} · {trade.tradeDate}
                </span>
                <div className="invest-open-actions">
                  <Btn tone="primary" onClick={() => { setClosingTrade(trade); setClosePrice(String(trade.currentPrice ?? trade.price)); }}>
                    平仓
                  </Btn>
                  <Btn tone="danger" onClick={() => setPendingDeleteId(trade.id)}>删除</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Modal
        open={Boolean(closingTrade)}
        onClose={() => setClosingTrade(null)}
        title="平仓"
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setClosingTrade(null)}>取消</Btn>
            <Btn
              tone="primary"
              onClick={() => {
                if (closingTrade) {
                  const price = Number(closePrice);
                  if (Number.isFinite(price) && price > 0) {
                    onCloseTrade(closingTrade.id, price);
                    setClosingTrade(null);
                  }
                }
              }}
            >
              确认平仓
            </Btn>
          </>
        )}
      >
        {closingTrade ? (
          <div className="invest-close-form">
            <p>
              平仓 <strong>{closingTrade.symbol} {closingTrade.name}</strong>：
              持仓 {closingTrade.quantity} {config.quantityUnit} @ {formatInvestmentMoney(closingTrade.price, config.currencySymbol, config.priceDecimals)}
            </p>
            <Field
              label="平仓价格"
              value={closePrice}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setClosePrice(event.target.value)}
            />
            {(() => {
              const closePx = Number(closePrice);
              if (!Number.isFinite(closePx) || closePx <= 0) return null;
              const pnl = estimatePnl(closingTrade.side, closingTrade.price, closingTrade.quantity, closePx, closingTrade.fee, 0);
              return (
                <p className="invest-close-preview">
                  预估盈亏：<strong style={{ color: pnl >= 0 ? config.upColor : config.downColor }}>
                    {formatInvestmentMoney(pnl, config.currencySymbol)}
                  </strong>
                </p>
              );
            })()}
          </div>
        ) : null}
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        title="删除交易"
        onConfirm={() => {
          if (pendingDeleteId) onDeleteTrade(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      >
        这笔交易会被永久删除，相关的持仓/统计会重算。
      </DeleteModal>
    </div>
  );
}

// ============================================
// Trades View (CRUD)
// ============================================
function TradesView({
  trades,
  config,
  onCreateTrade,
  onUpdateTrade,
  onDeleteTrade,
  onCloseTrade,
  onReopenTrade,
  showToast,
}: {
  trades: InvestmentTrade[];
  config: InvestmentMarketConfig;
  onCreateTrade: (draft: InvestmentTradeDraft) => void;
  onUpdateTrade: (id: string, patch: Partial<InvestmentTradeDraft>) => void;
  onDeleteTrade: (id: string) => void;
  onCloseTrade: (tradeId: string, closePrice: number) => void;
  onReopenTrade: (tradeId: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}) {
  const [form, setForm] = useState<TradeFormState>(createDefaultTradeForm);
  const [editingRecord, setEditingRecord] = useState<InvestmentTrade | null>(null);
  const [editingForm, setEditingForm] = useState<TradeFormState>(createDefaultTradeForm);
  const [closingTrade, setClosingTrade] = useState<InvestmentTrade | null>(null);
  const [closePrice, setClosePrice] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [sideFilter, setSideFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [keyword, sideFilter, statusFilter]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return trades.filter((t) => {
      if (sideFilter && t.side !== sideFilter) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (kw) {
        const hay = `${t.symbol} ${t.name} ${t.remark} ${t.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [trades, keyword, sideFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  // 自动算手续费
  const computedFee = useMemo(() => {
    const q = Number(form.quantity);
    const p = Number(form.price);
    if (q > 0 && p > 0) {
      return Math.abs(q * p * config.feeRate);
    }
    return 0;
  }, [form.quantity, form.price, config.feeRate]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = Number(form.quantity);
    const p = Number(form.price);
    if (!form.symbol.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) {
      showToast('请补全标的、数量与价格。', 'error');
      return;
    }
    const matched = config.defaultSymbols.find((s) => s.symbol.toUpperCase() === form.symbol.trim().toUpperCase());
    const draft: InvestmentTradeDraft = {
      market: config.id,
      symbol: form.symbol.trim().toUpperCase(),
      name: form.name.trim() || matched?.name || form.symbol.trim().toUpperCase(),
      side: form.side,
      quantity: q,
      price: p,
      fee: form.fee ? Number(form.fee) : computedFee,
      tradeDate: form.tradeDate,
      currentPrice: matched?.mockPrice,
      status: 'open',
      tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      remark: form.remark.trim(),
    };
    onCreateTrade(draft);
    setForm(createDefaultTradeForm());
  };

  const handleUpdate = () => {
    if (!editingRecord) return;
    const q = Number(editingForm.quantity);
    const p = Number(editingForm.price);
    if (!editingForm.symbol.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) {
      showToast('请补全编辑中的字段。', 'error');
      return;
    }
    onUpdateTrade(editingRecord.id, {
      symbol: editingForm.symbol.trim().toUpperCase(),
      name: editingForm.name.trim() || editingForm.symbol.trim().toUpperCase(),
      side: editingForm.side,
      quantity: q,
      price: p,
      fee: editingForm.fee ? Number(editingForm.fee) : computedFee,
      tradeDate: editingForm.tradeDate,
      tags: editingForm.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      remark: editingForm.remark.trim(),
    });
    setEditingRecord(null);
    setEditingForm(createDefaultTradeForm());
  };

  const columns = useMemo(() => [
    { key: 'tradeDate', title: '时间', dataIndex: 'tradeDate' as const },
    {
      key: 'symbol',
      title: '标的',
      render: (_: unknown, row: InvestmentTrade) => (
        <div>
          <strong>{row.symbol}</strong>
          <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-ink-mute)' }}>{row.name}</div>
        </div>
      ),
    },
    {
      key: 'side',
      title: '方向',
      render: (_: unknown, row: InvestmentTrade) => (
        <Tag tone={row.side === 'buy' ? 'green' : 'red'}>
          {row.side === 'buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      key: 'quantity',
      title: '数量',
      render: (_: unknown, row: InvestmentTrade) => `${row.quantity} ${config.quantityUnit}`,
    },
    {
      key: 'price',
      title: '成交价',
      render: (_: unknown, row: InvestmentTrade) =>
        formatInvestmentMoney(row.price, config.currencySymbol, config.priceDecimals),
    },
    {
      key: 'fee',
      title: '手续费',
      render: (_: unknown, row: InvestmentTrade) => formatInvestmentMoney(row.fee, config.currencySymbol, 2),
    },
    {
      key: 'status',
      title: '状态',
      render: (_: unknown, row: InvestmentTrade) =>
        row.status === 'open' ? (
          <Tag tone="blue">持仓中</Tag>
        ) : (
          <Tag tone="green">已平仓</Tag>
        ),
    },
    {
      key: 'pnl',
      title: '盈亏',
      render: (_: unknown, row: InvestmentTrade) => {
        if (row.status === 'closed' && typeof row.realizedPnl === 'number') {
          return (
            <strong style={{ color: row.realizedPnl >= 0 ? config.upColor : config.downColor }}>
              {formatInvestmentMoney(row.realizedPnl, config.currencySymbol)}
            </strong>
          );
        }
        return <span style={{ color: 'var(--color-ink-mute)' }}>—</span>;
      },
    },
    {
      key: 'remark',
      title: '备注/标签',
      render: (_: unknown, row: InvestmentTrade) => (
        <div>
          {row.tags.length > 0 ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 2 }}>
              {row.tags.map((tag) => (
                <span key={tag} className="tag tag-blue tag-sm">{tag}</span>
              ))}
            </div>
          ) : null}
          <span style={{ color: 'var(--color-ink-mute)' }}>{row.remark || '—'}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (_: unknown, row: InvestmentTrade) => (
        <div className="fitness-row-actions">
          {row.status === 'open' ? (
            <Btn
              tone="primary"
              onClick={() => { setClosingTrade(row); setClosePrice(String(row.currentPrice ?? row.price)); }}
            >
              平仓
            </Btn>
          ) : (
            <Btn tone="secondary" onClick={() => onReopenTrade(row.id)}>重开</Btn>
          )}
          <Btn tone="secondary" onClick={() => {
            setEditingRecord(row);
            setEditingForm({
              symbol: row.symbol,
              name: row.name,
              side: row.side,
              quantity: String(row.quantity),
              price: String(row.price),
              fee: String(row.fee),
              tradeDate: row.tradeDate,
              tags: row.tags.join(', '),
              remark: row.remark,
            });
          }}>编辑</Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(row.id)}>删除</Btn>
        </div>
      ),
    },
  ], [config]);

  return (
    <div className="invest-trade-stack">
      <SectionCard
        title="新增交易"
        description={`${config.name} · 单位 ${config.quantityUnit} · 计价 ${config.currencyCode} · 默认手续费率 ${(config.feeRate * 100).toFixed(2)}%`}
      >
        <form className="invest-trade-form" onSubmit={handleSubmit}>
          <SelectField
            label="标的"
            value={form.symbol}
            onChange={(event) => {
              const symbol = event.target.value;
              const matched = config.defaultSymbols.find((s) => s.symbol === symbol);
              setForm((current) => ({
                ...current,
                symbol,
                name: matched?.name ?? current.name,
                price: matched && !current.price ? String(matched.mockPrice) : current.price,
              }));
            }}
          >
            <option value="">选择 / 输入标的</option>
            {config.defaultSymbols.map((s) => (
              <option key={s.symbol} value={s.symbol}>{s.symbol} · {s.name}</option>
            ))}
          </SelectField>
          <Field
            label="名称(选填)"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="留空则使用标的默认名"
          />
          <SelectField
            label="方向"
            value={form.side}
            onChange={(event) => setForm((current) => ({ ...current, side: event.target.value as 'buy' | 'sell' }))}
          >
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </SelectField>
          <Field
            label={`数量 (${config.quantityUnit})`}
            value={form.quantity}
            onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
            placeholder="0.01"
          />
          <Field
            label="成交价"
            value={form.price}
            onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
            placeholder={config.priceDecimals === 4 ? '0.0000' : '0.00'}
          />
          <Field
            label={`手续费(默认 ${computedFee.toFixed(2)})`}
            value={form.fee}
            onChange={(event) => setForm((current) => ({ ...current, fee: event.target.value }))}
            placeholder={computedFee.toFixed(2)}
          />
          <Field
            label="时间 (YYYY-MM-DD HH:mm:ss)"
            value={form.tradeDate}
            onChange={(event) => setForm((current) => ({ ...current, tradeDate: event.target.value }))}
          />
          <Field
            label="标签 (逗号分隔)"
            value={form.tags}
            onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
            placeholder="建仓, 突破"
          />
          <Field
            label="备注"
            value={form.remark}
            onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
            placeholder="入场理由 / 复盘要点"
          />
          <div className="invest-form-actions">
            <Btn tone="primary" type="submit">保存交易</Btn>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="交易记录"
        description={`共 ${trades.length} 笔 · 按时间倒序 · 每页 ${PAGE_SIZE} 条`}
      >
        <div className="invest-filter-grid">
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索标的、标签或备注"
          />
          <SelectField label="方向" value={sideFilter} onChange={(event) => setSideFilter(event.target.value)}>
            <option value="">全部方向</option>
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </SelectField>
          <SelectField label="状态" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">全部状态</option>
            <option value="open">持仓中</option>
            <option value="closed">已平仓</option>
          </SelectField>
        </div>

        {pageRecords.length === 0 ? (
          <EmptyState title="暂无交易记录" description="录入第一笔交易后会出现在这里。" />
        ) : (
          <>
            <DataTable columns={columns} data={pageRecords} rowKey="id" />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </SectionCard>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title="编辑交易"
        width={860}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingRecord(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleUpdate}>保存</Btn>
          </>
        )}
      >
        <div className="invest-trade-form invest-trade-form-modal">
          <Field label="标的" value={editingForm.symbol} onChange={(event) => setEditingForm((current) => ({ ...current, symbol: event.target.value }))} />
          <Field label="名称" value={editingForm.name} onChange={(event) => setEditingForm((current) => ({ ...current, name: event.target.value }))} />
          <SelectField label="方向" value={editingForm.side} onChange={(event) => setEditingForm((current) => ({ ...current, side: event.target.value as 'buy' | 'sell' }))}>
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </SelectField>
          <Field label="数量" value={editingForm.quantity} onChange={(event) => setEditingForm((current) => ({ ...current, quantity: event.target.value }))} />
          <Field label="成交价" value={editingForm.price} onChange={(event) => setEditingForm((current) => ({ ...current, price: event.target.value }))} />
          <Field label="手续费" value={editingForm.fee} onChange={(event) => setEditingForm((current) => ({ ...current, fee: event.target.value }))} />
          <Field label="时间" value={editingForm.tradeDate} onChange={(event) => setEditingForm((current) => ({ ...current, tradeDate: event.target.value }))} />
          <Field label="标签" value={editingForm.tags} onChange={(event) => setEditingForm((current) => ({ ...current, tags: event.target.value }))} />
          <TextArea label="备注" value={editingForm.remark} onChange={(event) => setEditingForm((current) => ({ ...current, remark: event.target.value }))} rows={3} />
        </div>
      </Modal>

      <Modal
        open={Boolean(closingTrade)}
        onClose={() => setClosingTrade(null)}
        title="平仓"
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setClosingTrade(null)}>取消</Btn>
            <Btn tone="primary" onClick={() => {
              if (closingTrade) {
                const price = Number(closePrice);
                if (Number.isFinite(price) && price > 0) {
                  onCloseTrade(closingTrade.id, price);
                  setClosingTrade(null);
                }
              }
            }}>确认平仓</Btn>
          </>
        )}
      >
        {closingTrade ? (
          <div className="invest-close-form">
            <p>
              <strong>{closingTrade.symbol}</strong> 持仓 {closingTrade.quantity} {config.quantityUnit} @ {formatInvestmentMoney(closingTrade.price, config.currencySymbol, config.priceDecimals)}
            </p>
            <Field label="平仓价格" value={closePrice} onChange={(event) => setClosePrice(event.target.value)} />
            {(() => {
              const px = Number(closePrice);
              if (!Number.isFinite(px) || px <= 0) return null;
              const pnl = estimatePnl(closingTrade.side, closingTrade.price, closingTrade.quantity, px, closingTrade.fee, 0);
              return (
                <p>预估盈亏：<strong style={{ color: pnl >= 0 ? config.upColor : config.downColor }}>{formatInvestmentMoney(pnl, config.currencySymbol)}</strong></p>
              );
            })()}
          </div>
        ) : null}
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        title="删除交易"
        onConfirm={() => {
          if (pendingDeleteId) onDeleteTrade(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      >
        这笔交易会从所有统计中移除，无法恢复。
      </DeleteModal>
    </div>
  );
}

// ============================================
// Capital View
// ============================================
function CapitalView({
  capitalFlows,
  config,
  summary,
  onCreate,
  onUpdate,
  onDelete,
  showToast,
}: {
  capitalFlows: InvestmentCapitalFlow[];
  config: InvestmentMarketConfig;
  summary: ReturnType<typeof buildDashboardSummary>;
  onCreate: (draft: InvestmentCapitalFlowDraft) => void;
  onUpdate: (id: string, patch: Partial<InvestmentCapitalFlowDraft>) => void;
  onDelete: (id: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}) {
  const [form, setForm] = useState<CapitalFormState>(createDefaultCapitalForm);
  const [editingRecord, setEditingRecord] = useState<InvestmentCapitalFlow | null>(null);
  const [editingForm, setEditingForm] = useState<CapitalFormState>(createDefaultCapitalForm);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('请补全金额。', 'error');
      return;
    }
    onCreate({
      market: config.id,
      flowDate: form.flowDate,
      flowType: form.flowType,
      amount,
      remark: form.remark.trim(),
    });
    setForm(createDefaultCapitalForm());
  };

  const columns = useMemo(() => [
    { key: 'flowDate', title: '日期', dataIndex: 'flowDate' as const },
    {
      key: 'flowType',
      title: '类型',
      render: (_: unknown, row: InvestmentCapitalFlow) => (
        <Tag tone={row.flowType === 'deposit' ? 'green' : 'orange'}>
          {row.flowType === 'deposit' ? '入金' : '出金'}
        </Tag>
      ),
    },
    {
      key: 'amount',
      title: '金额',
      render: (_: unknown, row: InvestmentCapitalFlow) => (
        <strong style={{ color: row.flowType === 'deposit' ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {`${row.flowType === 'deposit' ? '+' : '-'}${formatInvestmentMoney(row.amount, config.currencySymbol)}`}
        </strong>
      ),
    },
    { key: 'remark', title: '备注', render: (_: unknown, row: InvestmentCapitalFlow) => row.remark || '-' },
    {
      key: 'actions',
      title: '操作',
      render: (_: unknown, row: InvestmentCapitalFlow) => (
        <div className="fitness-row-actions">
          <Btn tone="secondary" onClick={() => {
            setEditingRecord(row);
            setEditingForm({
              flowDate: row.flowDate,
              flowType: row.flowType,
              amount: String(row.amount),
              remark: row.remark,
            });
          }}>编辑</Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(row.id)}>删除</Btn>
        </div>
      ),
    },
  ], [config]);

  return (
    <div className="invest-trade-stack">
      <SectionCard title="资金概览" description="净入金、当前可用现金与已用资金">
        <div className="invest-capital-grid">
          <div className="invest-capital-cell">
            <span>累计入金</span>
            <strong>{formatInvestmentMoney(summary.totalDeposit, config.currencySymbol)}</strong>
          </div>
          <div className="invest-capital-cell">
            <span>累计出金</span>
            <strong>{formatInvestmentMoney(summary.totalWithdrawal, config.currencySymbol)}</strong>
          </div>
          <div className="invest-capital-cell">
            <span>净入金</span>
            <strong>{formatInvestmentMoney(summary.netCapital, config.currencySymbol)}</strong>
          </div>
          <div className="invest-capital-cell invest-capital-cell-accent">
            <span>当前现金</span>
            <strong>{formatInvestmentMoney(summary.cash, config.currencySymbol)}</strong>
            <small>实时联动出入金与持仓</small>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="新增出入金" description="出入金会自动影响净入金和当前现金">
        <form className="invest-capital-form" onSubmit={handleSubmit}>
          <DatePickerField
            label="日期"
            value={form.flowDate}
            onChange={(value) => setForm((current) => ({ ...current, flowDate: value }))}
          />
          <SelectField
            label="类型"
            value={form.flowType}
            onChange={(event) => setForm((current) => ({ ...current, flowType: event.target.value as 'deposit' | 'withdrawal' }))}
          >
            <option value="deposit">入金</option>
            <option value="withdrawal">出金</option>
          </SelectField>
          <Field
            label={`金额 (${config.currencyCode})`}
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="5000"
          />
          <Field
            label="备注"
            value={form.remark}
            onChange={(event) => setForm((current) => ({ ...current, remark: event.target.value }))}
            placeholder="例如：初始入金"
          />
          <div className="invest-form-actions">
            <Btn tone="primary" type="submit">保存</Btn>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="出入金记录" description={`共 ${capitalFlows.length} 笔 · 按日期倒序`}>
        {capitalFlows.length === 0 ? (
          <EmptyState title="暂无出入金记录" description="先录入一笔出入金会出现在这里。" />
        ) : (
          <DataTable columns={columns} data={capitalFlows} rowKey="id" />
        )}
      </SectionCard>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title="编辑出入金"
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingRecord(null)}>取消</Btn>
            <Btn tone="primary" onClick={() => {
              if (!editingRecord) return;
              const amount = Number(editingForm.amount);
              if (!Number.isFinite(amount) || amount <= 0) {
                showToast('金额无效。', 'error');
                return;
              }
              onUpdate(editingRecord.id, {
                flowDate: editingForm.flowDate,
                flowType: editingForm.flowType,
                amount,
                remark: editingForm.remark.trim(),
              });
              setEditingRecord(null);
            }}>保存</Btn>
          </>
        )}
      >
        <div className="invest-capital-form">
          <DatePickerField label="日期" value={editingForm.flowDate} onChange={(value) => setEditingForm((current) => ({ ...current, flowDate: value }))} />
          <SelectField label="类型" value={editingForm.flowType} onChange={(event) => setEditingForm((current) => ({ ...current, flowType: event.target.value as 'deposit' | 'withdrawal' }))}>
            <option value="deposit">入金</option>
            <option value="withdrawal">出金</option>
          </SelectField>
          <Field label="金额" value={editingForm.amount} onChange={(event) => setEditingForm((current) => ({ ...current, amount: event.target.value }))} />
          <TextArea label="备注" value={editingForm.remark} onChange={(event) => setEditingForm((current) => ({ ...current, remark: event.target.value }))} rows={3} />
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        title="删除出入金"
        onConfirm={() => {
          if (pendingDeleteId) onDelete(pendingDeleteId);
          setPendingDeleteId(null);
        }}
      >
        删除后净入金、当前现金、ROI 都会重算。
      </DeleteModal>
    </div>
  );
}
