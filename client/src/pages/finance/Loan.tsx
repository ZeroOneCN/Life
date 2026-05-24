import { useEffect, useMemo } from 'react';

import { LoanBillsSection } from '../../components/finance/LoanBillsSection';
import { LoanDashboardSection } from '../../components/finance/LoanDashboardSection';
import { LoanPlatformsSection } from '../../components/finance/LoanPlatformsSection';
import { LoanRepaymentsSection } from '../../components/finance/LoanRepaymentsSection';
import { LoanSettingsSection } from '../../components/finance/LoanSettingsSection';
import { LoanStatisticsSection } from '../../components/finance/LoanStatisticsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Field, PillTabs, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  buildInitialLoanState,
  buildLoanOverview,
  filterLoanPlatformsByUserId,
  formatLoanAmount,
  markLoanBillAsPaid,
  normalizeLoanPageState,
} from '../../services/loan';
import type { LoanPageState, LoanTab } from '../../types/loan';

const STORAGE_KEY = 'lifeos_finance_loan_page';

const TAB_OPTIONS: Array<{ value: LoanTab; label: string }> = [
  { value: 'dashboard', label: '概览' },
  { value: 'platforms', label: '平台' },
  { value: 'bills', label: '账单' },
  { value: 'repayments', label: '还款' },
  { value: 'statistics', label: '统计' },
  { value: 'settings', label: '设置' },
];

export default function LoanPage() {
  const [data, setData] = useLocalStorageState<LoanPageState>(STORAGE_KEY, buildInitialLoanState);
  const [tab, setTab] = usePageTab<LoanTab>('dashboard', TAB_OPTIONS.map((item) => item.value), 'loanTab');
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeLoanPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const overview = useMemo(
    () => buildLoanOverview(normalizedData.bills, normalizedData.repayments, normalizedData.settings.activeUserId),
    [normalizedData.bills, normalizedData.repayments, normalizedData.settings.activeUserId],
  );

  const activePlatforms = useMemo(
    () => filterLoanPlatformsByUserId(normalizedData.platforms, normalizedData.settings.activeUserId),
    [normalizedData.platforms, normalizedData.settings.activeUserId],
  );

  const updateSettings = (patch: Partial<LoanPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
  };

  const handleActiveUserChange = (value: string) => {
    updateSettings({
      activeUserId: value,
      billsUserId: value,
      repaymentsUserId: value,
      statisticsUserId: value,
    });
  };

  const handleMarkPaid = (billId: string) => {
    const result = markLoanBillAsPaid(
      normalizedData.bills,
      normalizedData.repayments,
      billId,
      normalizedData.settings.autoRepaymentOnMarkPaid,
    );

    setData((previous) => ({
      ...previous,
      bills: result.bills,
      repayments: result.repayments,
    }));

    showToast(
      result.createdRepayment
        ? '账单已标记为已还，并自动生成了一笔还款记录。'
        : '账单已标记为已还。',
    );
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="借款还款"
        subtitle="把平台、账单、还款、统计和提醒规则统一收进当前 LifeOS 前端体系，全部数据本地持久化，并保持主题化日期控件和紧凑后台布局一致。"
      />

      <SectionCard
        title="当前上下文"
        description="这里决定当前借款页默认归属的用户维度，新增平台、账单和还款记录都会优先沿用这一组上下文。"
      >
        <div className="loan-context-grid">
          <Field
            label="当前用户 ID"
            value={normalizedData.settings.activeUserId}
            onChange={(event) => handleActiveUserChange(event.target.value)}
            placeholder="例如：user-001"
          />
          <div className="loan-context-summary">
            <span>当前用户平台 {activePlatforms.length} 个</span>
            <span>账单 {overview.totalBillCount} 笔</span>
            <span>还款 {overview.repaymentCount} 笔</span>
          </div>
        </div>
      </SectionCard>

      <StatGrid
        items={[
          {
            label: '当前用户',
            value: normalizedData.settings.activeUserId || '未设置',
            helper: '平台、账单、还款和统计默认都会跟随这里的用户上下文',
          },
          { label: '总负债', value: formatLoanAmount(overview.totalDebt) },
          { label: '已还金额', value: formatLoanAmount(overview.totalPaid) },
          { label: '待还金额', value: formatLoanAmount(overview.totalUnpaid) },
          {
            label: '当前风险',
            value: `${overview.upcomingCount} 待还 / ${overview.overdueCount} 逾期`,
            helper: '提醒场景会复用通知中心的统一发送入口',
          },
          { label: '总利息', value: formatLoanAmount(overview.totalInterest) },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="概览、平台、账单、还款、统计和设置共用一套本地数据模型、通知联动规则和主题化日期交互。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as LoanTab)} />
      </SectionCard>

      {tab === 'dashboard' ? (
        <LoanDashboardSection
          activeUserId={normalizedData.settings.activeUserId}
          bills={normalizedData.bills}
          platforms={normalizedData.platforms}
          repayments={normalizedData.repayments}
          onActiveUserIdChange={handleActiveUserChange}
          onMarkPaid={handleMarkPaid}
          onOpenTab={(nextTab) => setTab(nextTab)}
        />
      ) : null}

      {tab === 'platforms' ? (
        <LoanPlatformsSection
          activeUserId={normalizedData.settings.activeUserId}
          bills={normalizedData.bills}
          platforms={normalizedData.platforms}
          repayments={normalizedData.repayments}
          onChangePlatforms={(updater) => {
            setData((previous) => ({
              ...previous,
              platforms: updater(previous.platforms),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'bills' ? (
        <LoanBillsSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.billsUserId}
          bills={normalizedData.bills}
          platforms={normalizedData.platforms}
          onFilterUserIdChange={(value) => updateSettings({ billsUserId: value })}
          onChangeBills={(updater) => {
            setData((previous) => ({
              ...previous,
              bills: updater(previous.bills),
            }));
          }}
          onMarkPaid={handleMarkPaid}
          showToast={showToast}
        />
      ) : null}

      {tab === 'repayments' ? (
        <LoanRepaymentsSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.repaymentsUserId}
          bills={normalizedData.bills}
          platforms={normalizedData.platforms}
          repayments={normalizedData.repayments}
          onFilterUserIdChange={(value) => updateSettings({ repaymentsUserId: value })}
          onChangeRepayments={(updater) => {
            setData((previous) => ({
              ...previous,
              repayments: updater(previous.repayments),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'statistics' ? (
        <LoanStatisticsSection
          userId={normalizedData.settings.statisticsUserId}
          bills={normalizedData.bills}
          platforms={normalizedData.platforms}
          repayments={normalizedData.repayments}
          onUserIdChange={(value) => updateSettings({ statisticsUserId: value })}
        />
      ) : null}

      {tab === 'settings' ? (
        <LoanSettingsSection
          bills={normalizedData.bills}
          settings={normalizedData.settings}
          onSettingsChange={updateSettings}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
