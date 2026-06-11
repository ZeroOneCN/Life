import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { MonthPickerField } from '../date';
import { STEP_HOURS } from '../../services/stepRecords';
import { stepApi } from '../../services/stepApi';
import type { StepAggregatePoint, StepConcreteHour, StepStatsGranularity } from '../../types/health';
import { usePageTab } from '../../hooks/usePageTab';
import { Btn, Field, Pagination, Tag, CardSkeleton } from '../../components/ui';
import { EmptyState, SectionCard } from '../page';

type ChartHourFilter = 'all' | StepConcreteHour;

interface StepTrendSectionProps {
  reloadKey?: number;
  userId: string;
  strideLength: number;
  onUserIdChange: (value: string) => void;
  onStrideLengthChange: (value: number) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const granularityOptions: StepStatsGranularity[] = ['daily', 'monthly'];
const STEP_AGGREGATE_PAGE_SIZE = 10;

function formatCompareLabel(changePercentage: number | null, trend: 'up' | 'down' | 'flat' | 'none') {
  if (changePercentage === null) {
    return '上月暂无可比数据';
  }

  if (trend === 'up') {
    return `较上月 +${changePercentage}%`;
  }

  if (trend === 'down') {
    return `较上月 ${changePercentage}%`;
  }

  return '较上月持平';
}

function getCompareTone(trend: 'up' | 'down' | 'flat' | 'none') {
  if (trend === 'up') {
    return 'green';
  }

  if (trend === 'down') {
    return 'red';
  }

  if (trend === 'flat') {
    return 'blue';
  }

  return 'default';
}

export function StepTrendSection({
  reloadKey,
  userId,
  strideLength,
  onUserIdChange,
  onStrideLengthChange,
  showToast,
}: StepTrendSectionProps) {
  const [granularity, setGranularity] = usePageTab<StepStatsGranularity>('daily', granularityOptions, 'stats');
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedYear, setSelectedYear] = useState(String(dayjs().year()));
  const [chartHourFilter, setChartHourFilter] = useState<ChartHourFilter>('all');
  const [aggregatePage, setAggregatePage] = useState(1);
  const [strideDraft, setStrideDraft] = useState(String(strideLength));

