import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import dayjs from 'dayjs';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, Tag } from '../ui';
import { CHART_CATEGORY_8, CHART_PNL } from '../../lib/chartPalette';
import { apiPost } from '../../lib/api';
import {
  buildForexDailyPnlTrend,
  buildForexDashboardSummary,
  buildForexEquityCurve,
  buildForexInstrumentSummary,
  formatForexAmount,
  formatForexMoney,
  formatForexPercent,
  getForexInstrumentLabel,
} from '../../services/forex';
import type { ForexCapitalFlow, ForexDashboardSummary, ForexEquityPoint, ForexTradeRecord } from '../../types/forex';

const AI_STORAGE_KEY = 'forex_ai_analysis';

interface AICache {
  startDate: string;
  endDate: string;
  result: { stats: Record<string, unknown> | null; conclusion: string };
  timestamp: number;
}

function loadAiCache(): AICache | null {
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as AICache;
    if (data.timestamp && Date.now() - data.timestamp > 86400000) {
      localStorage.removeItem(AI_STORAGE_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

interface ForexDashboardSectionProps {
  trades: ForexTradeRecord[];
  capitalFlows: ForexCapitalFlow[];
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  summary?: ForexDashboardSummary;
}

const tooltipStyle = {
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 8,
  color: 'var(--color-ink)',
  fontSize: 'var(--fs-label)',
};

function ChartCard({
  title,
  description,
  className = '',
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`forex-chart-card ${className}`.trim()}>
      <div className="forex-chart-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  );
}

/** 构建 X 轴刻度间隔：保证首/尾/倒数第二个显示，其余按密度等间隔显示。返回 true=跳过，false=显示 */
function buildTickInterval(total: number) {
  return ((index: number) => {
    if (total <= 8) return false;
    if (index === 0 || index === total - 1 || index === total - 2) return false;
    const step = Math.ceil(total / 8);
    return index % step !== 0;
  }) as never;
}

/** 收益曲线自定义 Tooltip */
function EquityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ForexEquityPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (!p) return null;
  const equityColor = p.equity >= 0 ? CHART_PNL.up : CHART_PNL.down;
  const dailyColor = p.dailyPnl >= 0 ? CHART_PNL.up : CHART_PNL.down;
  return (
    <div
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 8,
        color: 'var(--color-ink)',
        fontSize: 'var(--fs-label)',
        padding: '10px 14px',
        lineHeight: 1.6,
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600 }}>日期 {label}</div>
      <div style={{ color: equityColor }}>
        累计收益: {p.equity >= 0 ? '+' : ''}${p.equity.toFixed(2)}
      </div>
      <div style={{ color: dailyColor }}>
        当日盈亏: {p.dailyPnl >= 0 ? '+' : ''}${p.dailyPnl.toFixed(2)}
      </div>
    </div>
  );
}

/** 收益曲线图表：0 基线对称布局，stroke 按 Y 坐标分段着色（0以上绿色，0以下红色） */
function EquityCurveChart({ data }: { data: ForexEquityPoint[] }) {
  const lastEquity = data.length > 0 ? data[data.length - 1].equity : 0;
  const fillGradId = lastEquity >= 0 ? 'forexEquityGradUp' : 'forexEquityGradDown';

  const maxAbs = data.length > 0
    ? Math.max(...data.map((d) => Math.abs(d.equity)), 1)
    : 1;
  const yDomain: [number, number] = [-maxAbs, maxAbs];

  /** 生成对称 Y 轴刻度，确保包含 0 */
  const yTicks = useMemo(() => {
    const steps = 2;
    return Array.from({ length: steps * 2 + 1 }, (_, i) => {
      const v = (i - steps) * (maxAbs / steps);
      return Number(v.toFixed(2));
    });
  }, [maxAbs]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 12, right: 20, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="forexEquityGradUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PNL.up} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_PNL.up} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="forexEquityGradDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PNL.down} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART_PNL.down} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse">
            <stop offset="51.33%" stopColor={CHART_PNL.up} />
            <stop offset="51.33%" stopColor={CHART_PNL.down} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-overline)' }}
          tickFormatter={(value: string) => String(value ?? '').slice(5)}
          interval={buildTickInterval(data.length)}
          angle={-35}
          textAnchor="end"
          height={60}
        />
        <YAxis
          domain={yDomain}
          ticks={yTicks}
          tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }}
          tickFormatter={(value: number) => {
            const v = Number(value ?? 0);
            if (Math.abs(v) < 1) return `$${v.toFixed(2)}`;
            if (Math.abs(v) < 10) return `$${v.toFixed(1)}`;
            return `$${v.toFixed(0)}`;
          }}
          width={56}
        />
        <ReferenceLine y={0} stroke="var(--color-hairline-strong)" strokeWidth={1.5} />
        <Tooltip content={<EquityTooltip />} />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="url(#splitStroke)"
          strokeWidth={2.5}
          fill={`url(#${fillGradId})`}
          baseValue={0}
          dot={false}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-in-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** 每日盈亏图表：柱状图，盈利绿色亏损红色 */
