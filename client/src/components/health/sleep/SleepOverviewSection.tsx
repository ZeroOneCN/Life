import { Grid } from '@arco-design/web-react';
import { EmptyState, SectionCard } from '../../page';
import type { SleepOverview } from '../../../types/sleep';

const Row = Grid.Row;
const Col = Grid.Col;

interface SleepOverviewSectionProps {
  overview: SleepOverview | null;
  loading: boolean;
}

/**
 * 睡眠概览 Section：展示近 7 天平均时长、平均质量、总记录数等。
 * @param overview - 概览数据
 * @param loading - 是否加载中
 */
export function SleepOverviewSection({ overview, loading }: SleepOverviewSectionProps) {
  const items = overview
    ? [
        {
          label: '近 7 天平均时长',
          value: overview.avgDuration7dLabel,
          accent:
            overview.avgDuration7d >= 420 && overview.avgDuration7d <= 540
              ? '#27a644'
              : overview.avgDuration7d < 420
                ? '#e5484d'
                : '#d97706',
        },
        {
          label: '近 7 天平均质量',
          value: overview.avgQuality7d !== null ? `${overview.avgQuality7d} / 5` : '暂无评分',
          accent:
            overview.avgQuality7d !== null && overview.avgQuality7d >= 4
              ? '#27a644'
              : overview.avgQuality7d !== null && overview.avgQuality7d < 3
                ? '#e5484d'
                : '#d97706',
        },
        {
          label: '总记录数',
          value: String(overview.totalRecords),
        },
      ]
    : [];

  return (
    <SectionCard title="睡眠概览" description="近 7 天睡眠统计">
      {loading ? (
        <div className="skeleton-block" />
      ) : !overview ? (
        <EmptyState title="暂无睡眠数据" description="请先录入睡眠记录。" />
      ) : (
        <Row gutter={[12, 12]}>
          {items.map((item) => (
            <Col span={8} key={item.label}>
              <div className="stat-card">
                <span className="stat-label">{item.label}</span>
                <strong
                  className="stat-value"
                  style={item.accent ? { color: item.accent } : undefined}
                >
                  {item.value}
                </strong>
              </div>
            </Col>
          ))}
        </Row>
      )}
    </SectionCard>
  );
}
