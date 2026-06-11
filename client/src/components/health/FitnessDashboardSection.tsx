import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Btn, Field } from '../ui';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { CHART_CATEGORY_8, CHART_PNL } from '../../lib/chartPalette';
import {
  MACRO_COLORS,
  buildCalorieTrend,
  buildFitnessOverviewSummary,
  buildFoodCostTrend,
  buildMacroSummary,
  buildWeightTrend,
  filterRecordsByUserId,
} from '../../services/fitness';
import type {
  DietRecord,
  ExerciseRecord,
  FitnessShoppingRecord,
  WeightRecord,
} from '../../types/fitness';

interface FitnessDashboardSectionProps {
  userId: string;
  defaultHeightCm: number;
  dietRecords: DietRecord[];
  exerciseRecords: ExerciseRecord[];
  shoppingRecords: FitnessShoppingRecord[];
  weightRecords: WeightRecord[];
  onUserIdChange: (value: string) => void;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="chart-card">
      <div className="fitness-chart-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  );
}

export function FitnessDashboardSection({
  userId,
  defaultHeightCm,
  dietRecords,
  exerciseRecords,
  shoppingRecords,
  weightRecords,
  onUserIdChange,
}: FitnessDashboardSectionProps) {
  const filteredDietRecords = useMemo(() => filterRecordsByUserId(dietRecords, userId), [dietRecords, userId]);
  const filteredExerciseRecords = useMemo(() => filterRecordsByUserId(exerciseRecords, userId), [exerciseRecords, userId]);
  const filteredShoppingRecords = useMemo(() => filterRecordsByUserId(shoppingRecords, userId), [shoppingRecords, userId]);
  const filteredWeightRecords = useMemo(() => filterRecordsByUserId(weightRecords, userId), [userId, weightRecords]);

  const macroData = useMemo(() => buildMacroSummary(filteredDietRecords), [filteredDietRecords]);
  const weightTrendData = useMemo(() => buildWeightTrend(filteredWeightRecords), [filteredWeightRecords]);
  const calorieTrendData = useMemo(
    () => buildCalorieTrend(filteredDietRecords, filteredExerciseRecords),
    [filteredDietRecords, filteredExerciseRecords],
  );
  const costTrendData = useMemo(
    () => buildFoodCostTrend(filteredDietRecords, filteredShoppingRecords),
    [filteredDietRecords, filteredShoppingRecords],
  );
  const overview = useMemo(
    () => buildFitnessOverviewSummary(
      filteredDietRecords,
      filteredExerciseRecords,
      filteredShoppingRecords,
      filteredWeightRecords,
      defaultHeightCm,
    ),
    [
      defaultHeightCm,
      filteredDietRecords,
      filteredExerciseRecords,
      filteredShoppingRecords,
      filteredWeightRecords,
    ],
  );

  const hasWeightTrend = weightTrendData.some((point) => point.weight !== null);
  const hasCalorieTrend = calorieTrendData.some((point) => point.intake > 0 || point.burn > 0);
  const hasCostTrend = costTrendData.some((point) => point.cost > 0);

  return (
    <SectionCard
      title="数据看板"
      description="查看当前用户近 30 天的热量、体重体脂、营养结构与饮食成本趋势。"
    >
      <div className="page-stack">
        <StatGrid
          items={[
            {
              label: '近 30 天记录天数',
              value: `${overview.trackedDays}`,
              helper: '当前为全部用户汇总',
            },
            {
              label: '今日净热量',
              value: `${overview.todayNetCalories.toFixed(0)} kcal`,
              helper: `摄入 ${overview.todayCaloriesIn.toFixed(0)} / 消耗 ${overview.todayCaloriesOut.toFixed(0)}`,
            },
            {
              label: '最新体重',
              value: overview.latestWeightKg === null ? '-' : `${overview.latestWeightKg.toFixed(2)} kg`,
              helper: overview.bmi === null ? '暂无 BMI' : `BMI ${overview.bmi.toFixed(1)}`,
            },
            {
              label: '本月食材采购',
              value: `¥${overview.monthShoppingAmount.toFixed(2)}`,
              helper: `今日饮食成本约 ¥${overview.todayDietCost.toFixed(2)}`,
            },
          ]}
        />

        <div className="fitness-dashboard-grid">
          <ChartCard title="三大营养素占比" description="按今日饮食记录聚合三大营养素。">
            {macroData.length ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={macroData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={92}
                      label={({ name, percent }) => `${name} ${(Number(percent ?? 0) * 100).toFixed(1)}%`}
                      labelLine={false}
                    >
                      {macroData.map((entry, index) => (
                        <Cell key={entry.name} fill={MACRO_COLORS[index] ?? entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(1)} g`, '摄入量']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="fitness-legend-list">
                  {macroData.map((item, index) => (
                    <div key={item.name} className="fitness-legend-item">
                      <span className="fitness-legend-dot" style={{ background: MACRO_COLORS[index] ?? item.color }} />
                      <span>{item.name}：{item.value.toFixed(1)} g / {item.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                title="暂无营养占比"
                description="先补充今日饮食记录，才能看到蛋白质、碳水和脂肪结构。"
                icon="🥗"
              />
            )}
          </ChartCard>

          <ChartCard title="体重 / 体脂趋势" description="近 30 天按天聚合的平均体重和体脂率。">
            {hasWeightTrend ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={weightTrendData}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <YAxis yAxisId="left" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [
                        name === '体重' ? `${Number(value ?? 0).toFixed(2)} kg` : `${Number(value ?? 0).toFixed(1)} %`,
                        String(name ?? ''),
                      ]}
                    />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="weight" stroke={CHART_CATEGORY_8[3]} strokeWidth={2.5} dot={false} name="体重" />
                    <Line yAxisId="right" type="monotone" dataKey="bodyFat" stroke={CHART_CATEGORY_8[1]} strokeWidth={2.5} dot={false} name="体脂" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="暂无体重趋势"
                description="先补充几条体重和体脂记录，趋势图才会展示变化。"
                icon="⚖️"
              />
            )}
          </ChartCard>

          <ChartCard title="热量摄入 / 消耗对比" description="近 30 天每日总摄入与训练消耗的对比。">
            {hasCalorieTrend ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={calorieTrendData}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [
                        `${Number(value ?? 0).toFixed(0)} kcal`,
                        String(name ?? ''),
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="intake" name="摄入" fill="#f0b90b" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="burn" name="消耗" fill="#0ecb81" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="暂无热量趋势"
                description="先补充饮食和运动记录，才能看到每日热量对比。"
                icon="🔥"
              />
            )}
          </ChartCard>

          <ChartCard title="饮食成本趋势" description="根据食材采购价格推算近 30 天每日饮食成本。">
            {hasCostTrend ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={costTrendData}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 'var(--fs-meta)' }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [`¥${Number(value ?? 0).toFixed(2)}`, '成本']}
                    />
                    <Bar dataKey="cost" fill={CHART_CATEGORY_8[0]} radius={[6, 6, 0, 0]} name="成本">
                      {costTrendData.map((point) => (
                        <Cell
                          key={point.date}
                          fill={point.cost > 40 ? CHART_PNL.down : CHART_CATEGORY_8[0]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="暂无成本趋势"
                description="先补充饮食记录和匹配的食材采购记录，才能推算每日饮食成本。"
                icon="💰"
              />
            )}
          </ChartCard>
        </div>
      </div>
    </SectionCard>
  );
}
