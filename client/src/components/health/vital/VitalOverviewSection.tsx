import { EmptyState, SectionCard, StatGrid } from '../../page';
import type { VitalOverview } from '../../../types/vital';

interface VitalOverviewSectionProps {
  overview: VitalOverview | null;
  loading: boolean;
}

/**
 * 体征概览 Section：展示各指标最新值、异常数、记录总数。
 * @param overview - 概览数据
 * @param loading - 是否加载中
 */
export function VitalOverviewSection({ overview, loading }: VitalOverviewSectionProps) {
  if (loading) {
    return (
      <SectionCard title="体征概览" description="正在加载体征数据…">
        <div className="stat-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="stat-card" key={i}>
              <span className="stat-label">加载中</span>
              <strong className="stat-value skeleton-text">—</strong>
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  if (!overview || overview.totalRecords === 0) {
    return (
      <SectionCard title="体征概览" description="各指标最新值一览">
        <EmptyState title="暂无体征记录" description="录入第一条体征数据，开启健康追踪。" />
      </SectionCard>
    );
  }

  const items = overview.metrics.map((metric) => ({
    label: metric.label,
    value: metric.latest ? `${metric.latest.value} ${metric.unit}` : '-',
    helper: `${metric.recordCount} 条记录 · 异常 ${metric.abnormalCount} 次`,
    accent: metric.latest?.status === 'abnormal' ? '#e5484d' : metric.latest ? undefined : undefined,
  }));

  return (
    <SectionCard
      title="体征概览"
      description={`共 ${overview.totalRecords} 条记录 · 异常 ${overview.totalAbnormal} 次 · 最近 ${overview.latestRecordTime ?? '-'}`}
    >
      <StatGrid items={items} className="vital-overview-grid" />
    </SectionCard>
  );
}
