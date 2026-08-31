import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Grid } from '@arco-design/web-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, SectionCard } from '../../page';
import { PillTabs } from '../../ui';
import { healthDashboardApi } from '../../../services/healthDashboardApi';
import { buildApiErrorMessage } from '../../../lib/api';
import type {
  HealthComparisonMetric,
  HealthComparisonPeriod,
  HealthComparisonResult,
} from '../../../types/healthDashboard';

const Row = Grid.Row;
const Col = Grid.Col;

interface HealthComparisonSectionProps {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

const METRIC_OPTIONS = [
  { value: 'step', label: '步数' },
  { value: 'weight', label: '体重' },
  { value: 'exercise', label: '运动消耗' },
  { value: 'medication', label: '用药天数' },
] as const;

const PERIOD_OPTIONS = [
  { value: 'month', label: '月度对比' },
  { value: 'year', label: '年度对比' },
] as const;

const METRIC_LABELS: Record<HealthComparisonMetric, string> = {
  step: '步数',
  weight: '最新体重 (kg)',
  exercise: '运动消耗 (kcal)',
  medication: '用药天数',
};

const METRIC_UNITS: Record<HealthComparisonMetric, string> = {
  step: '步',
  weight: 'kg',
  exercise: 'kcal',
  medication: '天',
};

/**
 * 根据趋势返回展示颜色。
 * @param trend - 趋势标识
 * @returns 颜色 hex
 */
function getTrendColor(trend: 'up' | 'down' | 'flat' | 'none') {
  if (trend === 'up') return '#27a644';
  if (trend === 'down') return '#e5484d';
  if (trend === 'flat') return '#5e6ad2';
  return '#6b7280';
}

/**
 * 格式化展示值：体重保留 2 位小数，其他指标取整。
 * @param value - 数值
 * @param metric - 指标类型
 * @returns 格式化后的字符串
 */
function formatValue(value: number, metric: HealthComparisonMetric) {
  if (metric === 'weight') {
    return value.toFixed(2);
  }
  return Math.round(value).toLocaleString();
}

/**
 * 格式化同比变化：保留 2 位小数并带正负号。
 * @param changePercentage - 变化百分比
 * @returns 格式化后的字符串
 */
function formatChange(changePercentage: number | null) {
  if (changePercentage === null) return '上一周期无数据可比';
  const sign = changePercentage > 0 ? '+' : '';
  return `${sign}${changePercentage.toFixed(2)}%`;
}

/**
 * 数据对比 Section：根据指标与周期，展示当前 vs 上一周期的对比柱状图。
 * 切换指标/周期时保留旧数据显示，新数据加载完成后无缝替换，避免页面抖动。
 * @param showToast - 弹出提示函数
 */
export function HealthComparisonSection({ showToast }: HealthComparisonSectionProps) {
  const [metric, setMetric] = useState<HealthComparisonMetric>('step');
  const [period, setPeriod] = useState<HealthComparisonPeriod>('month');
  const [date, setDate] = useState(dayjs().format('YYYY-MM'));
  const [data, setData] = useState<HealthComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);

  const loadComparison = useCallback(async () => {
    setLoading(true);
    try {
      const result = await healthDashboardApi.getComparison(metric, period, date);
      setData(result);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '对比数据加载失败。'), 'error');
    } finally {
      setLoading(false);
    }
  }, [metric, period, date, showToast]);

  useEffect(() => {
    void loadComparison();
  }, [loadComparison]);

  /**
   * 切换周期时重置 date 字符串。
   */
  const handlePeriodChange = (next: string) => {
    setPeriod(next as HealthComparisonPeriod);
    setDate(next === 'year' ? dayjs().format('YYYY') : dayjs().format('YYYY-MM'));
  };

  const handleMetricChange = (next: string) => {
    setMetric(next as HealthComparisonMetric);
  };

  const chartData = data
    ? [
        {
          name: data.previous.label,
          value: Number(data.previous.value.toFixed(2)),
          tone: 'previous',
        },
        { name: data.current.label, value: Number(data.current.value.toFixed(2)), tone: 'current' },
      ]
    : [];

  const changeText = formatChange(data?.changePercentage ?? null);

  return (
    <SectionCard
      title="数据对比"
      description="同比 / 环比对比当前周期与上一周期"
      action={
        <div className="health-comparison-controls">
          <PillTabs
            options={METRIC_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={metric}
            onChange={handleMetricChange}
          />
          <PillTabs
            options={PERIOD_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={period}
            onChange={handlePeriodChange}
          />
        </div>
      }
    >
      {!data ? (
        <EmptyState title="暂无对比数据" description="请稍后重试。" />
      ) : (
        <>
          <Row gutter={[12, 12]}>
            <Col span={8}>
              <div className="health-comparison-card">
                <span>{data.previous.label}</span>
                <strong>
                  {formatValue(data.previous.value, metric)} {METRIC_UNITS[metric]}
                </strong>
                <span className="muted">{data.previous.recordCount} 条记录</span>
              </div>
            </Col>
            <Col span={8}>
              <div className="health-comparison-card">
                <span>{data.current.label}</span>
                <strong>
                  {formatValue(data.current.value, metric)} {METRIC_UNITS[metric]}
                </strong>
                <span className="muted">{data.current.recordCount} 条记录</span>
              </div>
            </Col>
            <Col span={8}>
              <div className="health-comparison-card">
                <span>同比变化</span>
                <strong style={{ color: getTrendColor(data.trend) }}>{changeText}</strong>
                <span className="muted">{METRIC_LABELS[metric]}</span>
              </div>
            </Col>
          </Row>
          <div
            style={{
              width: '100%',
              height: 280,
              marginTop: 16,
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
              pointerEvents: loading ? 'none' : 'auto',
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
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
                  formatter={(value) => [`${value} ${METRIC_UNITS[metric]}`, METRIC_LABELS[metric]]}
                />
                <Legend />
                <Bar dataKey="value" name={METRIC_LABELS[metric]} radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.tone === 'current' ? '#5e6ad2' : '#c7d2fe'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </SectionCard>
  );
}
