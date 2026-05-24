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
  userId: string;
  records: RentHousingRecord[];
  channels: RentChannel[];
  onUserIdChange: (value: string) => void;
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
    <div className={`fitness-chart-card ${className ?? ''}`.trim()}>
      <div className="fitness-chart-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  );
}

export function RentStatisticsSection({
  userId,
  records,
  channels,
  onUserIdChange,
}: RentStatisticsSectionProps) {
  const overview = useMemo(() => buildRentOverview(records, channels, userId), [records, channels, userId]);
  const costBreakdown = useMemo(() => buildRentCostBreakdown(records, userId), [records, userId]);
  const channelBreakdown = useMemo(() => buildRentChannelBreakdown(records, channels, userId), [records, channels, userId]);

  return (
    <SectionCard
      title="统计分析"
      description="从住房档案中自动提取居住天数、总成本、费用结构和渠道分布，帮助你回看每段租住周期的真实成本。"
      action={<Tag tone="blue">押金单独展示，不计入成本图表</Tag>}
    >
      <div className="page-stack">
        <div className="rent-context-grid">
          <Field
            label="统计用户 ID"
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            placeholder="留空查看全部用户"
            hint="总览卡、费用结构和渠道分布都会跟随这里刷新。"
          />
        </div>

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
            description="不含押金，只统计真实居住成本。"
            className="rent-chart-card-compact"
          >
            {costBreakdown.length ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={costBreakdown}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={74}
                      label={({ name, percent }) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`}
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
            ) : (
              <EmptyState title="暂无费用结构数据" description="先补充住房费用记录，图表才会形成占比。" />
            )}
          </ChartCard>

          <ChartCard title="费用结构明细" description="查看每一类费用的金额和占比。">
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
                      <span>颜色已同步主题图表</span>
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
                    <XAxis type="number" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="channelName"
                      width={86}
                      tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }}
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
              <EmptyState title="暂无渠道分布数据" description="如果某个用户还没有住房记录，渠道分布会在这里保持空状态。" />
            )}
          </ChartCard>
        </div>
      </div>
    </SectionCard>
  );
}
