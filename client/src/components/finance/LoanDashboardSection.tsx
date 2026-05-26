import { useMemo } from 'react';
import dayjs from 'dayjs';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, Tag } from '../ui';
import { formatLoanAmount, getLoanBillStatus } from '../../services/loan';
import type { LoanBill, LoanOverviewSummary, LoanPlatformBreakdownPoint } from '../../types/loan';

interface LoanDashboardSectionProps {
  overview: LoanOverviewSummary;
  bills: LoanBill[];
  platformBreakdown: LoanPlatformBreakdownPoint[];
  onMarkPaid: (billId: string) => void;
  onOpenTab: (tab: 'bills' | 'repayments' | 'statistics' | 'settings') => void;
}

export function LoanDashboardSection({
  overview,
  bills,
  platformBreakdown,
  onMarkPaid,
  onOpenTab,
}: LoanDashboardSectionProps) {
  const focusedBills = useMemo(
    () => bills
      .filter((bill) => !bill.isPaid)
      .sort((left, right) => dayjs(left.dueDate).valueOf() - dayjs(right.dueDate).valueOf())
      .slice(0, 6),
    [bills],
  );

  const topPlatforms = useMemo(
    () => [...platformBreakdown].sort((left, right) => right.unpaidAmount - left.unpaidAmount).slice(0, 5),
    [platformBreakdown],
  );

  return (
    <SectionCard
      title="总览"
      description="快速查看当前贷款规模、待还压力和近期优先处理的账单。"
    >
      <div className="page-stack">
        <div className="loan-dashboard-actions">
          <Btn tone="secondary" onClick={() => onOpenTab('bills')}>查看账单</Btn>
          <Btn tone="secondary" onClick={() => onOpenTab('repayments')}>查看还款</Btn>
          <Btn tone="secondary" onClick={() => onOpenTab('statistics')}>查看统计</Btn>
          <Btn tone="primary" onClick={() => onOpenTab('settings')}>提醒设置</Btn>
        </div>

        <StatGrid
          items={[
            { label: '总负债', value: formatLoanAmount(overview.totalDebt) },
            { label: '已还金额', value: formatLoanAmount(overview.totalPaid) },
            { label: '待还金额', value: formatLoanAmount(overview.totalUnpaid) },
            { label: '总利息', value: formatLoanAmount(overview.totalInterest) },
            { label: '账单总数', value: `${overview.totalBillCount}` },
            {
              label: '近期风险',
              value: `${overview.upcomingCount} 待还 / ${overview.overdueCount} 逾期`,
              helper: '优先处理逾期和未来 7 天内到期的账单。',
            },
          ]}
        />

        <div className="loan-dashboard-grid">
          <div className="fitness-chart-card">
            <div className="fitness-chart-header">
              <strong>近期待还账单</strong>
              <span>按到期日从近到远排序，方便先处理最紧急的账单。</span>
            </div>
            {focusedBills.length ? (
              <div className="loan-list-grid">
                {focusedBills.map((bill) => {
                  const status = getLoanBillStatus(bill);
                  return (
                    <article key={bill.id} className={`loan-summary-card is-${status}`}>
                      <div className="loan-summary-card-head">
                        <div>
                          <strong>{bill.platformName}</strong>
                          <div className="loan-summary-card-meta">
                            <span>账单月份 {bill.billingMonth}</span>
                            <span>到期日 {bill.dueDate}</span>
                          </div>
                        </div>
                        <Tag tone={status === 'paid' ? 'green' : status === 'overdue' ? 'red' : 'orange'}>
                          {status === 'paid' ? '已还' : status === 'overdue' ? '已逾期' : '待还'}
                        </Tag>
                      </div>
                      <div className="loan-summary-card-metrics">
                        <span>本金 {formatLoanAmount(bill.amount)}</span>
                        <span>利息 {formatLoanAmount(bill.interest)}</span>
                      </div>
                      <div className="fitness-row-actions">
                        <Btn tone="secondary" onClick={() => onOpenTab('bills')}>打开账单</Btn>
                        <Btn tone="primary" disabled={bill.isPaid} onClick={() => onMarkPaid(bill.id)}>
                          标记已还
                        </Btn>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="暂无待处理账单"
                description="当前没有未还账单，后续新增账单后这里会自动汇总显示。"
              />
            )}
          </div>

          <div className="fitness-chart-card">
            <div className="fitness-chart-header">
              <strong>平台负债分布</strong>
              <span>快速识别待还压力最大的贷款平台。</span>
            </div>
            {topPlatforms.length ? (
              <div className="loan-list-grid">
                {topPlatforms.map((item) => (
                  <article key={item.platformId} className="loan-platform-spotlight">
                    <div className="loan-platform-spotlight-head">
                      <strong>{item.platformName}</strong>
                      <Tag tone={item.unpaidAmount > 0 ? 'orange' : 'green'}>{item.billCount} 笔账单</Tag>
                    </div>
                    <div className="loan-summary-card-metrics">
                      <span>总额 {formatLoanAmount(item.totalAmount)}</span>
                      <span>待还 {formatLoanAmount(item.unpaidAmount)}</span>
                    </div>
                    <div className="loan-summary-card-metrics">
                      <span>已还 {formatLoanAmount(item.paidAmount)}</span>
                      <span>利息 {formatLoanAmount(item.totalInterest)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="暂无平台分布"
                description="先补充平台和账单后，这里会展示各平台的负债结构。"
              />
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
