import { useMemo } from 'react';
import dayjs from 'dayjs';

import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, Field, Tag } from '../ui';
import {
  buildLoanOverview,
  buildLoanPlatformBreakdown,
  filterLoanBills,
  formatLoanAmount,
  getLoanBillStatus,
  normalizeLoanUserId,
} from '../../services/loan';
import type { LoanBill, LoanPlatform, LoanRepayment } from '../../types/loan';

interface LoanDashboardSectionProps {
  activeUserId: string;
  bills: LoanBill[];
  platforms: LoanPlatform[];
  repayments: LoanRepayment[];
  onActiveUserIdChange: (value: string) => void;
  onMarkPaid: (billId: string) => void;
  onOpenTab: (tab: 'bills' | 'repayments' | 'statistics' | 'settings') => void;
}

export function LoanDashboardSection({
  activeUserId,
  bills,
  platforms,
  repayments,
  onActiveUserIdChange,
  onMarkPaid,
  onOpenTab,
}: LoanDashboardSectionProps) {
  const overview = useMemo(
    () => buildLoanOverview(bills, repayments, activeUserId),
    [activeUserId, bills, repayments],
  );

  const focusedBills = useMemo(
    () => filterLoanBills(bills, activeUserId)
      .filter((bill) => !bill.isPaid)
      .sort((left, right) => dayjs(left.dueDate).valueOf() - dayjs(right.dueDate).valueOf())
      .slice(0, 6),
    [activeUserId, bills],
  );

  const platformBreakdown = useMemo(
    () => buildLoanPlatformBreakdown(bills, platforms, activeUserId).slice(0, 5),
    [activeUserId, bills, platforms],
  );

  return (
    <SectionCard
      title="概览"
      description="快速查看当前用户的贷款规模、待还压力和近期优先处理的账单。"
    >
      <div className="page-stack">
        <div className="loan-context-grid">
          <Field
            label="当前用户 ID"
            value={activeUserId}
            onChange={(event) => onActiveUserIdChange(event.target.value)}
            placeholder="例如：user-001"
            hint="概览、平台、账单、还款和统计默认都会跟随这里的用户上下文。"
          />
          <div className="loan-dashboard-actions">
            <Btn tone="secondary" onClick={() => onOpenTab('bills')}>查看账单</Btn>
            <Btn tone="secondary" onClick={() => onOpenTab('repayments')}>查看还款</Btn>
            <Btn tone="secondary" onClick={() => onOpenTab('statistics')}>查看统计</Btn>
            <Btn tone="primary" onClick={() => onOpenTab('settings')}>提醒设置</Btn>
          </div>
        </div>

        <StatGrid
          items={[
            {
              label: '当前用户',
              value: normalizeLoanUserId(activeUserId) || '未设置',
              helper: '切换用户后，贷款中心所有业务区块都会同步刷新。',
            },
            { label: '总负债', value: formatLoanAmount(overview.totalDebt) },
            { label: '已还金额', value: formatLoanAmount(overview.totalPaid) },
            { label: '待还金额', value: formatLoanAmount(overview.totalUnpaid) },
            { label: '总利息', value: formatLoanAmount(overview.totalInterest) },
            {
              label: '近期风险',
              value: `${overview.upcomingCount} 待还 / ${overview.overdueCount} 逾期`,
              helper: '越接近逾期，越适合在通知中心绑定高优先级渠道。',
            },
          ]}
        />

        <div className="loan-dashboard-grid">
          <div className="fitness-chart-card">
            <div className="fitness-chart-header">
              <strong>近期待还账单</strong>
              <span>按到期日从近到远排序，优先处理逾期和 7 天内的账单。</span>
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
                description="当前用户下没有未还账单，后续新增账单后这里会自动聚合展示。"
              />
            )}
          </div>

          <div className="fitness-chart-card">
            <div className="fitness-chart-header">
              <strong>平台负债分布</strong>
              <span>帮助快速识别主要压力来源平台，便于后续切换到平台或统计页继续整理。</span>
            </div>
            {platformBreakdown.length ? (
              <div className="loan-list-grid">
                {platformBreakdown.map((item) => (
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
                description="先为当前用户补充平台和账单，平台负债结构才会形成。"
              />
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
