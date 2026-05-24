import { useMemo, type ReactNode } from 'react';
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
import { Tag } from '../ui';
import {
  FOREX_PNL_COLORS,
  buildForexDailyPnlTrend,
  buildForexDashboardSummary,
  buildForexInsights,
  buildForexInstrumentSummary,
  formatForexAmount,
  formatForexMoney,
  formatForexPercent,
  getForexInstrumentLabel,
} from '../../services/forex';
import type { ForexCapitalFlow, ForexTradeRecord } from '../../types/forex';

interface ForexDashboardSectionProps {
  trades: ForexTradeRecord[];
  capitalFlows: ForexCapitalFlow[];
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
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
  const insights = useMemo(
    () => buildForexInsights(trades, capitalFlows, startDate, endDate),
    [capitalFlows, endDate, startDate, trades],
  );

  const pnlDistribution = useMemo(() => {
    const positive = trades
      .filter((trade) => (!startDate || trade.tradeDate >= startDate) && (!endDate || trade.tradeDate <= endDate))
      .reduce((sum, trade) => sum + Math.max(trade.pnl, 0), 0);
    const negative = trades
      .filter((trade) => (!startDate || trade.tradeDate >= startDate) && (!endDate || trade.tradeDate <= endDate))
      .reduce((sum, trade) => sum + Math.abs(Math.min(trade.pnl, 0)), 0);
    const commission = trades
      .filter((trade) => (!startDate || trade.tradeDate >= startDate) && (!endDate || trade.tradeDate <= endDate))
      .reduce((sum, trade) => sum + Math.abs(trade.commission), 0);

    return [
      { name: '盈利毛利', value: Number(positive.toFixed(2)), color: FOREX_PNL_COLORS[0] },
      { name: '亏损毛损', value: Number(negative.toFixed(2)), color: FOREX_PNL_COLORS[3] },
      { name: '手续费', value: Number(commission.toFixed(2)), color: FOREX_PNL_COLORS[2] },
    ].filter((item) => item.value > 0);
  }, [endDate, startDate, trades]);

  const hasTrendData = trend.some((item) => item.tradeCount > 0 || item.netPnl !== 0);
  const hasInstrumentData = instrumentSummary.some((item) => item.tradeCount > 0);
  const hasDistributionData = pnlDistribution.length > 0;

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
            { label: '总毛盈亏', value: formatForexAmount(summary.grossPnl), accent: summary.grossPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: '总手续费', value: formatForexMoney(summary.totalCommission), accent: 'var(--color-warning)' },
            { label: '净收益', value: formatForexAmount(summary.realizedNetPnl), accent: summary.realizedNetPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: '胜率', value: formatForexPercent(summary.winRate), helper: `盈亏比 ${summary.profitLossRatio.toFixed(2)}` },
            { label: '净入金', value: formatForexMoney(summary.netCapital), helper: `入金 ${formatForexMoney(summary.totalDeposit)} / 出金 ${formatForexMoney(summary.totalWithdrawal)}` },
            { label: '当前净值', value: formatForexMoney(summary.equity), helper: '净入金 + 已实现净收益' },
            { label: 'ROI', value: formatForexPercent(summary.roi), helper: `XAU ${summary.xauCount} / XAG ${summary.xagCount}` },
          ]}
        />

        <div className="forex-dashboard-grid">
          <ChartCard title="每日净收益趋势" description="按交易日观察净收益变化，方便对照行情阶段和执行稳定性。">
            {hasTrendData ? (
              <div className="forex-chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trend}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => {
                        if (name === '交易数') {
                          return [`${String(value ?? 0)} 笔`, '交易数'];
                        }

                        return [formatForexMoney(Number(value ?? 0)), String(name)];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="netPnl"
                      name="净收益"
                      stroke="var(--color-primary)"
                      strokeWidth={2.6}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="grossPnl"
                      name="毛盈亏"
                      stroke="#10b981"
                      strokeWidth={1.8}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无净收益趋势" description="先录入几笔交易记录，趋势线才会形成。" />
            )}
          </ChartCard>

          <ChartCard
            title="盈亏分布"
            description="把盈利、亏损和手续费拆开看，能更快判断收益到底是被什么吃掉了。"
            className="forex-chart-card-compact"
          >
            {hasDistributionData ? (
              <div className="forex-chart-shell forex-chart-shell-compact">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pnlDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={76}
                      label={({ name, percent }) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pnlDistribution.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [formatForexMoney(Number(value ?? 0)), '金额']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无盈亏结构" description="当当前区间形成有效盈亏样本后，这里会自动拆分结构。" />
            )}
          </ChartCard>

          <ChartCard title="品种分析" description="对比黄金和白银在笔数、净收益上的差异，方便发现自己更擅长的节奏。">
            {hasInstrumentData ? (
              <div className="forex-instrument-panel">
                <div className="forex-instrument-summary">
                  {instrumentSummary.map((item) => (
                    <div className="forex-instrument-summary-card" key={item.instrument}>
                      <strong>{getForexInstrumentLabel(item.instrument)}</strong>
                      <span>{`${item.tradeCount} 笔 / 胜率 ${formatForexPercent(item.winRate)}`}</span>
                      <span>{`净收益 ${formatForexAmount(item.netPnl)} / 平均手数 ${item.avgLotSize.toFixed(2)}`}</span>
                      <span>{`做多 ${item.longCount} / 做空 ${item.shortCount} / 手续费 ${formatForexMoney(item.totalCommission)}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState title="暂无品种分析" description="先录入 XAUUSD 或 XAGUSD 交易后，这里会形成对比。" />
            )}
          </ChartCard>
        </div>

        <div className="forex-insight-grid">
          {insights.map((insight) => (
            <article className={`forex-insight-card is-${insight.tone}`} key={insight.id}>
              <div className="forex-insight-header">
                <strong>{insight.title}</strong>
                {insight.metric ? <Tag tone={insight.tone === 'warning' ? 'orange' : insight.tone === 'positive' ? 'green' : 'default'}>{insight.metric}</Tag> : null}
              </div>
              <p>{insight.description}</p>
            </article>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
