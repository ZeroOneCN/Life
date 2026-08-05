import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { financeReportApi } from '../../services/financeReportApi';
import type { FinanceMonthlyReport, FinanceReportModuleKey } from '../../types/financeReport';

const FinanceReportPage = lazy(() => import('./FinanceReport'));

type OverviewTab = 'overview' | 'report';

const TAB_OPTIONS: Array<{ value: OverviewTab; label: string }> = [
  { value: 'overview', label: '本期概览' },
  { value: 'report', label: '周期报告' },
];

const MODULE_LABELS: Record<FinanceReportModuleKey, string> = {
  shopping: '购物',
  travel: '旅行',
  loan: '贷款',
  subscription: '订阅',
  rent: '房租',
};

const TONE_MAP: Record<FinanceReportModuleKey, 'red' | 'orange' | 'green' | 'blue' | 'default'> = {
  shopping: 'red',
  travel: 'orange',
  loan: 'blue',
  subscription: 'green',
  rent: 'default',
};

/**
 * 格式化货币金额。
 * @param value - 金额数值
 * @returns 格式化后的货币字符串
 */
function formatCurrency(value: number) {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

/**
 * 格式化美元金额。投资账户为美元，统一用 $ 展示。
 * @param value - 金额数值
 * @returns 格式化后的美元字符串
 */
function formatUsd(value: number) {
  return `$${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

/**
 * 格式化百分比变化。
 * @param change - 变化值
 * @param percent - 变化百分比
 * @returns 带符号的变化描述
 */
function formatChange(change: number, percent: number) {
  const sign = change > 0 ? '+' : '';
  return `${sign}${formatCurrency(change)}（${sign}${(percent * 100).toFixed(1)}%）`;
}

/**
 * 财务概览页面：跨子模块综合展示财务数据。
 * 包含两个 Tab：
 * 1. 本期概览：当月总览、模块分布、投资与净资产
 * 2. 周期报告：月度/年度财务报告（复用 FinanceReport 页面）
 */
export default function FinanceOverviewPage() {
  const { toast, showToast } = useToastState();
  const [activeTab, setActiveTab] = usePageTab<OverviewTab>('overview', ['overview', 'report'], 'financeOverviewTab');
  const [report, setReport] = useState<FinanceMonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const currentMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  /**
   * 加载当月财务概览数据。
   */
  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeReportApi.getMonthly(currentMonth);
      setReport(data);
    } catch (error) {
      showToast(buildApiErrorMessage(error, '财务概览加载失败。'), 'error');
    } finally {
      setLoading(false);
    }
  }, [currentMonth, showToast]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <div className="page-stack">
      <PageHeader
        title="财务概览"
        subtitle="汇总各财务模块数据，查看概览与周期报告"
        actions={(
          <PillTabs
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={(v) => setActiveTab(v as OverviewTab)}
          />
        )}
      />

      {activeTab === 'overview' ? (
        <>
          <StatGrid
            items={[
              { label: '本月总支出', value: report ? formatCurrency(report.totalExpense) : '—' },
              {
                label: '环比变化',
                value: report ? formatChange(report.monthOverMonthChange, report.monthOverMonthChangePercent) : '—',
                helper: report ? `上月：${formatCurrency(report.previousMonthExpense)}` : undefined,
              },
              {
                label: '同比变化',
                value: report ? formatChange(report.yearOverYearChange, report.yearOverYearChangePercent) : '—',
                helper: report ? `去年同月：${formatCurrency(report.lastYearSameMonthExpense)}` : undefined,
              },
              { label: '投资净收益', value: report ? formatUsd(report.investment.netPnl) : '—' },
            ]}
          />

          <SectionCard
            title="模块支出分布"
            description="本月各财务模块支出占比一览"
          >
            {loading ? (
              <div style={{ opacity: 0.6, padding: 24, textAlign: 'center' }}>加载中…</div>
            ) : report && report.moduleBreakdown.length > 0 ? (
              <div className="finance-overview-module-list">
                {report.moduleBreakdown.map((item) => (
                  <div key={item.module} className="finance-overview-module-item">
                    <div className="finance-overview-module-head">
                      <Tag tone={TONE_MAP[item.module]}>{MODULE_LABELS[item.module]}</Tag>
                      <span className="finance-overview-module-amount">
                        {formatCurrency(item.amount)}
                        <span className="finance-overview-module-meta">
                          {item.count} 笔 · {(item.percentage * 100).toFixed(1)}%
                        </span>
                      </span>
                    </div>
                    <div className="finance-overview-module-bar">
                      <div
                        className="finance-overview-module-bar-fill"
                        style={{ width: `${Math.max(item.percentage * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-ink-tertiary)' }}>
                本月暂无支出记录
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="投资与净资产"
            description={`投资账户为美元，未还贷款为人民币；净资产按实时汇率折算后统一以人民币展示。`}
            action={report ? (
              <Tag tone={report.netWorth.exchangeRateSource === 'exchangerate-api' ? 'blue' : 'default'}>
                {report.netWorth.exchangeRateSource === 'exchangerate-api' ? '实时汇率' : '降级汇率'}
              </Tag>
            ) : undefined}
          >
            {loading ? (
              <div style={{ opacity: 0.6, padding: 24, textAlign: 'center' }}>加载中…</div>
            ) : report ? (
              <>
                <div className="callout callout-info" style={{ marginBottom: 12 }}>
                  汇率 1 USD = {report.netWorth.exchangeRate.toFixed(4)} CNY
                  （{report.netWorth.exchangeRateSource === 'exchangerate-api' ? 'Exchange Rate API 实时' : '内置降级汇率'}）
                </div>
                <StatGrid
                  items={[
                    { label: '毛收益', value: formatUsd(report.investment.grossPnl), helper: `≈ ¥${(report.investment.grossPnl * report.investment.exchangeRate).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
                    { label: '手续费', value: formatUsd(report.investment.totalCommission) },
                    { label: '隔夜费', value: formatUsd(report.investment.totalOvernightFee) },
                    { label: '交易笔数', value: `${report.investment.tradeCount}` },
                  ]}
                />
                <StatGrid
                  items={[
                    { label: '投资净值', value: formatUsd(report.investment.equity), helper: `≈ ¥${report.investment.equityInReportCurrency.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
                    { label: '投资回报率', value: `${(report.investment.roi * 100).toFixed(2)}%` },
                    { label: '未还贷款', value: formatCurrency(report.netWorth.unpaidLoanTotal) },
                    { label: '净资产（CNY）', value: formatCurrency(report.netWorth.netWorth), accent: report.netWorth.netWorth >= 0 ? 'var(--color-success-strong)' : 'var(--color-danger-strong)' },
                  ]}
                />
              </>
            ) : null}
          </SectionCard>
        </>
      ) : (
        <div className="finance-overview-report">
          <Suspense fallback={<div className="skeleton-block" />}>
            <FinanceReportPage embedded />
          </Suspense>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
