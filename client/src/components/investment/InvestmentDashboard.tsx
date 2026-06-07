import { CSSProperties, useMemo } from 'react';

import { PageHeader, SectionCard } from '../page';
import { INVESTMENT_ALERT_META, type InvestmentMarketId, type InvestmentTheme, type TickerPoint } from './investment-themes';

interface InvestmentDashboardProps {
  marketId: InvestmentMarketId;
  theme: InvestmentTheme;
}

// ============================================
// 工具：格式化数字
// ============================================
function formatCurrency(value: number, symbol: string, fractionDigits = 2): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  const sign = value < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

function formatPercent(value: number, fractionDigits = 2): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

function formatCompact(value: number, symbol: string): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    return `${symbol}${(value / 10_000).toFixed(1)}万`;
  }
  return `${symbol}${value.toLocaleString('en-US')}`;
}

// ============================================
// 火花线（内联 SVG，零依赖）
// ============================================
function Sparkline({ points, color, width = 80, height = 26 }: { points: number[]; color: string; width?: number; height?: number }) {
  if (points.length === 0) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const fillPath = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="invest-sparkline">
      <path d={fillPath} fill={color} opacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================
// Ticker Tape（横向滚动条）
// ============================================
function TickerTape({ items, upColor, downColor, accent }: { items: TickerPoint[]; upColor: string; downColor: string; accent: string }) {
  // 复制一份用于无缝循环
  const looped = useMemo(() => [...items, ...items], [items]);
  return (
    <div className="invest-tape" style={{ '--invest-accent': accent } as CSSProperties}>
      <div className="invest-tape-track">
        {looped.map((item, index) => {
          const isUp = item.changePercent >= 0;
          const color = isUp ? upColor : downColor;
          return (
            <div className="invest-tape-item" key={`${item.symbol}-${index}`}>
              <span className="invest-tape-symbol">{item.symbol}</span>
              <span className="invest-tape-price">{formatCurrency(item.price, '$', item.price < 1 ? 4 : 2)}</span>
              <span className="invest-tape-change" style={{ color }}>
                {isUp ? '▲' : '▼'} {formatPercent(item.changePercent)}
              </span>
              <Sparkline points={item.sparkline} color={color} width={56} height={18} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Hero 5 卡（组合价值、当日、总收益、持仓、现金）
// ============================================
function HeroStrip({ theme }: { theme: InvestmentTheme }) {
  const { portfolio, upColor, downColor, accent, currencySymbol } = theme;
  const dayIsUp = portfolio.dayChange >= 0;
  const returnIsUp = portfolio.totalReturn >= 0;

  return (
    <div className="invest-hero">
      <div className="invest-hero-main" style={{ background: `linear-gradient(135deg, ${accent}1A 0%, transparent 100%)` }}>
        <div className="invest-hero-eyebrow">组合总价值</div>
        <div className="invest-hero-value">{formatCurrency(portfolio.totalValue, currencySymbol)}</div>
        <div className="invest-hero-curve">
          <Sparkline points={portfolio.equityCurve} color={accent} width={240} height={48} />
        </div>
        <div className="invest-hero-meta">
          <span>本日起始 · 模拟盘数据</span>
        </div>
      </div>

      <div className="invest-hero-side">
        <article className="invest-hero-stat">
          <span className="invest-hero-stat-label">当日盈亏</span>
          <strong className="invest-hero-stat-value" style={{ color: dayIsUp ? upColor : downColor }}>
            {formatCurrency(Math.abs(portfolio.dayChange), currencySymbol)}
          </strong>
          <span className="invest-hero-stat-pill" style={{ background: `${dayIsUp ? upColor : downColor}1A`, color: dayIsUp ? upColor : downColor }}>
            {formatPercent(portfolio.dayChangePercent)}
          </span>
        </article>
        <article className="invest-hero-stat">
          <span className="invest-hero-stat-label">累计收益</span>
          <strong className="invest-hero-stat-value" style={{ color: returnIsUp ? upColor : downColor }}>
            {formatCurrency(Math.abs(portfolio.totalReturn), currencySymbol)}
          </strong>
          <span className="invest-hero-stat-pill" style={{ background: `${returnIsUp ? upColor : downColor}1A`, color: returnIsUp ? upColor : downColor }}>
            {formatPercent(portfolio.totalReturnPercent)}
          </span>
        </article>
        <article className="invest-hero-stat">
          <span className="invest-hero-stat-label">持仓数</span>
          <strong className="invest-hero-stat-value">{portfolio.positionCount}</strong>
          <span className="invest-hero-stat-pill invest-hero-stat-pill-mute">{portfolio.sectorCount} 个赛道</span>
        </article>
        <article className="invest-hero-stat">
          <span className="invest-hero-stat-label">可用现金</span>
          <strong className="invest-hero-stat-value">{formatCurrency(portfolio.cash, currencySymbol)}</strong>
          <span className="invest-hero-stat-pill invest-hero-stat-pill-mute">等待加仓</span>
        </article>
      </div>
    </div>
  );
}

// ============================================
// 关注列表（含火花线）
// ============================================
function Watchlist({ theme }: { theme: InvestmentTheme }) {
  const { watchlist, upColor, downColor, currencySymbol, accent } = theme;
  return (
    <SectionCard
      title="关注列表"
      description="点击表头可排序 · 数据每 15 秒刷新（模拟）"
      action={<span className="tag" style={{ background: `${accent}1A`, color: accent }}>{watchlist.length} 个标的</span>}
    >
      <div className="invest-table-wrap">
        <table className="invest-table">
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>最新价</th>
              <th>涨跌额</th>
              <th>涨跌幅</th>
              <th>7日走势</th>
              <th>赛道</th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map((item) => {
              const isUp = item.changePercent >= 0;
              const color = isUp ? upColor : downColor;
              return (
                <tr key={item.symbol}>
                  <td className="invest-table-symbol">{item.symbol}</td>
                  <td className="invest-table-name">{item.name}</td>
                  <td className="invest-table-num">{formatCurrency(item.price, currencySymbol, item.price < 1 ? 4 : 2)}</td>
                  <td className="invest-table-num" style={{ color }}>
                    {isUp ? '+' : ''}
                    {formatCurrency(item.change, currencySymbol, Math.abs(item.change) < 1 ? 4 : 2)}
                  </td>
                  <td>
                    <span className="invest-change-pill" style={{ background: `${color}1A`, color }}>
                      {formatPercent(item.changePercent)}
                    </span>
                  </td>
                  <td>
                    <Sparkline points={item.sparkline} color={color} width={88} height={28} />
                  </td>
                  <td>
                    {item.sector ? <span className="invest-sector-tag">{item.sector}</span> : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ============================================
// 行业 / 赛道分布
// ============================================
function Allocation({ theme }: { theme: InvestmentTheme }) {
  const { allocation, accent } = theme;
  const total = allocation.reduce((sum, slice) => sum + slice.value, 0) || 1;
  return (
    <SectionCard
      title="赛道分布"
      description="按持仓占比从大到小排列"
    >
      <div className="invest-allocation">
        <div className="invest-allocation-bar">
          {allocation.map((slice) => (
            <span
              key={slice.label}
              className="invest-allocation-segment"
              style={{ width: `${(slice.value / total) * 100}%`, background: slice.color }}
              title={`${slice.label} ${slice.value}%`}
            />
          ))}
        </div>
        <ul className="invest-allocation-legend">
          {allocation.map((slice) => (
            <li key={slice.label} className="invest-allocation-item">
              <span className="invest-allocation-dot" style={{ background: slice.color }} />
              <span className="invest-allocation-label">{slice.label}</span>
              <span className="invest-allocation-value">{slice.value}%</span>
            </li>
          ))}
        </ul>
        <div className="invest-allocation-foot">
          <span>主色赛道</span>
          <strong style={{ color: accent }}>{allocation[0]?.label} · {allocation[0]?.value}%</strong>
        </div>
      </div>
    </SectionCard>
  );
}

// ============================================
// Top Movers 三列
// ============================================
function Movers({ theme }: { theme: InvestmentTheme }) {
  const { movers, upColor, downColor, currencySymbol } = theme;
  return (
    <SectionCard
      title="Top Movers"
      description="关注列表中涨跌幅与活跃度排行"
    >
      <div className="invest-movers-grid">
        {movers.map((bucket) => (
          <div className="invest-mover-bucket" key={bucket.title}>
            <div className="invest-mover-head">
              <span className="invest-mover-icon">{bucket.icon}</span>
              <strong>{bucket.title}</strong>
            </div>
            <ul className="invest-mover-list">
              {bucket.items.map((item) => {
                const isUp = item.changePercent >= 0;
                const color = isUp ? upColor : downColor;
                return (
                  <li key={item.symbol} className="invest-mover-item">
                    <div className="invest-mover-main">
                      <strong className="invest-mover-symbol">{item.symbol}</strong>
                      <span className="invest-mover-name">{item.name}</span>
                    </div>
                    <div className="invest-mover-value">
                      <span style={{ color }}>
                        {formatPercent(item.changePercent)}
                      </span>
                      <span className="invest-mover-abs">
                        {isUp ? '+' : ''}
                        {formatCurrency(item.change, currencySymbol, Math.abs(item.change) < 1 ? 4 : 2)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ============================================
// 提醒流
// ============================================
function Alerts({ theme }: { theme: InvestmentTheme }) {
  const { alerts, currencySymbol } = theme;
  return (
    <SectionCard
      title="提醒"
      description="财报、目标价、止损线与股息事件，按日期正序"
    >
      <ul className="invest-alerts">
        {alerts.map((alert, index) => {
          const meta = INVESTMENT_ALERT_META[alert.type];
          return (
            <li key={`${alert.symbol}-${index}`} className="invest-alert-item">
              <div className="invest-alert-date">{alert.date}</div>
              <span className={`tag tag-${meta.tone}`}>{meta.label}</span>
              <div className="invest-alert-main">
                <strong>{alert.symbol}</strong>
                <span>{alert.name}</span>
              </div>
              <div className="invest-alert-detail">{alert.detail}</div>
              <button type="button" className="invest-alert-action">
                查看
              </button>
            </li>
          );
        })}
      </ul>
      <div className="invest-alert-foot">
        全部事件将推送至通知中心 · 数据为模拟参考 {currencySymbol}
      </div>
    </SectionCard>
  );
}

// ============================================
// 主组件
// ============================================
export function InvestmentDashboard({ marketId, theme }: InvestmentDashboardProps) {
  return (
    <div className="invest-dashboard" style={{ '--invest-accent': theme.accent, '--invest-accent-soft': theme.accentSoft, '--invest-up': theme.upColor, '--invest-down': theme.downColor } as CSSProperties}>
      <PageHeader
        title={theme.name}
        subtitle={theme.tagline}
      />

      <div className="invest-dashboard-meta">
        <span className="tag tag-orange">前端原型 · 模拟盘</span>
        <span className="invest-dashboard-session">{theme.marketSession}</span>
        <span className="invest-dashboard-divider">·</span>
        <span className="invest-dashboard-currency">计价 {theme.currencyCode}</span>
        <span className="invest-dashboard-spacer" />
        <button type="button" className="invest-add-btn">＋ 添加标的</button>
      </div>

      <TickerTape items={theme.tape} upColor={theme.upColor} downColor={theme.downColor} accent={theme.accent} />

      <div className="invest-dashboard-stack">
        <HeroStrip theme={theme} />

        <div className="invest-mid-grid">
          <Watchlist theme={theme} />
          <Allocation theme={theme} />
        </div>

        <Movers theme={theme} />

        <Alerts theme={theme} />
      </div>

      <div className="invest-dashboard-disclaimer">
        ⚠️ 本页为前端可视化原型，所有价格、盈亏、提醒均为模拟数据，不构成任何投资建议。
        真实行情接入时，将通过 {marketId === 'crypto' ? '交易所公开行情 API' : marketId === 'us-stock' ? 'Polygon / IEX Cloud 行情' : '港交所 HKEX Open Data'} 替换。
      </div>
    </div>
  );
}
