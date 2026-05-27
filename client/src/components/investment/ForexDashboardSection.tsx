import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CartesianGrid,
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
import type { ForexCapitalFlow, ForexTradeRecord } from '../../types/forex';

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
}

const tooltipStyle = {
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 8,
  color: 'var(--color-ink)',
  fontSize: 14,
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
    .replace(/`(.+?)`/g, '<code style="background:var(--color-surface-3);padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
    .replace(/^### (.+)$/gm, '<h4 style="font-size:16px;font-weight:600;margin:14px 0 6px;color:var(--color-ink)">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:18px;font-weight:600;margin:16px 0 8px;color:var(--color-ink)">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="font-size:20px;font-weight:600;margin:18px 0 10px;color:var(--color-ink)">$1</h2>')
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

export function ForexDashboardSection({
  trades,
  capitalFlows,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: ForexDashboardSectionProps) {
  const summary = useMemo(
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

  // AI analysis state
  const savedAi = loadAiCache();
  const [aiStartDate, setAiStartDate] = useState(savedAi?.startDate || startDate);
  const [aiEndDate, setAiEndDate] = useState(savedAi?.endDate || endDate);
  const [aiResult, setAiResult] = useState<AICache['result'] | null>(savedAi?.result || null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Sync AI dates with dashboard filter when they change
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
  const winCount = trades.filter((t) => {
    if (startDate && t.tradeDate < startDate) return false;
    if (endDate && t.tradeDate > endDate) return false;
    return t.pnl > 0;
  }).length;
  const lossCount = summary.tradeCount - winCount;

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
            { label: '总交易数', value: `${summary.tradeCount} 笔`, helper: `做多 ${summary.longCount} / 做空 ${summary.shortCount}` },
            { label: '净收益', value: formatForexAmount(summary.realizedNetPnl), accent: summary.realizedNetPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: '胜率', value: formatForexPercent(summary.winRate), helper: `盈亏比 ${summary.profitLossRatio.toFixed(2)}` },
            { label: '总手续费', value: formatForexMoney(summary.totalCommission), accent: 'var(--color-warning)' },
            { label: '净入金', value: formatForexMoney(summary.netCapital), helper: `入金 ${formatForexMoney(summary.totalDeposit)} / 出金 ${formatForexMoney(summary.totalWithdrawal)}` },
            { label: '当前净值', value: formatForexMoney(summary.equity), helper: '净入金 + 已实现净收益' },
            { label: 'ROI', value: formatForexPercent(summary.roi), helper: `XAU ${summary.xauCount} / XAG ${summary.xagCount}` },
          ]}
        />

        {/* Two-column: P&L Curve (left) + Win/Loss Distribution (right) */}
        <div className="grid grid-cols-2 gap-5">
          <div style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
            <div className="forex-chart-header">
              <strong>每日盈亏曲线</strong>
              <span>按交易日观察净盈亏变化趋势。</span>
            </div>
            {hasTrendData ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trend}>
                  <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'var(--color-ink-subtle)', fontSize: 11 }}
                    tickFormatter={(value) => String(value ?? '').slice(5)}
                    interval="preserveStartEnd"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [formatForexMoney(Number(value ?? 0)), '净盈亏']}
                    labelFormatter={(label) => `日期 ${String(label ?? '')}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="netPnl"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="暂无盈亏曲线" description="先录入几笔交易记录，趋势线才会形成。" />
            )}
          </div>

          <div style={{ backgroundColor: 'var(--color-surface-2)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
            <div className="forex-chart-header">
              <strong>盈亏分布</strong>
              <span>盈利与亏损笔数占比，配合盈亏比判断执行质量。</span>
            </div>
            {summary.tradeCount > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: '盈利', value: Math.max(0, winCount), color: 'var(--color-success)' },
                        { name: '亏损', value: Math.max(0, lossCount), color: 'var(--color-danger)' },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={92}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="var(--color-surface-2)"
                      strokeWidth={2}
                    >
                      {[
                        { name: '盈利', value: Math.max(0, winCount), color: 'var(--color-success)' },
                        { name: '亏损', value: Math.max(0, lossCount), color: 'var(--color-danger)' },
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
                    <span style={{ fontSize: 14, color: 'var(--color-ink-muted)' }}>盈利 {winCount} 笔</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
                    <span style={{ fontSize: 14, color: 'var(--color-ink-muted)' }}>亏损 {lossCount} 笔</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-ink-subtle)' }}>盈亏比</span>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      color: summary.profitLossRatio >= 1 ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {summary.profitLossRatio > 0 ? summary.profitLossRatio.toFixed(2) : '--'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState title="暂无盈亏分布" description="当前区间形成有效盈亏样本后，这里会自动拆分结构。" />
            )}
          </div>
        </div>

        {/* Instrument Analysis Table (full width) */}
        <ChartCard
          title="品种分析"
          description="按交易品种拆分笔数、盈亏、均盈和胜率。"
        >
          {hasInstrumentData ? (
            <table className="forex-instrument-table">
              <thead>
                <tr>
                  <th>品种</th>
                  <th className="text-right">笔数</th>
                  <th className="text-right">总盈亏</th>
                  <th className="text-right">均盈</th>
                  <th className="text-right">胜率</th>
                </tr>
              </thead>
              <tbody>
                {instrumentSummary.map((item) => (
                  <tr key={item.instrument}>
                    <td className="font-medium" style={{ color: 'var(--color-ink)' }}>
                      {getForexInstrumentLabel(item.instrument)}
                    </td>
                    <td className="text-right" style={{ color: 'var(--color-ink-muted)' }}>
                      {item.tradeCount}
                    </td>
                    <td
                      className="text-right font-mono font-medium"
                      style={{ color: item.netPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                    >
                      {formatForexAmount(item.netPnl)}
                    </td>
                    <td className="text-right font-mono" style={{ color: 'var(--color-ink-muted)' }}>
                      {item.tradeCount > 0 ? formatForexMoney(item.grossPnl / item.tradeCount) : '--'}
                    </td>
                    <td className="text-right" style={{ color: 'var(--color-ink-muted)' }}>
                      {formatForexPercent(item.winRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="暂无品种分析" description="先录入 XAUUSD 或 XAGUSD 交易后，这里会形成对比。" />
          )}
        </ChartCard>

        {/* DeepSeek AI Analysis */}
        <ChartCard
          title="AI 智能分析"
          description="选择日期范围，由 DeepSeek AI 根据交易记录进行多维度分析，仅在你手动点击后触发。"
        >
          <div className="forex-ai-controls">
            <input
              type="text"
              value={aiStartDate}
              onChange={(e) => setAiStartDate(e.target.value)}
              placeholder="起始日期"
              className="forex-ai-date-input"
            />
            <span style={{ color: 'var(--color-ink-subtle)' }}>—</span>
            <input
              type="text"
              value={aiEndDate}
              onChange={(e) => setAiEndDate(e.target.value)}
              placeholder="结束日期"
              className="forex-ai-date-input"
            />
            <Btn tone="primary" onClick={handleAiAnalyze} disabled={aiLoading}>
              {aiLoading ? '分析中...' : '开始分析'}
            </Btn>
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
