import { useMemo, useState, type ReactNode } from 'react';
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
import { Field, SelectField, Tag } from '../ui';
import {
  LOAN_ALL_PLATFORMS,
  buildLoanMonthlyStats,
  buildLoanPlatformBreakdown,
  buildLoanRepaymentTrend,
  formatLoanAmount,
  normalizeLoanUserId,
} from '../../services/loan';
import type { LoanBill, LoanPlatform, LoanRepayment } from '../../types/loan';

interface LoanStatisticsSectionProps {
  userId: string;
  bills: LoanBill[];
  platforms: LoanPlatform[];
  repayments: LoanRepayment[];
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

export function LoanStatisticsSection({
  userId,
  bills,
  platforms,
  repayments,
  onUserIdChange,
}: LoanStatisticsSectionProps) {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [platformId, setPlatformId] = useState(LOAN_ALL_PLATFORMS);
  const [rangeMode, setRangeMode] = useState<'last30' | 'custom'>('last30');
  const [startDate, setStartDate] = useState(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  const availablePlatforms = useMemo(() => {
    const normalizedUserId = userId.trim();
    return normalizedUserId ? platforms.filter((platform) => platform.userId === normalizedUserId) : platforms;
  }, [platforms, userId]);

  const monthlyStats = useMemo(
    () => buildLoanMonthlyStats(bills, month, userId, platformId),
    [bills, month, platformId, userId],
  );

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

  const trendData = useMemo(
    () => buildLoanRepaymentTrend(repayments, userId, resolvedRange.startDate, resolvedRange.endDate, platformId),
    [platformId, repayments, resolvedRange.endDate, resolvedRange.startDate, userId],
  );

  const platformBreakdown = useMemo(
    () => buildLoanPlatformBreakdown(bills, platforms, userId),
    [bills, platforms, userId],
  );

  const scopedBreakdown = useMemo(
    () => platformId === LOAN_ALL_PLATFORMS
      ? platformBreakdown
      : platformBreakdown.filter((item) => item.platformId === platformId),
    [platformBreakdown, platformId],
  );

  const hasTrendData = trendData.some((point) => point.repaymentAmount > 0 || point.interestAmount > 0);
  const hasBreakdown = scopedBreakdown.length > 0;

  return (
    <SectionCard
      title="统计"
      description="按用户、月份、平台和时间范围查看账单汇总、还款趋势与平台分布。"
      action={<Tag tone="blue">{rangeMode === 'last30' ? '最近 30 天趋势' : '自定义趋势区间'}</Tag>}
    >
      <div className="page-stack">
        <div className="loan-filter-grid loan-filter-grid-statistics">
          <Field
            label="统计用户 ID"
            value={userId}
            onChange={(event) => onUserIdChange(event.target.value)}
            placeholder="留空查看全部用户"
            hint="账单汇总、趋势图和平台分布都会按这里的用户维度重新聚合。"
          />
          <div className="loan-modal-date-slot">
            <MonthPickerField
              label="月度账单"
              value={month}
              onChange={setMonth}
              clearable={false}
            />
          </div>
          <SelectField label="平台筛选" value={platformId} onChange={(event) => setPlatformId(event.target.value)}>
            <option value={LOAN_ALL_PLATFORMS}>全部平台</option>
            {availablePlatforms.map((platform) => (
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
              label: '统计用户',
              value: normalizeLoanUserId(userId) || '全部用户',
              helper: platformId === LOAN_ALL_PLATFORMS ? '当前汇总全部平台' : '当前已聚焦单个平台',
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
            description="最近 30 天或自定义时间范围内，按天观察还款金额和利息变化。"
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
                description="先补充还款记录，或切换到有数据的用户、平台和时间区间。"
              />
            )}
          </ChartCard>

          <ChartCard title="平台分布" description="观察每个平台在当前用户下的累计账单规模。">
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
                      label={({ name, percent }) => `${name} ${(Number(percent ?? 0) * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {scopedBreakdown.map((item) => (
                        <Cell key={item.platformId} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [formatLoanAmount(Number(value ?? 0)), '累计账单']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="暂无平台分布"
                description="当前用户还没有形成可统计的借款平台账单结构。"
              />
            )}
          </ChartCard>

          <ChartCard title="平台待还排行" description="优先识别待还压力最高的平台。">
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
                description="当前筛选范围内没有待还账单，因此暂时无法形成平台待还排行。"
              />
            )}
          </ChartCard>
        </div>
      </div>
    </SectionCard>
  );
}
