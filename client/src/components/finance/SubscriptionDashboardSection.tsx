import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { SelectField, Tag } from '../ui';
import { CHART_CATEGORY_8, CHART_PNL } from '../../lib/chartPalette';
import {
  buildSubscriptionCategoryBreakdown,
  buildSubscriptionExpiryTimeline,
  buildSubscriptionOverview,
  formatSubscriptionAmount,
  getSubscriptionStatus,
} from '../../services/subscription';
import type { SubscriptionCategory, SubscriptionPageState, SubscriptionRecord } from '../../types/subscription';

interface SubscriptionDashboardSectionProps {
  records: SubscriptionRecord[];
  categories: SubscriptionCategory[];
  settings: SubscriptionPageState['settings'];
  onSettingsChange: (patch: Partial<SubscriptionPageState['settings']>) => void;
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

export function SubscriptionDashboardSection({
  records,
  categories,
  settings,
  onSettingsChange,
}: SubscriptionDashboardSectionProps) {
  const overview = useMemo(() => buildSubscriptionOverview(records, settings.leadDays), [records, settings.leadDays]);
  const categoryBreakdown = useMemo(
    () => buildSubscriptionCategoryBreakdown(records, categories, settings.leadDays),
    [categories, records, settings.leadDays],
  );
  const expiryTimeline = useMemo(
    () => buildSubscriptionExpiryTimeline(records, settings.dashboardRangeDays),
    [records, settings.dashboardRangeDays],
  );

  const autoRenewSummary = useMemo(() => {
    const activeRecords = records.filter((record) => getSubscriptionStatus(record, settings.leadDays) !== 'expired');
    const autoCount = activeRecords.filter((record) => record.autoRenew).length;
    const manualCount = Math.max(0, activeRecords.length - autoCount);

    return [
      { name: '自动续费', value: autoCount, color: CHART_CATEGORY_8[0] },
      { name: '手动续费', value: manualCount, color: CHART_PNL.up },
    ].filter((item) => item.value > 0);
  }, [records, settings.leadDays]);

  const upcomingRecords = useMemo(
    () => records
      .filter((record) => getSubscriptionStatus(record, settings.leadDays) === 'upcoming')
      .sort((left, right) => left.endDate.localeCompare(right.endDate))
      .slice(0, 6),
    [records, settings.leadDays],
  );

  const hasCategoryData = categoryBreakdown.length > 0;
  const hasExpiryTimeline = expiryTimeline.length > 0;
  const hasAutoRenewData = autoRenewSummary.length > 0;

  return (
    <SectionCard
      title="统计看板"
      description="从费用结构、续费方式和到期时间轴三个维度回看当前订阅负担，所有金额都统一按人民币展示。"
      action={<Tag tone="green">提醒窗口 {settings.leadDays} 天</Tag>}
    >
      <div className="page-stack">
        <div className="subscription-dashboard-toolbar">
          <SelectField
            label="到期趋势范围"
            value={String(settings.dashboardRangeDays)}
            onChange={(event) => onSettingsChange({ dashboardRangeDays: Number(event.target.value) as 90 | 180 | 365 })}
          >
            <option value="90">近 90 天</option>
            <option value="180">近 180 天</option>
            <option value="365">近 365 天</option>
          </SelectField>
        </div>

        <StatGrid
          className="subscription-dashboard-summary"
          items={[
            { label: '总订阅数', value: `${overview.totalCount} 个` },
            { label: '活跃订阅数', value: `${overview.activeCount} 个` },
            { label: '自动续费数', value: `${overview.autoRenewCount} 个` },
            { label: '即将到期数', value: `${overview.upcomingCount} 个` },
            { label: '月均支出', value: formatSubscriptionAmount(overview.monthlyEstimate) },
            {
              label: '年度支出估算',
              value: formatSubscriptionAmount(overview.annualEstimate),
              helper: overview.nearestExpiryDate ? `最近到期：${overview.nearestExpiryDate}` : '暂无到期时间',
            },
          ]}
        />

        <div className="subscription-dashboard-grid">
          <ChartCard title="分类支出分布" description="按仍在生效或即将到期的订阅聚合年度成本占比。">
            {hasCategoryData ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="annualAmount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      outerRadius={102}
                      label={({ name, percent }) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {categoryBreakdown.map((item) => (
                        <Cell key={item.categoryId || item.categoryName} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [formatSubscriptionAmount(Number(value ?? 0)), '年度估算']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无分类支出分布" description="先新增几条订阅记录，分类支出图才会出现。" />
            )}
          </ChartCard>

          <ChartCard title="到期时间轴" description={`查看未来 ${settings.dashboardRangeDays} 天内的订阅到期密度与预计年支出。`}>
            {hasExpiryTimeline ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={expiryTimeline}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => (
                        name === 'count'
                          ? [String(value), '到期数量']
                          : [formatSubscriptionAmount(Number(value ?? 0)), '年度估算']
                      )}
                      labelFormatter={(label, payload) => {
                        const services = payload?.[0]?.payload?.services as string[] | undefined;
                        return services?.length ? `${label} · ${services.join('、')}` : String(label);
                      }}
                    />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无近期到期数据" description="当前记录里没有落在所选时间窗内的到期订阅。" />
            )}
          </ChartCard>

          <ChartCard title="自动续费占比" description="快速区分哪些订阅是系统自动扣费，哪些需要手动决策续费。">
            {hasAutoRenewData ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={autoRenewSummary}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={44}
                      paddingAngle={3}
                    >
                      {autoRenewSummary.map((item) => (
                        <Cell key={item.name} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [String(value), '订阅数量']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无自动续费数据" description="还没有处于有效期内的订阅可以参与占比统计。" />
            )}
          </ChartCard>

          <ChartCard title="即将到期清单" description="把最靠近提醒窗口的订阅列出来，方便马上处理。">
            {upcomingRecords.length ? (
              <div className="subscription-upcoming-list">
                {upcomingRecords.map((record) => (
                  <article key={record.id} className="subscription-upcoming-item">
                    <div>
                      <strong>{record.serviceName}</strong>
                      <span>{record.planName || record.categoryName}</span>
                    </div>
                    <div>
                      <span>{record.endDate}</span>
                      <span>{formatSubscriptionAmount(record.cyclePrice)} / {record.billingCycle === 'monthly' ? '月' : record.billingCycle === 'quarterly' ? '季' : record.billingCycle === 'yearly' ? '年' : '次'}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无即将到期项" description="当前提醒窗口内没有订阅需要优先处理。" />
            )}
          </ChartCard>
        </div>
      </div>
    </SectionCard>
  );
}