function DailyPnlChart({ data }: { data: { date: string; netPnl: number; tradeCount: number }[] }) {
  /** 计算对称 Y 轴域，使 0 居中 */
  const maxAbs = data.length > 0
    ? Math.max(...data.map((d) => Math.abs(d.netPnl)), 1)
    : 1;
  const yDomain: [number, number] = [-maxAbs, maxAbs];

  /** 生成对称 Y 轴刻度，确保包含 0 */
  const yTicks = useMemo(() => {
    const steps = 2;
    return Array.from({ length: steps * 2 + 1 }, (_, i) => {
      const v = (i - steps) * (maxAbs / steps);
      return Number(v.toFixed(2));
    });
  }, [maxAbs]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 12, right: 20, bottom: 4, left: 4 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-overline)' }}
          tickFormatter={(value: string) => String(value ?? '').slice(5)}
          interval={buildTickInterval(data.length)}
          angle={-35}
          textAnchor="end"
          height={60}
        />
        <YAxis
          domain={yDomain}
          ticks={yTicks}
          tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }}
          tickFormatter={(value: number) => {
            const v = Number(value ?? 0);
            if (Math.abs(v) < 1) return `$${v.toFixed(2)}`;
            if (Math.abs(v) < 10) return `$${v.toFixed(1)}`;
            return `$${v.toFixed(0)}`;
          }}
          width={56}
        />
        <ReferenceLine y={0} stroke="var(--color-hairline-strong)" strokeWidth={1.5} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={((value: number, _name: string, entry: { payload?: { date: string; netPnl: number; tradeCount: number } }) => {
            const p = entry?.payload;
            const pnlStr = `${value >= 0 ? '+' : ''}$${Number(value ?? 0).toFixed(2)}`;
            const countStr = p ? `  |  ${p.tradeCount} 笔` : '';
            return [pnlStr + countStr, '净盈亏'];
          }) as never}
          labelFormatter={((label: unknown) => `日期 ${String(label ?? '')}`) as never}
        />
        <Bar
          dataKey="netPnl"
          radius={[3, 3, 0, 0]}
          isAnimationActive
          animationDuration={800}
        >
          {data.map((entry) => (
            <Cell
              key={entry.date}
              fill={entry.netPnl >= 0 ? CHART_PNL.up : CHART_PNL.down}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function renderMarkdown(text: string) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--color-ink)">$1</strong>')
    .replace(/`(.+?)`/g, '<code style="background:var(--color-surface-3);padding:2px 6px;border-radius:4px;font-size: var(--fs-caption)">$1</code>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size: var(--fs-body);font-weight:600;margin:14px 0 6px;color:var(--color-ink)">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size: var(--fs-subtitle);font-weight:600;margin:16px 0 8px;color:var(--color-ink)">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size: var(--fs-title);font-weight:600;margin:18px 0 10px;color:var(--color-ink)">$1</h2>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;color:var(--color-ink-muted)">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;color:var(--color-ink-muted)">$1</li>')
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--color-hairline);margin:12px 0">')
    .replace(/\n\n/g, '</p><p style="margin:8px 0">')
    .replace(/\n/g, '<br>');
  html = html.replace(/((?:<li[^>]*>.*?<\/li><br>)+)/g, '<ul style="list-style:none;padding:4px 0;margin:4px 0">$1</ul>');
  html = html.replace(/<\/li><br><li/g, '</li><li');
  html = html.replace(/<\/li><br><\/ul>/g, '</li></ul>');
  html = html.replace(/<ul[^>]*><br>/g, '<ul>');
  return `<p style="margin:8px 0">${html}</p>`;
}