  // 后端数据状态
  const [trendData, setTrendData] = useState<StepAggregatePoint[]>([]);
  const [compareSummary, setCompareSummary] = useState<{
    currentLabel: string;
    previousLabel: string;
    currentSteps: number;
    previousSteps: number;
    currentDistanceKm: number;
    previousDistanceKm: number;
    changePercentage: number | null;
    trend: 'up' | 'down' | 'flat' | 'none';
  } | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    setStrideDraft(String(strideLength));
  }, [strideLength]);

  useEffect(() => {
    setAggregatePage(1);
  }, [chartHourFilter, granularity, selectedMonth, selectedYear, userId]);

  /**
   * 从后端加载趋势数据，替代前端全量 records 计算。
   * daily 模式使用 /trend API，monthly 模式使用 /month-compare API。
   */
  const loadTrendData = useCallback(async () => {
    setTrendLoading(true);
    try {
      if (granularity === 'daily') {
        const data = await stepApi.getTrend({
          userId: userId || undefined,
          month: selectedMonth,
          hour: chartHourFilter === 'all' ? undefined : chartHourFilter,
        });
        setTrendData(data);
        setCompareSummary(null);
      } else {
        const isCurrentYear = Number(selectedYear) === dayjs().year();
        const compareMonth = isCurrentYear
          ? `${selectedYear}-${String(dayjs().month() + 1).padStart(2, '0')}`
          : `${selectedYear}-12`;
        const compare = await stepApi.getMonthCompare({
          userId: userId || undefined,
          month: compareMonth,
        });
        setCompareSummary(compare);
        const monthlyPoints: StepAggregatePoint[] = [];
        for (let m = 1; m <= 12; m++) {
          const monthKey = `${selectedYear}-${String(m).padStart(2, '0')}`;
          try {
            const monthData = await stepApi.getTrend({
              userId: userId || undefined,
              month: monthKey,
            });
            const totalSteps = monthData.reduce((sum, d) => sum + d.totalSteps, 0);
            const recordCount = monthData.reduce((sum, d) => sum + d.recordCount, 0);
            if (totalSteps > 0) {
              monthlyPoints.push({
                bucket: monthKey,
                label: `${m}月`,
                totalSteps,
                recordCount,
                distanceKm: Number(((totalSteps * strideLength) / 1000).toFixed(2)),
              });
            }
          } catch {
          }
        }
        setTrendData(monthlyPoints);
      }
    } catch {
      setTrendData([]);
      setCompareSummary(null);
    } finally {
      setTrendLoading(false);
    }
  }, [granularity, selectedMonth, selectedYear, chartHourFilter, strideLength, reloadKey]);

  useEffect(() => {
    void loadTrendData();
  }, [loadTrendData]);

  const pagedAggregateData = useMemo(() => {
    const latestFirst = [...trendData].sort((left, right) => right.bucket.localeCompare(left.bucket));
    const startIndex = (aggregatePage - 1) * STEP_AGGREGATE_PAGE_SIZE;

    return latestFirst.slice(startIndex, startIndex + STEP_AGGREGATE_PAGE_SIZE);
  }, [trendData, aggregatePage]);

  const totalPages = Math.max(1, Math.ceil(trendData.length / STEP_AGGREGATE_PAGE_SIZE));

  return (
    <SectionCard
      title="统计趋势"
      description="按用户查看每日或每月趋势，支持步幅换算和时间段筛选。"
      action={<Tag tone="blue">{granularity === 'daily' ? '每日趋势' : '每月趋势'}</Tag>}
    >
      <div className="page-stack">
        <div className="tab-bar">
          <button
            type="button"
            className={`tab ${granularity === 'daily' ? 'active' : ''}`}
            onClick={() => setGranularity('daily')}
          >
            每天
          </button>
          <button
            type="button"
            className={`tab ${granularity === 'monthly' ? 'active' : ''}`}
            onClick={() => setGranularity('monthly')}
          >
            每月
          </button>
        </div>

        <div className="step-filter-grid">

          <label className="field">
            <span className="field-label">步幅（米）</span>
            <div className="step-inline-input">
              <input
                type="number"
                min="0.1"
                max="2"
                step="0.01"
                value={strideDraft}
                onChange={(event) => setStrideDraft(event.target.value)}
              />
              <Btn
                tone="secondary"
                onClick={() => {
                  const nextValue = Number(strideDraft);

                  if (!Number.isFinite(nextValue) || nextValue <= 0) {
                    showToast('请输入有效的步幅数值。', 'error');
                    return;
                  }

                  onStrideLengthChange(nextValue);
                  showToast('步幅设置已更新。');
                }}
              >
                保存
              </Btn>
            </div>
          </label>

          {granularity === 'daily' ? (
            <MonthPickerField
              label="月份"
              value={selectedMonth}
              onChange={(nextValue) => {
                if (!nextValue) {
                  return;
                }

                setSelectedMonth(nextValue);
              }}
              clearable={false}
              hint="按月份查看每日趋势。"
            />
          ) : (
            <Field
              label="年份"
              type="number"
              min="2020"
              max="2099"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            />
          )}
        </div>

        <div className="step-chart-shell">
          <div className="step-chart-toolbar">
            <span className="step-quick-actions-label">时间段筛选</span>
            <div className="step-hour-buttons is-compact">
              <button
                type="button"
                className={`step-hour-button ${chartHourFilter === 'all' ? 'is-active' : ''}`}
                onClick={() => setChartHourFilter('all')}
              >
                全部
              </button>
              {STEP_HOURS.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  className={`step-hour-button ${chartHourFilter === hour ? 'is-active' : ''}`}
                  onClick={() => setChartHourFilter(hour)}
                >
                  {hour}
                </button>
              ))}
            </div>
          </div>

          {trendLoading && trendData.length === 0 ? (
            <CardSkeleton height={320} />
          ) : trendData.length ? (
            <div className="step-chart-canvas" key={`${granularity}-${chartHourFilter}`} style={{ position: 'relative' }}>
              {trendLoading && (
                <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 'var(--fs-meta)', color: 'var(--color-ink-subtle)', zIndex: 1 }}>
                  加载中…
                </div>
              )}
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="stepArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-overline)' }}
                    interval="preserveStartEnd"
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface-1)',
                      border: '1px solid var(--color-hairline)',
                      borderRadius: 14,
                      boxShadow: 'var(--shadow-soft)',
                    }}
                    formatter={(value) => [`${Number(value ?? 0).toLocaleString()} 步`, '步数']}
                  />
                  <Area
                    type="monotone"
                    dataKey="totalSteps"
                    stroke="var(--color-primary)"
                    fill="url(#stepArea)"
                    strokeWidth={3}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="暂无统计数据"
              description="调整筛选条件，或先录入几条步数记录。"
            />
          )}
        </div>

        {granularity === 'monthly' && compareSummary ? (
          <div className="step-compare-grid">
            <div className="step-compare-card is-primary">
              <span className="step-compare-label">本月</span>
              <strong>{compareSummary.currentSteps.toLocaleString()}</strong>
              <span>{compareSummary.currentLabel} / {compareSummary.currentDistanceKm} 公里</span>
            </div>
            <div className="step-compare-card is-secondary">
              <span className="step-compare-label">上月</span>
              <strong>{compareSummary.previousSteps.toLocaleString()}</strong>
              <span>{compareSummary.previousLabel} / {compareSummary.previousDistanceKm} 公里</span>
            </div>
            <div className="step-compare-card is-highlight">
              <span className="step-compare-label">变化</span>
              <strong>
                {compareSummary.changePercentage === null
                  ? '-'
                  : `${compareSummary.changePercentage > 0 ? '+' : ''}${compareSummary.changePercentage}%`}
              </strong>
              <Tag tone={getCompareTone(compareSummary.trend)}>
                {formatCompareLabel(compareSummary.changePercentage, compareSummary.trend)}
              </Tag>
            </div>
          </div>
        ) : null}

        {pagedAggregateData.length ? (
          <>
            <div className="step-aggregate-grid">
              {pagedAggregateData.map((item) => (
                <article key={item.bucket} className="step-aggregate-card">
                  <strong>{item.totalSteps.toLocaleString()}</strong>
                  <span>{item.label}</span>
                  <div className="step-aggregate-meta">
                    <span>{item.recordCount} 条记录</span>
                    <span>{item.distanceKm} 公里</span>
                  </div>
                </article>
              ))}
            </div>
            <Pagination page={aggregatePage} totalPages={totalPages} onPageChange={setAggregatePage} />
          </>
        ) : null}
      </div>
    </SectionCard>
  );
}
