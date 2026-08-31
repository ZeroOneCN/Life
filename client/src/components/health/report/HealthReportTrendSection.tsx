import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Grid } from '@arco-design/web-react';
import { EmptyState, SectionCard } from '../../page';
const Row = Grid.Row;
const Col = Grid.Col;
import type { HealthReportRangeSummary } from '../../../types/healthReport';

interface HealthReportTrendSectionProps {
  current: HealthReportRangeSummary | null;
  previous: HealthReportRangeSummary | null;
  loading: boolean;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

/**
 * 趋势分析 Section：以柱状图对比当前周期与上一周期在步数 / 运动 / 饮食 / 用药 4 个维度上的指标。
 * @param current - 当前周期汇总
 * @param previous - 上一周期汇总
 * @param loading - 是否加载中
 */
export function HealthReportTrendSection({
  current,
  previous,
  loading,
}: HealthReportTrendSectionProps) {
  if (loading) {
    return (
      <SectionCard title="趋势分析" description="正在加载周期对比…">
        <div className="skeleton-block" />
      </SectionCard>
    );
  }

  if (!current || !previous) {
    return (
      <SectionCard title="趋势分析" description="当前周期与上一周期对比">
        <EmptyState title="暂无对比数据" description="需要至少两个周期的数据才能生成趋势对比。" />
      </SectionCard>
    );
  }

  // 归一化不同维度，便于在一张图上对比（按相对比例展示当前 vs 上一）
  const chartData = [
    {
      name: '步数(千)',
      当前: Number((current.step.totalSteps / 1000).toFixed(1)),
      上期: Number((previous.step.totalSteps / 1000).toFixed(1)),
    },
    {
      name: '运动消耗(百 kcal)',
      当前: Number((current.exercise.totalCalories / 100).toFixed(1)),
      上期: Number((previous.exercise.totalCalories / 100).toFixed(1)),
    },
    {
      name: '净热量(千 kcal)',
      当前: Number((current.diet.netCalories / 1000).toFixed(1)),
      上期: Number((previous.diet.netCalories / 1000).toFixed(1)),
    },
    {
      name: '用药天数',
      当前: current.medication.recordDays,
      上期: previous.medication.recordDays,
    },
    {
      name: '运动天数',
      当前: current.exercise.activeDays,
      上期: previous.exercise.activeDays,
    },
  ];

  return (
    <SectionCard title="趋势分析" description={`当前 ${current.label} vs 上期 ${previous.label}`}>
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--color-ink-2)', fontSize: 12 }}
              stroke="var(--color-hairline)"
            />
            <YAxis
              tick={{ fill: 'var(--color-ink-3)', fontSize: 10 }}
              stroke="var(--color-hairline)"
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => [value, name === '当前' ? current.label : previous.label]}
            />
            <Legend formatter={(value) => value} />
            <Bar dataKey="当前" name="当前" fill="#5e6ad2" radius={[6, 6, 0, 0]} />
            <Bar dataKey="上期" name="上期" fill="#c7d2fe" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="health-report-trend-hint">
        <span className="muted">提示：为便于对比，已将不同维度的指标按数量级归一化。</span>
      </div>
    </SectionCard>
  );
}