/** 单日盈亏数据，用于日历格子 */
interface PnlDayData {
  date: string;
  netPnl: number;
  tradeCount: number;
}

/** 盈亏日历组件：按月展示每日盈亏热力图，支持年/月下拉切换，格子内直显收益 */
function PnlCalendar({ trend }: { trend: { date: string; netPnl: number; tradeCount: number }[] }) {
  const [viewMonth, setViewMonth] = useState(() => dayjs());

  /** 将 trend 数据按日期建立 Map */
  const pnlMap = useMemo(() => {
    const map = new Map<string, PnlDayData>();
    trend.forEach((item) => {
      map.set(item.date, { date: item.date, netPnl: item.netPnl, tradeCount: item.tradeCount });
    });
    return map;
  }, [trend]);

  /** 根据净盈亏返回简化的颜色类名：绿涨/红跌/灰空 */
  function getPnlColorClass(pnl: number, count: number): string {
    if (count === 0 && pnl === 0) return 'pnl-cell-empty';
    if (pnl > 0) return 'pnl-cell-profit';
    if (pnl < 0) return 'pnl-cell-loss';
    /* pnl === 0 但有交易或出入金 */
    return count > 0 ? 'pnl-cell-profit' : 'pnl-cell-empty';
  }

  /** 生成当月日历网格（6行 x 7列） */
  const calendarDays = useMemo(() => {
    const startOfMonth = viewMonth.startOf('month');
    const endOfMonth = viewMonth.endOf('month');
    const startPad = startOfMonth.day(); // 0=周日
    const daysInMonth = endOfMonth.date();
    const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;
    const cells: (PnlDayData | null)[] = [];

    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = viewMonth.date(d).format('YYYY-MM-DD');
      cells.push(pnlMap.get(dateKey) ?? { date: dateKey, netPnl: 0, tradeCount: 0 });
    }
    while (cells.length < totalCells) cells.push(null);

    return cells;
  }, [viewMonth, pnlMap]);

  /** 当月统计摘要 */
  const monthStats = useMemo(() => {
    let totalPnl = 0;
    let winDays = 0;
    let lossDays = 0;
    let tradeDays = 0;
    calendarDays.forEach((d) => {
      if (!d) return;
      totalPnl += d.netPnl;
      tradeDays += d.tradeCount > 0 ? 1 : 0;
      if (d.tradeCount > 0) {
        if (d.netPnl >= 0) winDays++;
        else lossDays++;
      }
    });
    return { totalPnl, winDays, lossDays, tradeDays };
  }, [calendarDays]);

  /** 年份下拉选项：当前年 ±5 */
  const yearOptions = useMemo(() => {
    const y = viewMonth.year();
    return Array.from({ length: 11 }, (_, i) => y - 5 + i);
  }, [viewMonth]);

  /** 月份下拉选项：1-12 */
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }, []);

  const weekHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  /** 判断格子是否有内容需要显示 */
  function hasCellContent(day: PnlDayData): boolean {
    return day.tradeCount > 0 || day.netPnl !== 0;
  }

  return (
    <div className="pnl-calendar-wrapper">
      {/* 导航栏：年份下拉 + 月份下拉 + 摘要 */}
      <div className="pnl-calendar-head">
        <div className="pnl-calendar-nav">
          <select
            className="pnl-year-select"
            value={viewMonth.year()}
            onChange={(event) => setViewMonth((m) => m.year(Number(event.target.value)))}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
          <select
            className="pnl-month-select"
            value={viewMonth.month() + 1}
            onChange={(event) => setViewMonth((m) => m.month(Number(event.target.value) - 1))}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m} 月</option>
            ))}
          </select>
          <button
            type="button"
            className="pnl-nav-btn"
            onClick={() => setViewMonth((m) => m.subtract(1, 'month'))}
            title="上个月"
          >
            &lsaquo;
          </button>
          <button
            type="button"
            className="pnl-nav-btn"
            onClick={() => setViewMonth((m) => m.add(1, 'month'))}
            title="下个月"
          >
            &rsaquo;
          </button>
        </div>

        {/* 当月摘要 */}
        <div className="pnl-calendar-summary">
          <span>月盈亏 <em className={monthStats.totalPnl >= 0 ? 'pnl-text-profit' : 'pnl-text-loss'}>{formatForexAmount(monthStats.totalPnl)}</em></span>
          <span className="pnl-summary-sep">·</span>
          <span>{monthStats.tradeDays} 交易日</span>
          <span className="pnl-summary-sep">·</span>
          <span style={{ color: 'var(--color-success)' }}>{monthStats.winDays} 盈</span>
          <span className="pnl-summary-sep">·</span>
          <span style={{ color: 'var(--color-danger)' }}>{monthStats.lossDays} 亏</span>
        </div>
      </div>

      {/* 日历网格 */}
      <div className="pnl-calendar-grid">
        {weekHeaders.map((w) => (
          <div key={w} className="pnl-cell pnl-cell-header">{w}</div>
        ))}
        {calendarDays.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} className="pnl-cell pnl-cell-blank" />;
          const colorClass = getPnlColorClass(day.netPnl, day.tradeCount);
          const content = hasCellContent(day);
          return (
            <div
              key={day.date}
              className={`pnl-cell ${colorClass}${!content ? ' pnl-cell-no-data' : ''}`}
              title={content ? `${day.date} | ${day.tradeCount}笔 | ${formatForexAmount(day.netPnl)}` : day.date}
            >
              <span className="pnl-cell-date">{parseInt(day.date.slice(8), 10)}</span>
              {content && (
                <div className="pnl-cell-detail">
                  {day.netPnl !== 0 && (
                    <span className={`pnl-cell-pnl ${day.netPnl > 0 ? 'pnl-text-profit' : 'pnl-text-loss'}`}>
                      {formatForexAmount(day.netPnl)}
                    </span>
                  )}
                  {day.tradeCount > 0 && (
                    <span className="pnl-cell-count">{day.tradeCount}笔</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="pnl-calendar-legend">
        <span className="pnl-legend-label">跌</span>
        <div className="pnl-legend-bar">
          <span className="pnl-legend-swatch pnl-cell-loss" />
          <span className="pnl-legend-swatch pnl-cell-empty" />
          <span className="pnl-legend-swatch pnl-cell-profit" />
        </div>
        <span className="pnl-legend-label">涨</span>
      </div>
    </div>
  );
}

export function ForexDashboardSection({
  trades,
  capitalFlows,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  summary: externalSummary,
}: ForexDashboardSectionProps) {
  const summary = externalSummary ?? useMemo(
    () => buildForexDashboardSummary(trades, capitalFlows, startDate, endDate),
    [capitalFlows, endDate, startDate, trades],
  );
  const trend = useMemo(
    () => buildForexDailyPnlTrend(trades, startDate, endDate),
    [endDate, startDate, trades],
  );
  const equityCurve = useMemo(
    () => buildForexEquityCurve(trades, undefined, startDate, endDate),
    [endDate, startDate, trades],
  );
  const [activeChart, setActiveChart] = useState<'equity' | 'pnl'>('equity');
  const instrumentSummary = useMemo(
    () => buildForexInstrumentSummary(trades, startDate, endDate),
    [endDate, startDate, trades],
  );

  const savedAi = loadAiCache();
  const [aiStartDate, setAiStartDate] = useState(savedAi?.startDate || startDate);
  const [aiEndDate, setAiEndDate] = useState(savedAi?.endDate || endDate);
  const [aiResult, setAiResult] = useState<AICache['result'] | null>(savedAi?.result || null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    if (startDate && !aiStartDate) setAiStartDate(startDate);
    if (endDate && !aiEndDate) setAiEndDate(endDate);
  }, [startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAiAnalyze = useCallback(async () => {
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const result = await apiPost<AICache['result'], { start_date: string; end_date: string }>(
        '/analysis/analyze',
        { start_date: aiStartDate, end_date: aiEndDate },
      );
      setAiResult(result);
      localStorage.setItem(AI_STORAGE_KEY, JSON.stringify({
        startDate: aiStartDate,
        endDate: aiEndDate,
        result,
        timestamp: Date.now(),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '网络请求失败';
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  }, [aiStartDate, aiEndDate]);

  const hasTrendData = trend.some((item) => item.tradeCount > 0 || item.netPnl !== 0);
  const hasInstrumentData = instrumentSummary.some((item) => item.tradeCount > 0);
  const isDataReady = trades.length > 0;
  const winCount = trades.filter((t) => {
    if (startDate && t.tradeDate < startDate) return false;
    if (endDate && t.tradeDate > endDate) return false;
    return t.pnl > 0;
  }).length;
  const lossCount = summary.tradeCount - winCount;

  /** 盈亏分布模块的衍生统计 */
  const pnlStats = useMemo(() => {
    const days = trend.filter((d) => d.tradeCount > 0);
    if (days.length === 0) return null;
    // 最佳单日盈利 / 最差单日亏损
    let bestDay = days[0], worstDay = days[0];
    let totalPnl = 0;
    for (const d of days) {
      totalPnl += d.netPnl;
      if (d.netPnl > bestDay.netPnl) bestDay = d;
      if (d.netPnl < worstDay.netPnl) worstDay = d;
    }
    // 连续盈/亏最长 streak（按交易日）
    let maxWinStreak = 0, maxLossStreak = 0;
    let curWinStreak = 0, curLossStreak = 0;
    for (const d of trend) {
      if (d.tradeCount === 0) continue;
      if (d.netPnl >= 0) { curWinStreak++; curLossStreak = 0; maxWinStreak = Math.max(maxWinStreak, curWinStreak); }
      else { curLossStreak++; curWinStreak = 0; maxLossStreak = Math.max(maxLossStreak, curLossStreak); }
    }
    // 最佳单笔 / 最差单笔（含手续费和隔夜费）+ 逐笔胜率
    const scopedTrades = trades.filter((t) => {
      if (startDate && t.tradeDate < startDate) return false;
      if (endDate && t.tradeDate > endDate) return false;
      return true;
    });
    let bestTrade: ForexTradeRecord | null = null;
    let worstTrade: ForexTradeRecord | null = null;
    let tradeWinCount = 0;
    for (const t of scopedTrades) {
      const netPnl = t.pnl + t.commission + t.overnightFee;
      if (!bestTrade || netPnl > (bestTrade.pnl + bestTrade.commission + bestTrade.overnightFee)) {
        bestTrade = t;
      }
      if (!worstTrade || netPnl < (worstTrade.pnl + worstTrade.commission + worstTrade.overnightFee)) {
        worstTrade = t;
      }
      if (t.pnl > 0) tradeWinCount++;
    }
    const tradeWinRate = scopedTrades.length > 0
      ? ((tradeWinCount / scopedTrades.length) * 100).toFixed(1)
      : '0.0';
    return {
      avgDaily: totalPnl / days.length,
      bestDay,
      worstDay,
      winRate: tradeWinRate,
      maxWinStreak,
      maxLossStreak,
      bestTrade,
      worstTrade,
    };
  }, [endDate, startDate, trades, trend]);

  return (
    <SectionCard
      title="统计看板"
      description="围绕单账户的交易、出入金和收益结构做本地复盘，时间范围只影响这块看板和规则分析。"
      action={<Tag tone="blue">{`${startDate} 至 ${endDate}`}</Tag>}
    >
      <div className="page-stack">
        <div className="forex-filter-grid">
          <DatePickerField
            label="开始日期"
            value={startDate}
            onChange={onStartDateChange}
            placeholder="选择开始日期"
          />
          <DatePickerField
            label="结束日期"
            value={endDate}
            onChange={onEndDateChange}
            placeholder="选择结束日期"
          />
        </div>

        <StatGrid
          className="forex-dashboard-stat-grid"
          items={[
            { label: '净收益', value: formatForexAmount(summary.realizedNetPnl), accent: summary.realizedNetPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)', helper: `总交易 ${summary.tradeCount} 笔 · 做多 ${summary.longCount} / 做空 ${summary.shortCount}` },
            { label: '胜率', value: formatForexPercent(summary.winRate), helper: `盈亏比 ${summary.profitLossRatio.toFixed(2)}` },
            { label: '手续费', value: formatForexMoney(summary.totalCommission), accent: 'var(--color-danger)', helper: `${summary.tradeCount} 笔交易累计` },
            { label: '净入金', value: formatForexMoney(summary.netCapital), helper: `入金 ${formatForexMoney(summary.totalDeposit)} / 出金 ${formatForexMoney(summary.totalWithdrawal)}` },
            { label: '账户净值', value: formatForexMoney(summary.equity), helper: `全部净入金 + 全部净收益` },
            { label: 'ROI', value: formatForexPercent(summary.roi), helper: `当前余额 / 区间入金` },
          ]}
        />

        {/* 净值曲线 / 每日盈亏 - 独占整行，双标签切换 */}
        <ChartCard
          title={activeChart === 'equity' ? '收益曲线' : '每日盈亏'}
          description={activeChart === 'equity' ? '累计交易盈亏变化趋势（不含出入金）。' : '按交易日观察净盈亏变化趋势。'}
        >
          {isDataReady && hasTrendData ? (
            <div className="forex-chart-shell">
              {/* 标签切换器 */}
              <div className="forex-chart-tabs">
                <button
                  type="button"
                  className={`forex-chart-tab${activeChart === 'equity' ? ' is-active' : ''}`}
                  onClick={() => setActiveChart('equity')}
                >
                  收益曲线
                </button>
                <button
                  type="button"
                  className={`forex-chart-tab${activeChart === 'pnl' ? ' is-active' : ''}`}
                  onClick={() => setActiveChart('pnl')}
                >
                  每日盈亏
                </button>
              </div>

              {activeChart === 'equity' ? (
                <EquityCurveChart data={equityCurve} />
              ) : (
                <DailyPnlChart data={trend} />
              )}
            </div>
          ) : (
            <EmptyState
              title={isDataReady ? '暂无盈亏曲线' : '正在加载数据...'}
              description={isDataReady ? '先录入几笔交易记录，趋势线才会形成。' : '正在从后端获取交易数据，请稍候。'}
            />
          )}
        </ChartCard>

        {/* 盈亏分布 + 盈亏日历 并排 */}
        <div className="forex-dashboard-grid">
          {/* 左侧：盈亏分布饼图 */}
          <div className="forex-chart-card">
            <div className="forex-chart-header">
              <strong>盈亏分布</strong>
              <span>盈利与亏损笔数占比，配合盈亏比判断执行质量。</span>
            </div>
            {isDataReady && summary.tradeCount > 0 ? (
              <div className="forex-chart-shell">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '盈利', value: Math.max(0, winCount), color: CHART_PNL.up },
                        { name: '亏损', value: Math.max(0, lossCount), color: CHART_PNL.down },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={92}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {[
                        { name: '盈利', value: Math.max(0, winCount), color: CHART_PNL.up },
                        { name: '亏损', value: Math.max(0, lossCount), color: CHART_PNL.down },
                      ].map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [value, '笔数']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap', marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
                    <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-ink-muted)' }}>盈利 {winCount} 笔</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
                    <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-ink-muted)' }}>亏损 {lossCount} 笔</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-ink-subtle)' }}>盈亏比</span>
                    <span style={{
                      fontSize: 'var(--fs-label)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: summary.profitLossRatio >= 1 ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {summary.profitLossRatio > 0 ? summary.profitLossRatio.toFixed(2) : '--'}
                    </span>
                  </div>
                </div>
                {/* 衍生统计指标 */}
                {pnlStats && (
                  <div className="pnl-distribution-stats">
                    <div className="pnl-stat-item">
                      <span className="pnl-stat-label">最佳单日</span>
                      <strong className="pnl-stat-value pnl-stat-profit">
                        +{formatForexMoney(pnlStats.bestDay.netPnl)}
                      </strong>
                      <span className="pnl-stat-sub">{pnlStats.bestDay.date.slice(5)}</span>
                    </div>
                    <div className="pnl-stat-divider" />
                    <div className="pnl-stat-item">
                      <span className="pnl-stat-label">最差单日</span>
                      <strong className="pnl-stat-value pnl-stat-loss">
                        {formatForexMoney(pnlStats.worstDay.netPnl)}
                      </strong>
                      <span className="pnl-stat-sub">{pnlStats.worstDay.date.slice(5)}</span>
                    </div>
                    <div className="pnl-stat-divider" />
                    {pnlStats.bestTrade && (
                      <>
                        <div className="pnl-stat-item">
                          <span className="pnl-stat-label">最佳单笔</span>
                          <strong className="pnl-stat-value pnl-stat-profit">
                            +{formatForexMoney(pnlStats.bestTrade.pnl + pnlStats.bestTrade.commission + pnlStats.bestTrade.overnightFee)}
                          </strong>
                          <span className="pnl-stat-sub">{pnlStats.bestTrade.tradeDate.slice(5)}</span>
                        </div>
                        <div className="pnl-stat-divider" />
                      </>
                    )}
                    {pnlStats.worstTrade && (
                      <>
                        <div className="pnl-stat-item">
                          <span className="pnl-stat-label">最差单笔</span>
                          <strong className="pnl-stat-value pnl-stat-loss">
                            {formatForexMoney(pnlStats.worstTrade.pnl + pnlStats.worstTrade.commission + pnlStats.worstTrade.overnightFee)}
                          </strong>
                          <span className="pnl-stat-sub">{pnlStats.worstTrade.tradeDate.slice(5)}</span>
                        </div>
                        <div className="pnl-stat-divider" />
                      </>
                    )}
                    <div className="pnl-stat-item">
                      <span className="pnl-stat-label">日均盈亏</span>
                      <strong className={`pnl-stat-value ${pnlStats.avgDaily >= 0 ? 'pnl-stat-profit' : 'pnl-stat-loss'}`}>
                        {formatForexMoney(pnlStats.avgDaily)}
                      </strong>
                    </div>
                    <div className="pnl-stat-divider" />
                    <div className="pnl-stat-item">
                      <span className="pnl-stat-label">胜率</span>
                      <strong className="pnl-stat-value" style={{ color: Number(pnlStats.winRate) >= 50 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {pnlStats.winRate}%
                      </strong>
                    </div>
                    <div className="pnl-stat-divider" />
                    <div className="pnl-stat-item">
                      <span className="pnl-stat-label">最长连盈</span>
                      <strong className="pnl-stat-value pnl-stat-profit">
                        {pnlStats.maxWinStreak}天
                      </strong>
                    </div>
                    <div className="pnl-stat-divider" />
                    <div className="pnl-stat-item">
                      <span className="pnl-stat-label">最长连亏</span>
                      <strong className="pnl-stat-value pnl-stat-loss">
                        {pnlStats.maxLossStreak}天
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                title={isDataReady ? '暂无盈亏分布' : '正在加载数据...'}
                description={isDataReady ? '当前区间形成有效盈亏样本后，这里会自动拆分结构。' : '正在从后端获取交易数据，请稍候。'}
              />
            )}
          </div>

          {/* 右侧：盈亏日历 */}
          <div className="forex-chart-card">
            <div className="forex-chart-header">
              <strong>盈亏日历</strong>
              <span>按月查看每日盈亏热力图，颜色越深金额越大。</span>
            </div>
            {isDataReady && hasTrendData ? (
              <PnlCalendar trend={trend} />
            ) : (
              <EmptyState title="暂无日历数据" description="录入交易记录后显示每日盈亏分布。" />
            )}
          </div>
        </div>

        <ChartCard
          title="品种分析"
          description="按交易品种拆分笔数、盈亏、均盈和胜率。"
        >
          {hasInstrumentData ? (
            <div className="forex-instrument-cards">
              {instrumentSummary.map((item) => (
                <div key={item.instrument} className="forex-instrument-summary-card">
                  <div className="forex-instrument-summary-card-head">
                    <strong>{getForexInstrumentLabel(item.instrument)}</strong>
                    <span style={{ color: item.netPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 'var(--fs-label)' }}>
                      {formatForexAmount(item.netPnl)}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 10 }}>
                    <div>
                      <span style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--color-ink-subtle)' }}>笔数</span>
                      <span style={{ fontSize: 'var(--fs-label)', fontWeight: 500, color: 'var(--color-ink)' }}>{item.tradeCount}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--color-ink-subtle)' }}>均盈</span>
                      <span style={{ fontSize: 'var(--fs-label)', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-muted)' }}>
                        {item.tradeCount > 0 ? formatForexMoney(item.grossPnl / item.tradeCount) : '--'}
                      </span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--color-ink-subtle)' }}>胜率</span>
                      <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-ink-muted)' }}>{formatForexPercent(item.winRate)}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--color-ink-subtle)' }}>方向</span>
                      <span style={{ fontSize: 'var(--fs-label)', color: 'var(--color-ink-muted)' }}>{item.longCount}多 / {item.shortCount}空</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无品种分析" description="先录入 XAUUSD 或 XAGUSD 交易后，这里会形成对比。" />
          )}
        </ChartCard>

        <ChartCard
          title="AI 智能分析"
          description="选择日期范围，由 DeepSeek AI 根据交易记录进行多维度分析，仅在你手动点击后触发。"
        >
          <div className="forex-ai-controls">
            <DatePickerField
              label="起始日期"
              value={aiStartDate}
              onChange={setAiStartDate}
              placeholder="选择起始日期"
            />
            <DatePickerField
              label="结束日期"
              value={aiEndDate}
              onChange={setAiEndDate}
              placeholder="选择结束日期"
            />
            <div className="forex-submit-cell">
              <Btn tone="primary" onClick={handleAiAnalyze} disabled={aiLoading}>
                {aiLoading ? '分析中...' : '开始分析'}
              </Btn>
            </div>
          </div>

          {aiError && (
            <div className="forex-ai-error">
              {aiError}
            </div>
          )}

          {aiResult && (
            <div className="forex-ai-result">
              {aiResult.stats && (
                <StatGrid
                  className="forex-ai-stat-grid"
                  items={[
                    { label: '分析笔数', value: String(aiResult.stats.total_trades ?? '--') },
                    { label: '总盈亏', value: aiResult.stats.total_pnl != null ? formatForexAmount(Number(aiResult.stats.total_pnl)) : '--', accent: Number(aiResult.stats.total_pnl) >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
                    { label: '胜率', value: aiResult.stats.win_rate != null ? formatForexPercent(Number(aiResult.stats.win_rate)) : '--' },
                    { label: '盈亏比', value: aiResult.stats.profit_loss_ratio != null ? String(aiResult.stats.profit_loss_ratio) : '--' },
                  ]}
                />
              )}
              <div
                className="forex-ai-conclusion"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(aiResult.conclusion || '') }}
              />
            </div>
          )}
        </ChartCard>
      </div>
    </SectionCard>
  );
}
