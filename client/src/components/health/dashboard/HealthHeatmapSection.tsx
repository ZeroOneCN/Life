import { useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { EmptyState, SectionCard } from '../../page';
import { Btn } from '../../ui';
import { CHART_PNL } from '../../../lib/chartPalette';
import type { HealthStepHeatmapItem } from '../../../types/healthDashboard';

interface HealthHeatmapSectionProps {
  items: HealthStepHeatmapItem[];
  year: number;
  loading: boolean;
  onYearChange: (year: number) => void;
}

const CELL_SIZE = 14;
const CELL_GAP = 3;
const WEEK_ROWS = 7;
const MONTH_LABEL_HEIGHT = 16;
const WEEKDAY_LABEL_WIDTH = 22;

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const WEEKDAY_LABELS = ['一', '三', '五'];

/**
 * 根据步数返回热力图颜色。
 * @param steps - 步数
 * @returns 颜色 hex 值
 */
function getStepColor(steps: number) {
  if (steps <= 0) return 'var(--color-surface-2)';
  if (steps < 3000) return '#c7d2fe';
  if (steps < 6000) return '#818cf8';
  if (steps < 10000) return '#5e6ad2';
  if (steps < 15000) return '#4338ca';
  return '#312e81';
}

interface HeatmapCell {
  date: string;
  steps: number;
  distanceKm: number;
  column: number;
  row: number;
  monthLabel: string | null;
}

/**
 * 构建热力图所需的格子列表。
 * @param year - 年份
 * @param items - 后端返回的步数数据
 * @returns 格子数组
 */
function buildHeatmapCells(year: number, items: HealthStepHeatmapItem[]) {
  const stepMap = new Map<string, HealthStepHeatmapItem>();
  items.forEach((item) => stepMap.set(item.date, item));

  const start = dayjs(`${year}-01-01`).startOf('day');
  const end = dayjs(`${year}-12-31`).endOf('day');
  const totalDays = end.diff(start, 'day') + 1;

  const cells: HeatmapCell[] = [];
  // 让周一作为第一行（与 GitHub 风格一致）：调整 weekday 索引（0=周一, 6=周日）
  for (let i = 0; i < totalDays; i += 1) {
    const current = start.add(i, 'day');
    const isoWeekday = current.day() === 0 ? 6 : current.day() - 1;
    const column = Math.floor((i + isoWeekday) / WEEK_ROWS);
    const dateStr = current.format('YYYY-MM-DD');
    const record = stepMap.get(dateStr);

    let monthLabel: string | null = null;
    if (isoWeekday === 0 && current.date() <= 7) {
      monthLabel = MONTH_LABELS[current.month()];
    }

    cells.push({
      date: dateStr,
      steps: record?.steps ?? 0,
      distanceKm: record?.distanceKm ?? 0,
      column,
      row: isoWeekday,
      monthLabel,
    });
  }

  return cells;
}

/**
 * 计算年度步数统计摘要。
 * @param items - 步数数据
 * @returns 统计摘要
 */
function buildYearSummary(items: HealthStepHeatmapItem[]) {
  const totalSteps = items.reduce((sum, item) => sum + item.steps, 0);
  const totalDistance = items.reduce((sum, item) => sum + item.distanceKm, 0);
  const activeDays = items.filter((item) => item.steps > 0).length;
  const goalHitDays = items.filter((item) => item.steps >= 10000).length;
  return {
    totalSteps,
    totalDistanceKm: Number(totalDistance.toFixed(2)),
    activeDays,
    goalHitDays,
    avgSteps: activeDays > 0 ? Math.round(totalSteps / activeDays) : 0,
  };
}

/**
 * 步数热力图 Section：以日历视图展示全年每日步数强度。
 * @param items - 后端返回的步数热力图数据
 * @param year - 当前选中年份
 * @param loading - 是否加载中
 * @param onYearChange - 年份变更回调
 */
export function HealthHeatmapSection({ items, year, loading, onYearChange }: HealthHeatmapSectionProps) {
  const [hovered, setHovered] = useState<HeatmapCell | null>(null);

  const cells = useMemo(() => buildHeatmapCells(year, items), [year, items]);
  const summary = useMemo(() => buildYearSummary(items), [items]);

  if (loading) {
    return <SectionCard title="步数热力图" description="正在加载全年步数强度…"><div className="skeleton-block" /></SectionCard>;
  }

  const maxColumn = cells.reduce((max, cell) => Math.max(max, cell.column), 0);
  const totalWidth = WEEKDAY_LABEL_WIDTH + (maxColumn + 1) * (CELL_SIZE + CELL_GAP) + 16;
  const totalHeight = MONTH_LABEL_HEIGHT + WEEK_ROWS * (CELL_SIZE + CELL_GAP) + 24;
  const currentYear = dayjs().year();
  const canPrev = year > currentYear - 5;
  const canNext = year < currentYear;

  return (
    <SectionCard
      title="步数热力图"
      description={`全年步数强度一览（${year} 年）`}
      action={(
        <div className="health-heatmap-year-nav">
          <Btn type="button" tone="secondary" onClick={() => onYearChange(year - 1)} disabled={!canPrev}>上一年</Btn>
          <span className="health-heatmap-year-label">{year}</span>
          <Btn type="button" tone="secondary" onClick={() => onYearChange(year + 1)} disabled={!canNext}>下一年</Btn>
        </div>
      )}
    >
      {cells.length === 0 ? (
        <EmptyState title="暂无步数记录" description={`${year} 年还没有任何步数记录，去录入后会在此展示。`} />
      ) : (
        <>
          <div className="health-heatmap-summary">
            <span>累计 <strong>{summary.totalSteps.toLocaleString()}</strong> 步</span>
            <span>距离 <strong>{summary.totalDistanceKm}</strong> 公里</span>
            <span>记录天数 <strong>{summary.activeDays}</strong></span>
            <span>日均 <strong>{summary.avgSteps.toLocaleString()}</strong> 步</span>
            <span>达标 ≥1 万步 <strong>{summary.goalHitDays}</strong> 天</span>
          </div>
          <div className="health-heatmap-wrapper" style={{ overflowX: 'auto' }}>
            <svg width={totalWidth} height={totalHeight} className="health-heatmap-svg" role="img" aria-label={`${year} 年步数热力图`}>
              {MONTH_LABELS.map((label, index) => {
                const cell = cells.find((c) => c.monthLabel === label);
                if (!cell) return null;
                const x = WEEKDAY_LABEL_WIDTH + cell.column * (CELL_SIZE + CELL_GAP);
                return (
                  <text
                    key={label}
                    x={x}
                    y={MONTH_LABEL_HEIGHT - 4}
                    fontSize={10}
                    fill="var(--color-ink-3)"
                  >
                    {label}
                  </text>
                );
              })}
              {WEEKDAY_LABELS.map((label, index) => (
                <text
                  key={label}
                  x={0}
                  y={MONTH_LABEL_HEIGHT + (index * 2 + 1) * (CELL_SIZE + CELL_GAP) - 3}
                  fontSize={10}
                  fill="var(--color-ink-3)"
                >
                  {label}
                </text>
              ))}
              {cells.map((cell) => {
                const x = WEEKDAY_LABEL_WIDTH + cell.column * (CELL_SIZE + CELL_GAP);
                const y = MONTH_LABEL_HEIGHT + cell.row * (CELL_SIZE + CELL_GAP);
                const color = getStepColor(cell.steps);
                return (
                  <rect
                    key={cell.date}
                    x={x}
                    y={y}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx={3}
                    fill={color}
                    stroke={hovered?.date === cell.date ? CHART_PNL.up : 'transparent'}
                    strokeWidth={hovered?.date === cell.date ? 1.5 : 0}
                    className="health-heatmap-cell"
                    onMouseEnter={() => setHovered(cell)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <title>{`${cell.date} · ${cell.steps.toLocaleString()} 步 · ${cell.distanceKm} 公里`}</title>
                  </rect>
                );
              })}
            </svg>
            <div className="health-heatmap-legend">
              <span>少</span>
              <svg width={CELL_SIZE * 5 + CELL_GAP * 4} height={CELL_SIZE}>
                {[
                  'var(--color-surface-2)',
                  '#c7d2fe',
                  '#818cf8',
                  '#5e6ad2',
                  '#312e81',
                ].map((color, index) => (
                  <rect
                    key={index}
                    x={index * (CELL_SIZE + CELL_GAP)}
                    y={0}
                    width={CELL_SIZE}
                    height={CELL_SIZE}
                    rx={3}
                    fill={color}
                  />
                ))}
              </svg>
              <span>多</span>
              {hovered ? (
                <span className="health-heatmap-tooltip">
                  {hovered.date} · {hovered.steps.toLocaleString()} 步 · {hovered.distanceKm} 公里
                </span>
              ) : null}
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}
