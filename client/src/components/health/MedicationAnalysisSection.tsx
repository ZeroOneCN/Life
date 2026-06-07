import { useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Field } from '../ui';
import {
  MEDICATION_TIME_COLORS,
  MEDICATION_TREND_RANGE_OPTIONS,
  buildMedicationOverview,
  buildMedicationRanking,
  buildMedicationTimeOfDaySummary,
  buildMedicationTrend,
  filterMedicationPurchasesByUserId,
  filterMedicationRecordsByUserId,
} from '../../services/medication';
import type { MedicationPurchaseRecord, MedicationRecord } from '../../types/medication';

interface MedicationAnalysisSectionProps {
  userId: string;
  records: MedicationRecord[];
  purchases: MedicationPurchaseRecord[];
  onUserIdChange: (value: string) => void;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

const TREND_SERIES = [
  { key: 'breakfast', label: '早餐', color: MEDICATION_TIME_COLORS.breakfast, width: 2 },
  { key: 'lunch', label: '午餐', color: MEDICATION_TIME_COLORS.lunch, width: 2 },
  { key: 'dinner', label: '晚餐', color: MEDICATION_TIME_COLORS.dinner, width: 2 },
  { key: 'total', label: '总用量', color: MEDICATION_TIME_COLORS.total, width: 2.8 },
] as const;

const TREND_ORDER: Record<(typeof TREND_SERIES)[number]['key'], number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  total: 3,
};

const DOSAGE_SHARE_COLORS = [...CHART_CATEGORY_8];

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
    <div className="fitness-chart-card">
      <div className="fitness-chart-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  );
}

export function MedicationAnalysisSection({
  userId,
  records,
  purchases,
  onUserIdChange,
}: MedicationAnalysisSectionProps) {
  const [trendDays, setTrendDays] = useState<(typeof MEDICATION_TREND_RANGE_OPTIONS)[number]>(30);

  const filteredRecords = useMemo(() => filterMedicationRecordsByUserId(records, userId), [records, userId]);
  const filteredPurchases = useMemo(() => filterMedicationPurchasesByUserId(purchases, userId), [purchases, userId]);
  const overview = useMemo(() => buildMedicationOverview(records, purchases, userId), [records, purchases, userId]);
  const trendData = useMemo(() => buildMedicationTrend(records, userId, trendDays), [records, trendDays, userId]);
  const rankingData = useMemo(() => buildMedicationRanking(records, userId), [records, userId]);
  const timeSummary = useMemo(() => buildMedicationTimeOfDaySummary(records, userId), [records, userId]);

  const dosageShareData = useMemo(() => rankingData.slice(0, 6).map((item) => ({
    name: item.medicineName,
    value: item.totalDose,
  })), [rankingData]);

  const rankingTableData = useMemo(() => rankingData.slice(0, 8), [rankingData]);
  const hasTrendData = trendData.some((point) => point.total > 0);
  const hasRankingData = rankingData.length > 0;
  const timeOfDayData = [
    { label: '早餐', value: timeSummary.breakfast, color: MEDICATION_TIME_COLORS.breakfast },
    { label: '午餐', value: timeSummary.lunch, color: MEDICATION_TIME_COLORS.lunch },
    { label: '晚餐', value: timeSummary.dinner, color: MEDICATION_TIME_COLORS.dinner },
  ];

  return (
    <SectionCard
      title="分析看板"
      description="从趋势、时段和药品维度汇总当前用户的用药轨迹，同时补充购药金额背景。"
    >
      <div className="page-stack">
        <div className="medication-filter-grid medication-filter-grid-analysis">
          <Field
            label="分析用户 ID"
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            placeholder="留空查看全部用户"
            hint="趋势图、药品排行和金额统计都会基于这里的用户维度刷新。"
          />
        </div>

        <StatGrid
          items={[
            { label: '总记录数', value: `${overview.totalRecords}`, helper: `覆盖 ${overview.trackedDays} 个记录日` },
            { label: '累计用量', value: `${overview.totalDosage}`, helper: `日均 ${overview.avgDailyDosage} 次` },
            {
              label: '活跃药品',
              value: `${overview.activeMedicineCount}`,
              helper: overview.latestRecordDate ? `最近记录：${overview.latestRecordDate}` : '暂无最近记录',
            },
            { label: '购药总额', value: `¥${overview.totalPurchaseAmount.toFixed(2)}`, helper: `共 ${overview.purchaseCount} 笔购药记录` },
            { label: '今日用量', value: `${overview.todayDosage}`, helper: filteredRecords.length ? '按今天日期汇总三餐用量' : '暂无今日记录' },
          ]}
        />

        <div className="fitness-row-actions medication-range-tabs">
          {MEDICATION_TREND_RANGE_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              className={`step-hour-button ${trendDays === item ? 'is-active' : ''}`}
              onClick={() => setTrendDays(item)}
            >
              近 {item} 天
            </button>
          ))}
        </div>

        <div className="medication-analysis-grid">
          <ChartCard title="用药趋势" description="按早餐、午餐、晚餐、总用量查看近阶段变化。">
            {hasTrendData ? (
              <div className="fitness-chart-shell">
                <div className="medication-chart-legend">
                  {TREND_SERIES.map((series) => (
                    <div key={series.key} className="medication-chart-legend-item">
                      <span
                        className="medication-chart-legend-dot"
                        style={{ background: series.color }}
                      />
                      <span>{series.label}</span>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      itemSorter={(item) => {
                        const key = String(item.dataKey ?? '') as keyof typeof TREND_ORDER;
                        return TREND_ORDER[key] ?? 99;
                      }}
                    />
                    {TREND_SERIES.map((series) => (
                      <Line
                        key={series.key}
                        type="monotone"
                        dataKey={series.key}
                        name={series.label}
                        stroke={series.color}
                        strokeWidth={series.width}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无趋势数据" description="先录入几天的每日用药记录，趋势图才会形成可读变化。" />
            )}
          </ChartCard>

          <ChartCard title="药品用量占比" description="按药品聚合的总用量结构。">
            {hasRankingData ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dosageShareData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={92}
                      label={({ name, percent }) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {dosageShareData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={DOSAGE_SHARE_COLORS[index % DOSAGE_SHARE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(1)}`, '累计用量']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无药品结构" description="等有足够的用药记录后，这里会展示各药品的用量占比。" />
            )}
          </ChartCard>

          <ChartCard title="时段用量对比" description="对比早餐、午餐、晚餐三个时段的累计用量。">
            {timeOfDayData.some((item) => item.value > 0) ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={timeOfDayData}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [`${Number(value ?? 0).toFixed(1)}`, '累计用量']}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {timeOfDayData.map((item) => (
                        <Cell key={item.label} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="暂无时段对比" description="当前用户还没有可用于早餐、午餐、晚餐对比的用药数据。" />
            )}
          </ChartCard>

          <ChartCard title="用药排行" description="按累计用量排序的重点药品列表。">
            {rankingTableData.length ? (
              <div className="medication-ranking-list">
                {rankingTableData.map((item, index) => (
                  <div className="list-row" key={item.medicineName}>
                    <div>
                      <strong>{index + 1}. {item.medicineName}</strong>
                      <div className="list-row-meta">累计用量 {item.totalDose}，占比 {item.percentage}%</div>
                    </div>
                    <span className="subtle-text">
                      购药记录 {filteredPurchases.filter((purchase) => purchase.medicineName === item.medicineName).length} 笔
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无排行数据" description="用药排行会在累计多条记录后自动形成。" />
            )}
          </ChartCard>
        </div>
      </div>
    </SectionCard>
  );
}
