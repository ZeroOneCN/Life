import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
} from 'recharts';

import { EmptyState, SectionCard } from '../../page';
import { PillTabs } from '../../ui';
import type { SleepTrend } from '../../../types/sleep';

interface SleepTrendSectionProps {
  trend: SleepTrend | null;
  loading: boolean;
  period: 'week' | 'month' | 'year';
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

const RECOMMENDED_MIN = 420;
const RECOMMENDED_MAX = 540;

/**
 * 格式化分钟为 "Xh Ym"。
 * @param minutes - 分钟数
 * @returns 格式化字符串
 */
function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分钟`;
  if (m === 0) return `${h} 小时`;
  return `${h} 小时 ${m} 分`;
}

/**
 * 睡眠趋势 Section：以折线图展示睡眠时长趋势。
 * 包含参考范围线（7-9 小时）、平均时长、平均质量。
 * @param trend - 趋势数据
 * @param loading - 是否加载中
 * @param period - 当前周期
 * @param onPeriodChange - 切换周期回调
 */
export function SleepTrendSection({ trend, loading, period, onPeriodChange }: SleepTrendSectionProps) {
  const chartData = useMemo(() => {
    if (!trend) return [];
    return trend.items.map((item) => ({
      ...item,
      duration: item.durationMinutes,
      durationLabel: item.durationMinutes !== null ? formatDuration(item.durationMinutes) : '无数据',
    }));
  }, [trend]);

  const validItems = trend?.items.filter((i) => i.durationMinutes !== null) ?? [];
  const maxDuration = validItems.length > 0
    ? Math.max(...validItems.map((i) => i.durationMinutes ?? 0))
    : 0;
  const minDuration = validItems.length > 0
    ? Math.min(...validItems.map((i) => i.durationMinutes ?? 0))
    : 0;

  return (
    <SectionCard
      title="睡眠趋势"
      description={trend ? `${trend.period === 'week' ? '近 7 天' : trend.period === 'month' ? '近 30 天' : '近一年'}睡眠时长变化` : '查看睡眠趋势分析'}
      action={(
        <div className="vital-trend-controls">
          <PillTabs
            options={PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={period}
            onChange={(v) => onPeriodChange(v as 'week' | 'month' | 'year')}
          />
        </div>
      )}
    >
      {!trend ? (
        loading ? (
          <div className="skeleton-block" />
        ) : (
          <EmptyState title="暂无趋势数据" description="请先录入睡眠记录后查看趋势分析。" />
        )
      ) : (
        <div
          style={{
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 0.15s ease',
            pointerEvents: loading ? 'none' : 'auto',
          }}
        >
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-2)', fontSize: 11 }} stroke="var(--color-hairline)" />
                <YAxis
                  tick={{ fill: 'var(--color-ink-3)', fontSize: 10 }}
                  stroke="var(--color-hairline)"
                  tickFormatter={(v) => `${Math.round(v / 60)}h`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => {
                    const v = value as number | null;
                    return [v !== null && v !== undefined ? formatDuration(v) : '无数据', '睡眠时长'];
                  }}
                />
                <Legend />
                <ReferenceLine y={RECOMMENDED_MIN} stroke="#27a644" strokeDasharray="3 3" strokeWidth={1} label={{ value: '7h', fill: '#27a644', fontSize: 10, position: 'right' }} />
                <ReferenceLine y={RECOMMENDED_MAX} stroke="#27a644" strokeDasharray="3 3" strokeWidth={1} label={{ value: '9h', fill: '#27a644', fontSize: 10, position: 'right' }} />
                <Line
                  type="monotone"
                  dataKey="duration"
                  name="睡眠时长"
                  stroke="#9b8af0"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#9b8af0' }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="vital-trend-stats">
            <div className="vital-trend-stat">
              <span className="muted">平均时长</span>
              <strong>{trend.avgDurationLabel || '-'}</strong>
            </div>
            <div className="vital-trend-stat">
              <span className="muted">最长</span>
              <strong style={{ color: '#27a644' }}>
                {validItems.length > 0 ? formatDuration(maxDuration) : '-'}
              </strong>
            </div>
            <div className="vital-trend-stat">
              <span className="muted">最短</span>
              <strong style={{ color: '#e5484d' }}>
                {validItems.length > 0 ? formatDuration(minDuration) : '-'}
              </strong>
            </div>
            <div className="vital-trend-stat">
              <span className="muted">平均质量</span>
              <strong>
                {trend.avgQuality !== null ? `${trend.avgQuality} / 5` : '-'}
              </strong>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
