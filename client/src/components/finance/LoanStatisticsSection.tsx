import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dayjs from 'dayjs';
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

import { DatePickerField, MonthPickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { SelectField, Tag } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import { LOAN_ALL_PLATFORMS, formatLoanAmount } from '../../services/loan';
import { loanApi } from '../../services/loanApi';
import type { LoanMonthlyStats, LoanPlatform, LoanPlatformBreakdownPoint, LoanTrendPoint } from '../../types/loan';

interface LoanStatisticsSectionProps {
  platforms: LoanPlatform[];
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

const breakdownColors = ['#0f766e', '#ea580c', '#2563eb', '#7c3aed', '#ca8a04', '#dc2626'];

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`fitness-chart-card ${className ?? ''}`.trim()}>
      <div className="fitness-chart-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  );
}

function createEmptyMonthlyStats(month: string): LoanMonthlyStats {
  return {
    month,
    totalBills: 0,
    totalAmount: 0,
    totalInterest: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    overdueAmount: 0,
  };
}

export function LoanStatisticsSection({
  platforms,
  showToast,
}: LoanStatisticsSectionProps) {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [platformId, setPlatformId] = useState(LOAN_ALL_PLATFORMS);
  const [rangeMode, setRangeMode] = useState<'last30' | 'custom'>('last30');
  const [startDate, setStartDate] = useState(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [monthlyStats, setMonthlyStats] = useState<LoanMonthlyStats>(() => createEmptyMonthlyStats(dayjs().format('YYYY-MM')));
  const [trendData, setTrendData] = useState<LoanTrendPoint[]>([]);
  const [platformBreakdown, setPlatformBreakdown] = useState<LoanPlatformBreakdownPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const resolvedRange = useMemo(() => {
    if (rangeMode === 'custom') {
      return {
        startDate: startDate || dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
        endDate: endDate || dayjs().format('YYYY-MM-DD'),
      };
    }

    return {
      startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
    };
  }, [endDate, rangeMode, startDate]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [nextMonthlyStats, nextTrendData, nextPlatformBreakdown] = await Promise.all([
          loanApi.getMonthlyStats({
            month,
            platformId: platformId === LOAN_ALL_PLATFORMS ? undefined : platformId,
          }),
          loanApi.getRepaymentTrend({
            startDate: resolvedRange.startDate,
            endDate: resolvedRange.endDate,
            platformId: platformId === LOAN_ALL_PLATFORMS ? undefined : platformId,
          }),
          loanApi.getPlatformBreakdown(),
        ]);

        if (!cancelled) {
          setMonthlyStats(nextMonthlyStats);
          setTrendData(nextTrendData);
          setPlatformBreakdown(
            nextPlatformBreakdown.map((item, index) => ({
              ...item,
              color: item.color ?? breakdownColors[index % breakdownColors.length],
            })),
          );
        }
      } catch (error) {
        if (!cancelled) {
          setMonthlyStats(createEmptyMonthlyStats(month));
          setTrendData([]);
          setPlatformBreakdown([]);
          showToast(buildApiErrorMessage(error, '贷款统计加载失败。'), 'error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [month, platformId, resolvedRange.endDate, resolvedRange.startDate, showToast]);

  const scopedBreakdown = useMemo(
    () => platformId === LOAN_ALL_PLATFORMS
      ? platformBreakdown
      : platformBreakdown.filter((item) => item.platformId === platformId),
    [platformBreakdown, platformId],
  );

  const currentPlatformName = useMemo(
    () => (platformId === LOAN_ALL_PLATFORMS ? '全部平台' : platforms.find((platform) => platform.id === platformId)?.name ?? '当前平台'),
    [platformId, platforms],
  );

  const hasTrendData = trendData.some((point) => point.repaymentAmount > 0 || point.interestAmount > 0);
  const hasBreakdown = scopedBreakdown.length > 0;

  return (
    <SectionCard
      title="统计"
      description="按月份、平台和时间范围查看账单汇总、还款趋势和平台分布。"
      action={<Tag tone="blue">{rangeMode === 'last30' ? '最近 30 天趋势' : '自定义趋势区间'}</Tag>}
    >
      <div className="page-stack">
        <div className="loan-filter-grid loan-filter-grid-statistics">
          <div className="loan-modal-date-slot">
            <MonthPickerField
              label="统计月份"
              value={month}
              onChange={setMonth}
              clearable={false}
            />
          </div>
          <SelectField label="平台筛选" value={platformId} onChange={(event) => setPlatformId(event.target.value)}>
            <option value={LOAN_ALL_PLATFORMS}>全部平台</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>{platform.name}</option>
            ))}
          </SelectField>
          <SelectField
            label="趋势范围"
            value={rangeMode}
            onChange={(event) => setRangeMode(event.target.value as 'last30' | 'custom')}
          >
            <option value="last30">最近 30 天</option>
            <option value="custom">自定义区间</option>
          </SelectField>
        </div>

        {rangeMode === 'custom' ? (
          <div className="loan-filter-grid loan-filter-grid-dates">
            <div className="loan-modal-date-slot">
              <DatePickerField label="开始日期" value={startDate} onChange={setStartDate} clearable={false} />
            </div>
            <div className="loan-modal-date-slot loan-modal-date-slot-end">
              <DatePickerField label="结束日期" value={endDate} onChange={setEndDate} clearable={false} />
            </div>
          </div>
        ) : null}

        <StatGrid
          items={[
            {
              label: '统计范围',
              value: currentPlatformName,
              helper: loading ? '正在同步后端统计数据' : '所有统计都直接来自后端接口',
            },
            { label: '月度账单数', value: `${monthlyStats.totalBills}` },
            { label: '月度账单总额', value: formatLoanAmount(monthlyStats.totalAmount) },
            { label: '月度已还金额', value: formatLoanAmount(monthlyStats.paidAmount) },
            { label: '月度待还金额', value: formatLoanAmount(monthlyStats.unpaidAmount) },
            {
              label: '月度利息',
              value: formatLoanAmount(monthlyStats.totalInterest),
              helper: `逾期金额 ${formatLoanAmount(monthlyStats.overdueAmount)}`,
            },
          ]}
        />

        <div className="loan-statistics-grid">
          <ChartCard
            title="还款趋势"
            description="查看最近 30 天或自定义区间内的还款金额和利息变化。"
            className="loan-chart-card-full"
          >
            {hasTrendData ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={trendData}>
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [formatLoanAmount(Number(value ?? 0)), name === 'repaymentAmount' ? '还款金额' : '利息']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="repaymentAmount" name="还款金额" stroke="var(--color-primary)" strokeWidth={2.8} dot={false} />
                    <Line type="monotone" dataKey="interestAmount" name="利息" stroke="#f59e0b" strokeWidth={2.4} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="暂无还款趋势"
                description="先补充还款记录，或切换到有数据的平台和时间区间。"
              />
            )}
          </ChartCard>

          <ChartCard title="平台分布" description="观察各贷款平台在当前范围内的累计账单规模。">
            {hasBreakdown ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={scopedBreakdown}
                      dataKey="totalAmount"
                      nameKey="platformName"
                      cx="50%"
                      cy="50%"
                      outerRadius={92}
                      innerRadius={36}
                      paddingAngle={2}
                      label={({ name, percent }) => `${(Number(percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={{ stroke: 'var(--color-hairline)', strokeWidth: 1 }}
                    >
                      {scopedBreakdown.map((item) => (
                        <Cell key={item.platformId} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [formatLoanAmount(Number(value ?? 0)), '累计账单']}
                    />
                    <Legend
                      layout="horizontal"
                      align="center"
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="暂无平台分布"
                description="当前筛选范围内还没有可统计的贷款账单结构。"
              />
            )}
          </ChartCard>

          <ChartCard title="平台待还排行" description="优先识别待还压力最大的贷款平台。">
            {hasBreakdown ? (
              <div className="fitness-chart-shell">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={scopedBreakdown.slice().sort((left, right) => right.unpaidAmount - left.unpaidAmount)}
                    layout="vertical"
                    margin={{ left: 16 }}
                  >
                    <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <YAxis type="category" dataKey="platformName" width={84} tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [formatLoanAmount(Number(value ?? 0)), name === 'unpaidAmount' ? '待还金额' : '累计账单']}
                    />
                    <Bar dataKey="unpaidAmount" name="待还金额" radius={[0, 8, 8, 0]}>
                      {scopedBreakdown.map((item) => (
                        <Cell key={item.platformId} fill={item.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="暂无待还排行"
                description="当前筛选范围内没有待还账单，因此还无法形成平台排行。"
              />
            )}
          </ChartCard>
        </div>
      </div>
    </SectionCard>
  );
}
