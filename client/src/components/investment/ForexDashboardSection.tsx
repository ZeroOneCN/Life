import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import dayjs from 'dayjs';
import {
  Area,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
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
  buildForexInstrumentSummary,
  formatForexAmount,
  formatForexMoney,
  formatForexPercent,
  getForexInstrumentLabel,
} from '../../services/forex';
import type { ForexCapitalFlow, ForexDashboardSummary, ForexTradeRecord } from '../../types/forex';

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

/** 盈亏日历组件：按月展示每日盈亏热力图，支持年/月切换，格子内直显收益 */
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

  /** 年份快速切换列表：当前年 ±2 */
  const yearOptions = useMemo(() => {
    const y = viewMonth.year();
    return Array.from({ length: 5 }, (_, i) => y - 2 + i);
  }, [viewMonth]);

  const weekHeaders = ['日', '一', '二', '三', '四', '五', '六'];

  /** 判断格子是否有内容需要显示 */
  function hasCellContent(day: PnlDayData): boolean {
    return day.tradeCount > 0 || day.netPnl !== 0;
  }

  return (
    <div className="pnl-calendar-wrapper">
      {/* 导航栏：年份选择 + 月份翻页 + 摘要 */}
      <div className="pnl-calendar-head">
        <div className="pnl-calendar-nav">
          {/* 年份快捷切换 */}
          <div className="pnl-year-picker">
            <button
              type="button"
              className={`pnl-year-button ${viewMonth.year() === yearOptions[0] ? 'is-active' : ''}`}
              onClick={() => setViewMonth((m) => m.year(yearOptions[0]))}
            >
              {yearOptions[0]}
            </button>
            <button
              type="button"
              className={`pnl-year-button ${viewMonth.year() === yearOptions[1] ? 'is-active' : ''}`}
              onClick={() => setViewMonth((m) => m.year(yearOptions[1]))}
            >
              {yearOptions[1]}
            </button>
            <button
              type="button"
              className={`pnl-year-button ${viewMonth.year() === yearOptions[2] ? 'is-active' : ''}`}
              onClick={() => setViewMonth((m) => m.year(yearOptions[2]))}
            >
              {yearOptions[2]}
            </button>
            <button
              type="button"
              className={`pnl-year-button ${viewMonth.year() === yearOptions[3] ? 'is-active' : ''}`}
              onClick={() => setViewMonth((m) => m.year(yearOptions[3]))}
            >
              {yearOptions[3]}
            </button>
            <button
              type="button"
              className={`pnl-year-button ${viewMonth.year() === yearOptions[4] ? 'is-active' : ''}`}
              onClick={() => setViewMonth((m) => m.year(yearOptions[4]))}
            >
              {yearOptions[4]}
            </button>
          </div>

          {/* 月份翻页 */}
          <div className="pnl-month-nav">
            <button
              type="button"
              className="pnl-nav-btn"
              onClick={() => setViewMonth((m) => m.subtract(1, 'month'))}
            >
              &lsaquo;
            </button>
            <strong className="pnl-calendar-title">{viewMonth.format('M 月')}</strong>
            <button
              type="button"
              className="pnl-nav-btn"
              onClick={() => setViewMonth((m) => m.add(1, 'month'))}
            >
              &rsaquo;
            </button>
          </div>
        </div>

        {/* 当月摘要（紧凑单行） */}
        <div className="pnl-calendar-summary">
          <span>月盈亏 <em>{formatForexAmount(monthStats.totalPnl)}</em></span>
          <span>{monthStats.tradeDays}交易日</span>
          <span style={{ color: 'var(--color-success)' }}>{monthStats.winDays}盈</span>
          <span style={{ color: 'var(--color-danger)' }}>{monthStats.lossDays}亏</span>
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
            >
              <span className="pnl-cell-date">{parseInt(day.date.slice(8), 10)}</span>
              {content && (
                <div className="pnl-cell-detail">
                  {day.netPnl !== 0 && (
                    <span className={`pnl-cell-pnl ${day.netPnl > 0 ? 'pnl-text-profit' : 'pnl-text-loss'}`}>
                      {formatForexAmount(day.netPnl)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 图例：简化为涨/跌/无 */}
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
    let winDays = 0;
    for (const d of days) {
      totalPnl += d.netPnl;
      if (d.netPnl > bestDay.netPnl) bestDay = d;
      if (d.netPnl < worstDay.netPnl) worstDay = d;
      if (d.netPnl >= 0) winDays++;
    }
    // 连续盈/亏最长 streak
    let maxWinStreak = 0, maxLossStreak = 0;
    let curWinStreak = 0, curLossStreak = 0;
    for (const d of trend) {
      if (d.tradeCount === 0) continue;
      if (d.netPnl >= 0) { curWinStreak++; curLossStreak = 0; maxWinStreak = Math.max(maxWinStreak, curWinStreak); }
      else { curLossStreak++; curWinStreak = 0; maxLossStreak = Math.max(maxLossStreak, curLossStreak); }
    }
    return {
      avgDaily: totalPnl / days.length,
      bestDay,
      worstDay,
      winRate: ((winDays / days.length) * 100).toFixed(1),
      maxWinStreak,
      maxLossStreak,
    };
  }, [trend]);

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
            { label: '账户净值', value: formatForexMoney(summary.equity), helper: `净入金 + 净收益` },
            { label: 'ROI', value: formatForexPercent(summary.roi), helper: `XAU ${summary.xauCount} / XAG ${summary.xagCount}` },
          ]}
        />

        {/* 每日盈亏曲线 - 独占整行 */}
        <ChartCard title="每日盈亏曲线" description="按交易日观察净盈亏变化趋势。">
          {isDataReady && hasTrendData ? (
            <div className="forex-chart-shell">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trend}>
                  <defs>
                    <linearGradient id="forexPnlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5e6ad2" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#5e6ad2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-overline)' }}
                    tickFormatter={(value) => String(value ?? '').slice(5)}
                    interval={0}
                    angle={-40}
                    textAnchor="end"
                    height={70}
                    minTickGap={16}
                  />
                  <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [formatForexMoney(Number(value ?? 0)), '净盈亏']}
                    labelFormatter={(label) => `日期 ${String(label ?? '')}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="netPnl"
                    stroke="none"
                    fill="url(#forexPnlGradient)"
                    isAnimationActive
                    animationDuration={3200}
                    animationEasing="ease-in-out"
                  />
                  <Line
                    type="monotone"
                    dataKey="netPnl"
                    stroke="#5e6ad2"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive
                    animationDuration={3600}
                    animationEasing="ease-in-out"
                  />
                </LineChart>
              </ResponsiveContainer>
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
