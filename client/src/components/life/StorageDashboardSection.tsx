import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { EmptyState, SectionCard } from '../page';
import { buildApiErrorMessage } from '../../lib/api';
import { CHART_CATEGORY_6 } from '../../lib/chartPalette';
import { formatStorageMoney } from '../../services/storage';
import { storageApi } from '../../services/storageApi';
import type {
  StorageCostRankingPoint,
  StorageOverviewSummary,
  StoragePageSettings,
  StoragePurchaseTrendPoint,
} from '../../types/storage';

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

const RANGE_OPTIONS: Array<{ value: StoragePageSettings['defaultDashboardRange']; label: string }> = [
  { value: '30d', label: '30天' },
  { value: '90d', label: '90天' },
  { value: '365d', label: '365天' },
  { value: 'all', label: '全部' },
];

const SEGMENT_COLORS = ['#5e6ad2', '#1eaedb', '#27a644', '#f59e0b', '#e5484d', '#10b981'];

function formatActivityDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function StorageDashboardSection({
  settings,
  showToast,
  onChanged,
}: StorageDashboardSectionProps) {
  const [overview, setOverview] = useState<StorageOverviewSummary>(EMPTY_OVERVIEW);
  const [trend, setTrend] = useState<StoragePurchaseTrendPoint[]>([]);
  const [ranking, setRanking] = useState<StorageCostRankingPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [settings.includeArchivedInDashboard, settings.defaultDashboardRange, settings.defaultSort]);

  const handleRangeChange = async (next: StoragePageSettings['defaultDashboardRange']) => {
    if (next === settings.defaultDashboardRange) return;
    try {
      await storageApi.updateSettings({ defaultDashboardRange: next });
      onChanged();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '更新时间范围失败。'), 'error');
    }
  };

  const hasData = Boolean(overview.totalCount);

  // 价格分布数据
  const priceBreakdown = useMemo(() => {
    const total = ranking.reduce((sum, item) => sum + (item.purchasePrice || 0), 0) || 1;
    return ranking.slice(0, 6).map((item, index) => ({
      id: item.id,
      name: item.itemName,
      value: item.purchasePrice,
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
      percent: (item.purchasePrice / total) * 100,
    }));
  }, [ranking]);

  // 活动流：按购入日期倒序
  const activityFeed = useMemo(() => {
    return [...ranking]
      .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
      .slice(0, 8);
  }, [ranking]);

  // 成本 Top 3
  const topCost = useMemo(() => {
    return ranking
      .filter((item) => item.status === 'active')
      .sort((a, b) => b.dailyCost - a.dailyCost)
      .slice(0, 3);
  }, [ranking]);

  const rangePills = (
    <div className="storage-dashboard-range">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`storage-range-pill ${settings.defaultDashboardRange === option.value ? 'active' : ''}`}
          onClick={() => handleRangeChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  if (!hasData) {
    return (
      <SectionCard
        title="成本看板"
        description="数据概览、活动流与成本分析"
        action={rangePills}
      >
        <div className="storage-dashboard-empty">
          <EmptyState
            title="暂无可分析的物品数据"
            description="先录入几件物品，系统就会自动生成趋势、活动和成本排行。"
            icon="📈"
          />
        </div>
        {loading ? <div className="storage-dashboard-loading">加载中…</div> : null}
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="成本看板"
      description="数据概览、活动流与成本分析"
      action={rangePills}
    >
      <div className="storage-dashboard-stack">
      {/* Hero 4 张数字卡 */}
      <div className="storage-hero-grid">
        <div className="storage-hero-card">
          <span className="storage-hero-label">总物品数</span>
          <strong className="storage-hero-value">{overview.totalCount}</strong>
          <span className="storage-hero-hint">使用中 {overview.activeCount} · 归档 {overview.archivedCount}</span>
        </div>
        <div className="storage-hero-card storage-hero-card-accent">
          <span className="storage-hero-label">累计购入金额</span>
          <strong className="storage-hero-value">{formatStorageMoney(overview.totalPurchaseAmount)}</strong>
          <span className="storage-hero-hint">所有时间投入</span>
        </div>
        <div className="storage-hero-card">
          <span className="storage-hero-label">日均成本</span>
          <strong className="storage-hero-value">{formatStorageMoney(overview.currentDailyCostTotal)}</strong>
          <span className="storage-hero-hint">按自然日持续摊销</span>
        </div>
        <div className="storage-hero-card">
          <span className="storage-hero-label">本月新增</span>
          <strong className="storage-hero-value">{overview.currentMonthNewCount}</strong>
          <span className="storage-hero-hint">平均持有 {overview.averageUsageDays} 天</span>
        </div>
      </div>

      {/* 趋势 + 分布 双列 */}
      <div className="storage-mid-grid">
        <div className="storage-panel">
          <div className="storage-panel-head">
            <strong>月度购入趋势</strong>
            <span>近 12 个月购入金额与件数</span>
          </div>
          <div className="storage-trend-chart">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend} barCategoryGap="22%">
                <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'var(--color-ink-subtle)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--color-ink-subtle)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: 'color-mix(in srgb, var(--color-primary) 6%, transparent)' }}
                  contentStyle={tooltipStyle}
                  formatter={(value, key) =>
                    key === 'amount'
                      ? [formatStorageMoney(Number(value ?? 0)), '购入金额']
                      : [`${Number(value ?? 0)} 件`, '购入件数']
                  }
                />
                <Bar dataKey="amount" fill="var(--color-primary)" radius={[8, 8, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="storage-panel">
          <div className="storage-panel-head">
            <strong>价格分布</strong>
            <span>前 6 件购入金额占比</span>
          </div>
          {priceBreakdown.length ? (
            <div className="storage-distribution">
              <div className="storage-distribution-bar">
                {priceBreakdown.map((item) =>
                  item.percent > 0 ? (
                    <span
                      key={item.id}
                      className="storage-distribution-segment"
                      style={{ width: `${item.percent}%`, background: item.color }}
                      title={`${item.name} · ${formatStorageMoney(item.value)} · ${item.percent.toFixed(0)}%`}
                    />
                  ) : null,
                )}
              </div>
              <ul className="storage-distribution-legend">
                {priceBreakdown.map((item) => (
                  <li key={item.id} className="storage-distribution-legend-item">
                    <span className="storage-distribution-dot" style={{ background: item.color }} />
                    <span className="storage-distribution-name" title={item.name}>{item.name}</span>
                    <span className="storage-distribution-percent">{item.percent.toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="storage-panel-empty">暂无分布数据</div>
          )}
        </div>
      </div>

      {/* 活动流 */}
      <div className="storage-panel">
        <div className="storage-panel-head">
          <strong>最近活动</strong>
          <span>按购入时间倒序</span>
        </div>
        {activityFeed.length ? (
          <ul className="storage-activity-feed">
            {activityFeed.map((item) => (
              <li key={item.id} className="storage-activity-item">
                <span className="storage-activity-date">{formatActivityDate(item.purchaseDate)}</span>
                <span className={`tag ${item.status === 'active' ? 'tag-green' : 'tag-muted'}`}>
                  {item.status === 'active' ? '使用中' : '已归档'}
                </span>
                <span className="storage-activity-name" title={item.itemName}>{item.itemName}</span>
                <span className="storage-activity-price">{formatStorageMoney(item.purchasePrice)}</span>
                <span className="storage-activity-daily">{formatStorageMoney(item.dailyCost)} / 天</span>
                <span className="storage-activity-days">{item.usageDays} 天</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="storage-panel-empty">暂无活动记录</div>
        )}
      </div>

      {/* 成本 Top 3 */}
      {topCost.length > 0 ? (
        <div className="storage-panel">
          <div className="storage-panel-head">
            <strong>成本 Top 3</strong>
            <span>使用中日均成本最高</span>
          </div>
          <div className="storage-top-grid">
            {topCost.map((item, index) => (
              <article key={item.id} className="storage-top-card">
                <span className="storage-top-rank">{index + 1}</span>
                <div className="storage-top-main">
                  <strong className="storage-top-name" title={item.itemName}>{item.itemName}</strong>
                  <span className="storage-top-meta">{item.usageDays} 天 · 购入 {formatStorageMoney(item.purchasePrice)}</span>
                </div>
                <div className="storage-top-value">
                  <strong>{formatStorageMoney(item.dailyCost)}</strong>
                  <span>每日摊销</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? <div className="storage-dashboard-loading">加载中…</div> : null}
      </div>
    </SectionCard>
  );
}
