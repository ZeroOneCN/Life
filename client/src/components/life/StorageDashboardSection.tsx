import { useEffect, useState } from 'react';
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
import { SelectField } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { formatStorageMoney } from '../../services/storage';
import { storageApi } from '../../services/storageApi';
import type { StorageCostRankingPoint, StorageOverviewSummary, StoragePageSettings, StoragePurchaseTrendPoint } from '../../types/storage';

type RankingTab = 'cost' | 'duration';

interface StorageDashboardSectionProps {
  settings: StoragePageSettings;
  showToast: (message: string, type?: 'success' | 'error') => void;
  onChanged: () => void;
}

const EMPTY_OVERVIEW: StorageOverviewSummary = {
  totalCount: 0,
  activeCount: 0,
  archivedCount: 0,
  totalPurchaseAmount: 0,
  currentDailyCostTotal: 0,
  averageUsageDays: 0,
  currentMonthNewCount: 0,
  highestDailyCostItemName: '',
  highestDailyCost: 0,
};

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

export function StorageDashboardSection({
  settings,
  showToast,
  onChanged,
}: StorageDashboardSectionProps) {
  const [overview, setOverview] = useState<StorageOverviewSummary>(EMPTY_OVERVIEW);
  const [trend, setTrend] = useState<StoragePurchaseTrendPoint[]>([]);
  const [ranking, setRanking] = useState<StorageCostRankingPoint[]>([]);
  const [rankingTab, setRankingTab] = useState<RankingTab>('cost');

  const loadDashboard = async () => {
    try {
      const [nextOverview, nextTrend, nextRanking] = await Promise.all([
        storageApi.getOverview(),
        storageApi.getPurchaseTrend(),
        storageApi.getCostRanking(),
      ]);
      setOverview(nextOverview);
      setTrend(nextTrend);
      setRanking(nextRanking);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '成本看板加载失败。'), 'error');
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [settings.includeArchivedInDashboard, settings.defaultDashboardRange, settings.defaultSort]);

  const hasData = Boolean(overview.totalCount);
  const activeRanking = ranking.filter((item) => item.status === 'active').slice(0, 6);
  const durationRanking = [...ranking].sort((left, right) => right.usageDays - left.usageDays).slice(0, 6);
  const priceBreakdown = ranking.slice(0, 6).map((item, index) => ({
    id: item.id,
    name: item.itemName,
    value: item.purchasePrice,
    dailyCost: item.dailyCost,
    usageDays: item.usageDays,
    status: item.status,
    color: ['#5e6ad2', '#1eaedb', '#27a644', '#f59e0b', '#e5484d', '#10b981'][index % 6],
  }));

  return (
    <SectionCard
      title="成本看板"
      description="数据概览、趋势分析与成本排行，帮助您掌握物品持有成本全貌。"
    >
      <div className="page-stack">
        <div className="storage-dashboard-toolbar">
          <SelectField
            label="时间范围"
            value={settings.defaultDashboardRange}
            onChange={async (event) => {
              try {
                await storageApi.updateSettings({ defaultDashboardRange: event.target.value as StoragePageSettings['defaultDashboardRange'] });
                onChanged();
                await loadDashboard();
              } catch (error) {
                showToast(buildApiErrorMessage(error, '更新时间范围失败。'), 'error');
              }
            }}
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
            { label: '使用中', value: `${overview.activeCount} 件` },
            { label: '已归档', value: `${overview.archivedCount} 件` },
            { label: '累计购入金额', value: formatStorageMoney(overview.totalPurchaseAmount) },
            { label: '日均成本', value: formatStorageMoney(overview.currentDailyCostTotal), helper: '按自然日持续摊销' },
            { label: '平均持有天数', value: `${overview.averageUsageDays} 天` },
            { label: '本月新增', value: `${overview.currentMonthNewCount} 件` },
            {
              label: '最高日均成本',
              value: overview.highestDailyCostItemName || '暂无数据',
              helper: overview.highestDailyCost ? formatStorageMoney(overview.highestDailyCost) : undefined,
            },
          ]}
        />

        {hasData ? (
          <div className="storage-dashboard-grid">
            <div className="fitness-chart-card storage-chart-card-wide">
              <div className="fitness-chart-header">
                <strong>购入金额趋势</strong>
                <span>近12个月购入金额与件数变化</span>
              </div>
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
            </div>

            <div className="storage-dashboard-columns">
              <div className="fitness-chart-card">
                <div className="storage-ranking-tabs">
                  <button
                    type="button"
                    className={`storage-ranking-tab ${rankingTab === 'cost' ? 'active' : ''}`}
                    onClick={() => setRankingTab('cost')}
                  >
                    日均成本排行
                  </button>
                  <button
                    type="button"
                    className={`storage-ranking-tab ${rankingTab === 'duration' ? 'active' : ''}`}
                    onClick={() => setRankingTab('duration')}
                  >
                    持有天数排行
                  </button>
                </div>

                {rankingTab === 'cost' ? (
                  activeRanking.length ? (
                    <div className="storage-ranking-list">
                      {activeRanking.map((item, index) => (
                        <article key={item.id} className="storage-ranking-item">
                          <span className="storage-ranking-index">{index + 1}</span>
                          <div className="storage-ranking-main">
                            <strong>{item.itemName}</strong>
                            <span>{item.usageDays} 天 · 购入 {formatStorageMoney(item.purchasePrice)}</span>
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
                  )
                ) : (
                  durationRanking.length ? (
                    <div className="storage-ranking-list">
                      {durationRanking.map((item, index) => (
                        <article key={item.id} className="storage-ranking-item">
                          <span className="storage-ranking-index">{index + 1}</span>
                          <div className="storage-ranking-main">
                            <strong>{item.itemName}</strong>
                            <span>{item.purchaseDate}{item.endDate ? ` -> ${item.endDate}` : ' -> 今天'}</span>
                          </div>
                          <div className="storage-ranking-value">
                            <strong>{item.usageDays} 天</strong>
                            <span>{item.endDate ? '最终持有' : '持续累计'}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="暂无持有天数排行" description="录入更多物品后，这里会按使用天数自动拉开差异。" />
                  )
                )}
              </div>

              <div className="fitness-chart-card">
                <div className="fitness-chart-header">
                  <strong>购入价格分布</strong>
                  <span>当前最重的预算投入分布</span>
                </div>
                {priceBreakdown.length ? (
                  <div className="storage-price-layout">
                    <div className="storage-price-chart">
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={priceBreakdown}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={84}
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
                  </div>
                ) : (
                  <EmptyState title="暂无购入价格分布" description="物品数量增加后，价格分布图会更有参考价值。" />
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="暂无可分析的物品数据" description="先录入几件物品，系统就会自动生成购入趋势和成本排行。" />
        )}
      </div>
    </SectionCard>
  );
}
