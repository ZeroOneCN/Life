import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Field, Tag } from '../ui';
import {
  buildRentChannelBreakdown,
  buildRentCostBreakdown,
  buildRentOverview,
  formatRentAmount,
} from '../../services/rent';
import type { RentChannel, RentHousingRecord } from '../../types/rent';

interface RentStatisticsSectionProps {
  records: RentHousingRecord[];
  channels: RentChannel[];
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
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`chart-card ${className ?? ''}`.trim()}>
      <div className="fitness-chart-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  );
}

export function RentStatisticsSection({
  records,
  channels,
}: RentStatisticsSectionProps) {
  const overview = useMemo(() => buildRentOverview(records, channels), [records, channels]);
  const costBreakdown = useMemo(() => buildRentCostBreakdown(records), [records]);
  const channelBreakdown = useMemo(() => buildRentChannelBreakdown(records, channels), [records, channels]);
  const topCostItems = costBreakdown.slice(0, 6);

  return (
    <SectionCard
      title="统计分析"
      description="围绕当前用户的住房档案，查看总成本、费用结构和租房渠道分布。押金会单独展示，但不会混入成本图表。"
      action={<Tag tone="blue">成本统计默认排除押金</Tag>}
    >
      <div className="page-stack">
        <StatGrid
          className="rent-summary-grid"
          items={[
            { label: '总记录数', value: `${overview.totalRecords} 条` },
            { label: '总居住天数', value: `${overview.totalStayDays} 天` },
            { label: '总成本', value: formatRentAmount(overview.totalCost) },
            { label: '平均单日成本', value: formatRentAmount(overview.avgDailyCost) },
            { label: '平均月租', value: formatRentAmount(overview.avgMonthlyCost) },
            {
              label: '在住 / 已退租',
              value: `${overview.activeRecords} / ${overview.endedRecords}`,
              helper: `${overview.totalChannels} 个渠道参与统计`,
            },
          ]}
        />

        <div className="rent-statistics-grid">
          <ChartCard
            title="费用结构占比"
            description="这张卡改成横向短布局，重点快速看清成本构成，而不是占掉太多垂直空间。"
            className="rent-chart-card-wide"
          >
            {costBreakdown.length ? (
              <div className="rent-cost-overview-layout">
                <div className="rent-cost-overview-chart">
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={costBreakdown}
                        dataKey="value"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        outerRadius={66}
                        innerRadius={34}
                        paddingAngle={2}
                        labelLine={false}
                      >
                        {costBreakdown.map((item) => (
                          <Cell key={item.key} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [formatRentAmount(Number(value ?? 0)), '金额']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="rent-cost-overview-copy">
                  <div className="rent-cost-overview-metrics">
                    <div className="callout callout-neutral">
                      <strong>成本总额</strong>
                      <span>{formatRentAmount(overview.totalCost)}</span>
                    </div>
                    <div className="callout callout-neutral">
                      <strong>主成本项</strong>
                      <span>{costBreakdown[0]?.label ?? '暂无'}</span>
                    </div>
                  </div>

                  <div className="rent-cost-overview-legend">
                    {topCostItems.map((item) => (
                      <article key={item.key} className="rent-cost-legend-item">
                        <div className="rent-cost-legend-main">
                          <span className="rent-cost-legend-dot" style={{ background: item.color }} />
                          <strong>{item.label}</strong>
                        </div>
                        <span>{formatRentAmount(item.value)}</span>
                        <span>{item.percentage.toFixed(2)}%</span>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="暂无费用结构数据" description="先补充住房费用记录，图表和占比摘要才会出现。" />
            )}
          </ChartCard>

          <ChartCard title="费用结构明细" description="逐项查看每一类费用的金额和占比。">
            {costBreakdown.length ? (
              <div className="rent-breakdown-list">
                {costBreakdown.map((item) => (
                  <article key={item.key} className="rent-breakdown-item">
                    <div className="rent-breakdown-head">
                      <strong>{item.label}</strong>
                      <span>{item.percentage.toFixed(2)}%</span>
                    </div>
                    <div className="rent-breakdown-bar">
                      <span style={{ width: `${Math.max(item.percentage, 6)}%`, background: item.color }} />
                    </div>
                    <div className="rent-breakdown-foot">
                      <span>{formatRentAmount(item.value)}</span>
                      <span>按累计住房成本聚合</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无费用结构明细" description="先录入房租、水电或服务费后，这里会自动聚合。" />
            )}
          </ChartCard>

          <ChartCard title="渠道使用分布" description="查看不同租房渠道被使用的次数。">
            {channelBreakdown.length ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={channelBreakdown} layout="vertical" margin={{ left: 18 }}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <YAxis
                      type="category"
                      dataKey="channelName"
                      width={86}
                      tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [`${value} 条`, '使用次数']}
                    />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                      {channelBreakdown.map((item) => (
                        <Cell key={item.channelId} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无渠道分布数据" description="如果当前用户还没有住房记录，渠道分布会在这里保持空状态。" />
            )}
          </ChartCard>
        </div>
      </div>
    </SectionCard>
  );
}
