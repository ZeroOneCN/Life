import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { LoanBillsSection } from '../../components/finance/LoanBillsSection';
import { LoanDashboardSection } from '../../components/finance/LoanDashboardSection';
import { LoanPlatformsSection } from '../../components/finance/LoanPlatformsSection';
import { LoanRepaymentsSection } from '../../components/finance/LoanRepaymentsSection';
import { LoanSettingsSection } from '../../components/finance/LoanSettingsSection';
import { LoanStatisticsSection } from '../../components/finance/LoanStatisticsSection';
import { PageHeader, StatGrid } from '../../components/page';
import { Btn, DeleteModal, PillTabs, Toast, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { hydrateNotificationCenterState } from '../../services/notificationCenter';
import { formatLoanAmount } from '../../services/loan';
import { loanApi } from '../../services/loanApi';
import type {
  LoanBill,
  LoanOverviewSummary,
  LoanPlatform,
  LoanPlatformBreakdownPoint,
  LoanRepayment,
  LoanSettings,
  LoanTab,
} from '../../types/loan';

const TAB_OPTIONS: Array<{ value: LoanTab; label: string }> = [
  { value: 'dashboard', label: '总览' },
  { value: 'platforms', label: '平台' },
  { value: 'bills', label: '账单' },
  { value: 'repayments', label: '还款' },
  { value: 'statistics', label: '统计' },
  { value: 'settings', label: '设置' },
];

const EMPTY_SETTINGS: LoanSettings = {
  repaymentReminderEnabled: true,
  overdueReminderEnabled: true,
  autoRepaymentOnMarkPaid: true,
  notificationFrequency: 'daily',
  upcomingDays: 7,
};

const EMPTY_OVERVIEW: LoanOverviewSummary = {
  totalDebt: 0,
  totalPaid: 0,
  totalUnpaid: 0,
  totalInterest: 0,
  totalBillCount: 0,
  repaymentCount: 0,
  upcomingCount: 0,
  overdueCount: 0,
};

export default function LoanPage() {
  const [tab, setTab] = usePageTab<LoanTab>('dashboard', TAB_OPTIONS.map((item) => item.value), 'loanTab');
  useBreadcrumbTail(TAB_OPTIONS.find((item) => item.value === tab)?.label);
  const { toast, showToast } = useToastState();
  const [platforms, setPlatforms] = useState<LoanPlatform[]>([]);
  const [bills, setBills] = useState<LoanBill[]>([]);
  const [repayments, setRepayments] = useState<LoanRepayment[]>([]);
  const [settings, setSettings] = useState<LoanSettings>(EMPTY_SETTINGS);
  const [overview, setOverview] = useState<LoanOverviewSummary>(EMPTY_OVERVIEW);
  const [platformBreakdown, setPlatformBreakdown] = useState<LoanPlatformBreakdownPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [pendingMarkPaidId, setPendingMarkPaidId] = useState<string | null>(null);
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const reload = useCallback(async () => {
    const [
      nextPlatforms,
      nextBills,
      nextRepayments,
      nextOverview,
      nextPlatformBreakdown,
      nextSettings,
    ] = await Promise.all([
      loanApi.listPlatforms({ page: 1, page_size: 1000 }),
      loanApi.listBills({ page: 1, page_size: 1000 }),
      loanApi.listRepayments({ page: 1, page_size: 1000 }),
      loanApi.getOverview(),
      loanApi.getPlatformBreakdown(),
      loanApi.getSettings(),
    ]);

    setPlatforms(nextPlatforms.items);
    setBills(nextBills.items);
    setRepayments(nextRepayments.items);
    setOverview(nextOverview);
    setPlatformBreakdown(nextPlatformBreakdown);
    setSettings({
      ...EMPTY_SETTINGS,
      ...nextSettings,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        await reload();
        if (!cancelled) {
          await hydrateNotificationCenterState();
        }
      } catch (error) {
        if (!cancelled) {
          showToastRef.current(buildApiErrorMessage(error, '借贷中心加载失败。'), 'error');
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
  }, [reload, refreshToken]);

  const runWithRefresh = useCallback(async (action: () => Promise<void>, successMessage?: string) => {
    try {
      await action();
      await reload();
      if (successMessage) {
        showToast(successMessage);
      }
    } catch (error) {
      showToast(buildApiErrorMessage(error, '借贷数据保存失败。'), 'error');
      await reload();
      throw error;
    }
  }, [reload, showToast]);

  const updateSettings = useCallback(async (patch: Partial<LoanSettings>) => {
    try {
      const next = await loanApi.updateSettings(patch);
      setSettings((current) => ({
        ...current,
        ...next,
      }));
      await hydrateNotificationCenterState();
      showToast('借贷提醒设置已更新。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '借贷提醒设置更新失败。'), 'error');
    }
  }, [showToast]);

  const handleMarkPaid = useCallback(async (billId: string) => {
    setPendingMarkPaidId(billId);
  }, []);

  const confirmMarkPaid = useCallback(async () => {
    if (!pendingMarkPaidId) return;
    const id = pendingMarkPaidId;
    setPendingMarkPaidId(null);
    try {
      await loanApi.markBillPaid(id);
      await reload();
      await hydrateNotificationCenterState();
      showToast('账单已一次结清。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '结清失败。'), 'error');
    }
  }, [pendingMarkPaidId, reload, showToast]);

  /**
   * 部分还款处理：调用后端 partial-repay API 后刷新数据。
   *
   * @param billId 账单 ID
   * @param amount 本次还款总金额
   * @param options.repaymentDate 可选还款日期
   * @param options.notes 可选备注
   */
  const handlePartialRepay = useCallback(async (
    billId: string,
    amount: number,
    options?: { repaymentDate?: string; notes?: string },
  ) => {
    await loanApi.partialRepay(billId, amount, options);
    await reload();
  }, [reload]);

  const summaryCards = useMemo(() => ([
    { label: '总负债', value: formatLoanAmount(overview.totalDebt), helper: `已还 ${formatLoanAmount(overview.totalPaid)}` },
    // 待还金额 = 剩余欠款（amount 已含利息），不单独展示利息
    { label: '待还金额', value: formatLoanAmount(overview.totalUnpaid) },
    { label: '风险账单', value: `${overview.overdueCount} 逾期`, accent: overview.overdueCount > 0 ? 'var(--color-danger)' : undefined, helper: overview.upcomingCount > 0 ? `${overview.upcomingCount} 笔即将到期` : '无即将到期' },
    { label: '当前账单数', value: `${overview.totalBillCount}`, helper: overview.totalBillCount > 0 ? '点击查看详情' : '暂无账单' },
  ]), [overview]);

  return (
    <div className="page-stack">
      <PageHeader
        title="借贷还款"
        subtitle="管理借贷平台、账单还款与逾期提醒。"
        actions={(
          <>
            <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as LoanTab)} />
            <Btn
              tone="ghost"
              onClick={() => setTab('settings')}
            >
              {tab === 'settings' ? '← 返回业务' : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  设置
                </span>
              )}
            </Btn>
          </>
        )}
      />

      <StatGrid items={summaryCards} />

      {tab === 'dashboard' ? (
        <LoanDashboardSection
          overview={overview}
          bills={bills}
          platformBreakdown={platformBreakdown}
          onMarkPaid={handleMarkPaid}
          onOpenTab={(nextTab) => setTab(nextTab)}
        />
      ) : null}

      {tab === 'platforms' ? (
        <LoanPlatformsSection
          bills={bills}
          platforms={platforms}
          repayments={repayments}
          onCreate={(draft) => runWithRefresh(() => loanApi.createPlatform(draft).then(() => undefined))}
          onUpdate={(platformId, draft) => runWithRefresh(() => loanApi.updatePlatform(platformId, draft).then(() => undefined))}
          onDelete={(platformId) => runWithRefresh(() => loanApi.deletePlatform(platformId).then(() => undefined))}
          showToast={showToast}
        />
      ) : null}

      {tab === 'bills' ? (
        <LoanBillsSection
          bills={bills}
          platforms={platforms}
          onCreate={(draft) => runWithRefresh(() => loanApi.createBill(draft).then(() => undefined))}
          onUpdate={(billId, draft) => runWithRefresh(() => loanApi.updateBill(billId, draft).then(() => undefined))}
          onDelete={(billId) => runWithRefresh(() => loanApi.deleteBill(billId).then(() => undefined))}
          onMarkPaid={handleMarkPaid}
          onPartialRepay={handlePartialRepay}
          showToast={showToast}
        />
      ) : null}

      {tab === 'repayments' ? (
        <LoanRepaymentsSection
          bills={bills}
          platforms={platforms}
          repayments={repayments}
          onCreate={(draft) => runWithRefresh(() => loanApi.createRepayment(draft).then(() => undefined))}
          onUpdate={(repaymentId, draft) => runWithRefresh(() => loanApi.updateRepayment(repaymentId, draft).then(() => undefined))}
          onDelete={(repaymentId) => runWithRefresh(() => loanApi.deleteRepayment(repaymentId).then(() => undefined))}
          showToast={showToast}
        />
      ) : null}

      {tab === 'statistics' ? (
        <LoanStatisticsSection
          platforms={platforms}
          showToast={showToast}
        />
      ) : null}

      {tab === 'settings' ? (
        <LoanSettingsSection
          bills={bills}
          settings={settings}
          onSettingsChange={(patch) => {
            void updateSettings(patch);
          }}
          showToast={showToast}
        />
      ) : null}

      <DeleteModal
        open={Boolean(pendingMarkPaidId)}
        onClose={() => setPendingMarkPaidId(null)}
        onConfirm={confirmMarkPaid}
        title="确认一次结清？"
        confirmLabel="确认结清"
        confirmTone="primary"
      >
        结清后账单剩余金额将全部标记为已还，并自动生成还款记录，此操作不可撤销。
      </DeleteModal>

      <Toast toast={toast} />
    </div>
  );
}
