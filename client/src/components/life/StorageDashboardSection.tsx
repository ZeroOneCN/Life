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
import { SelectField, Tag } from '../ui';
import {
  buildStorageCostRanking,
  buildStorageOverview,
  buildStoragePurchaseTrend,
  formatStorageMoney,
  getStorageStatusLabel,
} from '../../services/storage';
import type { StorageItemRecord, StoragePageSettings } from '../../types/storage';

interface StorageDashboardSectionProps {
  items: StorageItemRecord[];
  settings: StoragePageSettings;
  onSettingsChange: (patch: Partial<StoragePageSettings>) => void;
}

const chartColors = ['#5e6ad2', '#1eaedb', '#27a644', '#f59e0b', '#e5484d', '#10b981', '#0ea5e9', '#f97316'];
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

export function StorageDashboardSection({
  items,
  settings,
  onSettingsChange,
}: StorageDashboardSectionProps) {
  const overview = useMemo(() => buildStorageOverview(items, settings), [items, settings]);
  const trend = useMemo(() => buildStoragePurchaseTrend(items, settings), [items, settings]);
  const ranking = useMemo(() => buildStorageCostRanking(items, settings), [items, settings]);

  const activeRanking = ranking.filter((item) => item.status === 'active').slice(0, 6);
  const durationRanking = [...ranking].sort((left, right) => right.usageDays - left.usageDays).slice(0, 6);
  const priceBreakdown = ranking.slice(0, 6).map((item, index) => ({
    id: item.id,
    name: item.itemName,
    value: item.purchasePrice,
    dailyCost: item.dailyCost,
    usageDays: item.usageDays,
    status: item.status,
    color: chartColors[index % chartColors.length],
  }));
  const hasData = items.length > 0;

  return (
    <SectionCard
      title="成本看板"
      description="围绕购买金额、日均成本和持有天数三个维度观察物品的摊销节奏，帮助判断哪些东西正在真正消耗预算。"
      action={<Tag tone="blue">{settings.includeArchivedInDashboard ? '含已归档物品' : '仅统计使用中物品'}</Tag>}
    >
      <div className="page-stack">
        <div className="storage-dashboard-toolbar">
          <SelectField
            label="看板时间范围"
            value={settings.defaultDashboardRange}
            onChange={(event) => onSettingsChange({ defaultDashboardRange: event.target.value as StoragePageSettings['defaultDashboardRange'] })}
          >
            <option value="30d">近 30 天</option>
            <option value="90d">近 90 天</option>
            <option value="365d">近 365 天</option>
            <option value="all">全部时间</option>
          </SelectField>
        </div>

        <StatGrid
          className="storage-overview-grid"
          items={[
            { label: '总物品数', value: `${overview.totalCount} 件` },
            { label: '使用中物品数', value: `${overview.activeCount} 件` },
            { label: '已归档物品数', value: `${overview.archivedCount} 件` },
            { label: '累计购入金额', value: formatStorageMoney(overview.totalPurchaseAmount) },
            { label: '当前总日均成本', value: formatStorageMoney(overview.currentDailyCostTotal), helper: '按自然日持续摊销' },
            { label: '平均持有天数', value: `${overview.averageUsageDays} 天` },
            { label: '本月新增物品数', value: `${overview.currentMonthNewCount} 件` },
            {
              label: '当前最高日均成本物品',
              value: overview.highestDailyCostItemName,
              helper: overview.highestDailyCost ? formatStorageMoney(overview.highestDailyCost) : '暂无数据',
            },
          ]}
        />

        {hasData ? (
          <div className="storage-dashboard-grid">
            <ChartCard
              title="近 12 个月购入金额趋势"
              description="按月份聚合每个月的购入金额与件数，快速回看你在哪些月份买得最集中。"
              className="storage-chart-card-wide"
            >
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={trend}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, key) => (
                        key === 'amount'
                          ? [formatStorageMoney(Number(value ?? 0)), '购入金额']
                          : [`${Number(value ?? 0)} 件`, '购入件数']
                      )}
                    />
                    <Bar dataKey="amount" fill="var(--color-primary)" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <div className="storage-dashboard-columns">
              <div className="storage-dashboard-stack">
                <ChartCard
                  title="当前使用中物品日均成本排行"
                  description="优先识别哪些东西虽然已经买下，但每天仍在高频“消耗”你的预算。"
                >
                  {activeRanking.length ? (
                    <div className="storage-ranking-list">
                      {activeRanking.map((item, index) => (
                        <article key={item.id} className="storage-ranking-item">
                          <span className="storage-ranking-index">{index + 1}</span>
                          <div className="storage-ranking-main">
                            <strong>{item.itemName}</strong>
                            <span>{item.usageDays} 天 · 买入 {formatStorageMoney(item.purchasePrice)}</span>
                          </div>
                          <div className="storage-ranking-value">
                            <strong>{formatStorageMoney(item.dailyCost)}</strong>
                            <span>每日摊销</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="暂无使用中的排行数据" description="至少保留一件使用中的物品，日均成本排行才会出现。" />
                  )}
                </ChartCard>

                <ChartCard
                  title="持有天数排行"
                  description="把持有最久的物品列出来，帮助你判断哪些投入已经被充分摊薄。"
                >
                  {durationRanking.length ? (
                    <div className="storage-ranking-list">
                      {durationRanking.map((item, index) => (
                        <article key={item.id} className="storage-ranking-item">
                          <span className="storage-ranking-index">{index + 1}</span>
                          <div className="storage-ranking-main">
                            <strong>{item.itemName}</strong>
                            <span>{item.purchaseDate}{item.endDate ? ` → ${item.endDate}` : ' → 今天'}</span>
                          </div>
                          <div className="storage-ranking-value">
                            <strong>{item.usageDays} 天</strong>
                            <span>{item.endDate ? '最终持有' : '持续累计'}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="暂无持有天数排行" description="录入更多物品后，这里会自动按使用天数拉开差异。" />
                  )}
                </ChartCard>
              </div>

              <div className="storage-dashboard-stack">
                <ChartCard
                  title="购入价格分布"
                  description="按购入价格查看当前最重的预算投入，并配合明细摘要一起回看每件物品的摊销状态。"
                >
                  {priceBreakdown.length ? (
                    <div className="storage-price-layout">
                      <div className="storage-price-chart">
                        <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie
                              data={priceBreakdown}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={52}
                              outerRadius={92}
                              paddingAngle={3}
                            >
                              {priceBreakdown.map((item) => (
                                <Cell key={item.id} fill={item.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={tooltipStyle}
                              formatter={(value) => [formatStorageMoney(Number(value ?? 0)), '购买价格']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="storage-price-legend">
                        {priceBreakdown.map((item) => (
                          <article key={item.id} className="storage-price-legend-item">
                            <div className="storage-price-legend-main">
                              <span className="storage-price-legend-dot" style={{ background: item.color }} />
                              <div>
                                <strong>{item.name}</strong>
                                <span>{getStorageStatusLabel(item.status)} · {item.usageDays} 天</span>
                              </div>
                            </div>
                            <div className="storage-price-legend-value">
                              <strong>{formatStorageMoney(item.value)}</strong>
                              <span>{formatStorageMoney(item.dailyCost)} / 天</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState title="暂无购入价格分布" description="物品数量增加后，价格分布图会更有参考价值。" />
                  )}
                </ChartCard>

                <div className="storage-dashboard-mini-grid">
                  <div className="callout callout-neutral">
                    <strong>当前最高日均成本</strong>
                    <span>{overview.highestDailyCostItemName}</span>
                    <div>{overview.highestDailyCost ? formatStorageMoney(overview.highestDailyCost) : '暂无数据'}</div>
                  </div>
                  <div className="callout callout-neutral">
                    <strong>平均持有天数</strong>
                    <span>当前统计样本的平均生命周期</span>
                    <div>{overview.averageUsageDays} 天</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="暂无可分析的物品数据"
            description="先录入几件物品，系统就会自动生成购入趋势、日均成本排行和持有天数排行。"
          />
        )}
      </div>
    </SectionCard>
  );
}
