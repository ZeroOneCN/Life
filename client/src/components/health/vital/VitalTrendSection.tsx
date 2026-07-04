import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  Legend,
} from 'recharts';

import { EmptyState, SectionCard } from '../../page';
import { PillTabs } from '../../ui';
import type { VitalTrend, VitalMetricKey, VitalMetricInfo } from '../../../types/vital';

interface VitalTrendSectionProps {
  trend: VitalTrend | null;
  loading: boolean;
  metrics: VitalMetricInfo[];
  selectedMetric: VitalMetricKey;
  period: 'week' | 'month' | 'year';
  onMetricChange: (metric: VitalMetricKey) => void;
  onPeriodChange: (period: 'week' | 'month' | 'year') => void;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

const PERIOD_OPTIONS = [
  { value: 'week', label: '近 7 天' },
  { value: 'month', label: '近 30 天' },
  { value: 'year', label: '近一年' },
] as const;

/**
 * 趋势分析 Section：以折线图展示指定指标在周期内的变化趋势。
 * 包含平均值、最高/最低值、参考范围线。
 * @param trend - 趋势数据
 * @param loading - 是否加载中
 * @param metrics - 可选指标列表
 * @param selectedMetric - 当前选中指标
 * @param period - 当前周期
 * @param onMetricChange - 切换指标回调
 * @param onPeriodChange - 切换周期回调
 */
export function VitalTrendSection({
  trend,
  loading,
  metrics,
  selectedMetric,
  period,
  onMetricChange,
  onPeriodChange,
}: VitalTrendSectionProps) {
  /**
   * 解析参考范围为 [min, max] 数值。
   */
  const rangeValues = useMemo(() => {
    if (!trend) return { min: null as number | null, max: null as number | null };
    const match = trend.referenceRange.replace(/\s+/g, '').match(/^(-?\d+(?:\.\d+)?)(?:-|~)(-?\d+(?:\.\d+)?)$/);
    if (match) {
      return { min: Number(match[1]), max: Number(match[2]) };
    }
    return { min: null, max: null };
  }, [trend]);

  const chartData = useMemo(() => {
    if (!trend) return [];
    return trend.items.map((item) => ({
      ...item,
      avg: item.avgValue,
    }));
  }, [trend]);

  return (
    <SectionCard
      title="趋势分析"
      description={trend ? `${trend.metricLabel} · ${trend.period === 'week' ? '近 7 天' : trend.period === 'month' ? '近 30 天' : '近一年'}` : '选择指标查看趋势'}
      action={
        <div className="vital-trend-controls">
          <PillTabs
            options={metrics.map((m) => ({ value: m.key, label: m.label }))}
            value={selectedMetric}
            onChange={(v) => onMetricChange(v as VitalMetricKey)}
          />
          <PillTabs
            options={PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={period}
            onChange={(v) => onPeriodChange(v as 'week' | 'month' | 'year')}
          />
        </div>
      }
    >
      {loading ? (
        <div className="skeleton-block" />
      ) : !trend || trend.items.every((i) => i.avgValue === null) ? (
        <EmptyState title="暂无趋势数据" description="请先录入体征记录后查看趋势分析。" />
      ) : (
        <>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-2)', fontSize: 11 }} stroke="var(--color-hairline)" />
                <YAxis tick={{ fill: 'var(--color-ink-3)', fontSize: 10 }} stroke="var(--color-hairline)" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => {
                    const v = value as number | null;
                    return [v !== null && v !== undefined ? `${v} ${trend.unit}` : '无数据', '平均值'];
                  }}
                />
                <Legend />
                {rangeValues.min !== null ? (
                  <ReferenceLine y={rangeValues.min} stroke="#27a644" strokeDasharray="3 3" strokeWidth={1} label={{ value: '下限', fill: '#27a644', fontSize: 10, position: 'right' }} />
                ) : null}
                {rangeValues.max !== null ? (
                  <ReferenceLine y={rangeValues.max} stroke="#e5484d" strokeDasharray="3 3" strokeWidth={1} label={{ value: '上限', fill: '#e5484d', fontSize: 10, position: 'right' }} />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="平均值"
                  stroke="#5e6ad2"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#5e6ad2' }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="vital-trend-stats">
            <div className="vital-trend-stat">
              <span className="muted">最新值</span>
              <strong>
                {trend.items.filter((i) => i.avgValue !== null).length > 0
                  ? `${trend.items.filter((i) => i.avgValue !== null)[trend.items.filter((i) => i.avgValue !== null).length - 1].avgValue} ${trend.unit}`
                  : '-'}
              </strong>
            </div>
            <div className="vital-trend-stat">
              <span className="muted">最高值</span>
              <strong style={{ color: '#e5484d' }}>
                {Math.max(...trend.items.map((i) => i.maxValue ?? -Infinity)).toFixed(1)} {trend.unit}
              </strong>
            </div>
            <div className="vital-trend-stat">
              <span className="muted">最低值</span>
              <strong style={{ color: '#27a644' }}>
                {Math.min(...trend.items.filter((i) => i.minValue !== null).map((i) => i.minValue!)).toFixed(1)} {trend.unit}
              </strong>
            </div>
            <div className="vital-trend-stat">
              <span className="muted">平均值</span>
              <strong>
                {(
                  trend.items.filter((i) => i.avgValue !== null).reduce((sum, i) => sum + (i.avgValue ?? 0), 0) /
                  Math.max(1, trend.items.filter((i) => i.avgValue !== null).length)
                ).toFixed(1)} {trend.unit}
              </strong>
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}
