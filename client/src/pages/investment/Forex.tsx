import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ForexCalculatorSection } from '../../components/investment/ForexCalculatorSection';
import { ForexCapitalSection } from '../../components/investment/ForexCapitalSection';
import { ForexDashboardSection } from '../../components/investment/ForexDashboardSection';
import { ForexTradesSection } from '../../components/investment/ForexTradesSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { forexApi } from '../../services/forexApi';
import { buildForexDashboardSummary, normalizeForexDashboardRange } from '../../services/forex';
import type {
  ForexCapitalFlow,
  ForexDashboardSummary,
  ForexPageState,
  ForexTab,
  ForexTradeRecord,
} from '../../types/forex';

const TAB_OPTIONS: Array<{ value: ForexTab; label: string }> = [
  { value: 'dashboard', label: '统计看板' },
  { value: 'trades', label: '交易记录' },
  { value: 'calculator', label: '交易计算' },
  { value: 'capital', label: '出入金' },
];

const EMPTY_SUMMARY: ForexDashboardSummary = {
  tradeCount: 0,
  grossPnl: 0,
  totalCommission: 0,
  realizedNetPnl: 0,
  winRate: 0,
  profitLossRatio: 0,
  longCount: 0,
  shortCount: 0,
  xauCount: 0,
  xagCount: 0,
  totalDeposit: 0,
  totalWithdrawal: 0,
  netCapital: 0,
  equity: 0,
  roi: 0,
};

const EMPTY_SETTINGS: ForexPageState['settings'] = {
  leverage: 100,
  forcedLiquidationRatio: 0.5,
  dashboardStartDate: '',
  dashboardEndDate: '',
};

function findCreated<T extends { id: string }>(previous: T[], next: T[]) {
  return next.filter((item) => !previous.some((record) => record.id === item.id));
}

function findDeletedIds<T extends { id: string }>(previous: T[], next: T[]) {
  return previous.filter((item) => !next.some((record) => record.id === item.id)).map((item) => item.id);
}

export default function ForexPage() {
  const [tab, setTab] = usePageTab<ForexTab>('dashboard', TAB_OPTIONS.map((item) => item.value), 'forexTab');
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [trades, setTrades] = useState<ForexTradeRecord[]>([]);
  const [capitalFlows, setCapitalFlows] = useState<ForexCapitalFlow[]>([]);
  const [summary, setSummary] = useState<ForexDashboardSummary>(EMPTY_SUMMARY);
  const [settings, setSettings] = useState<ForexPageState['settings']>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const reloading = useRef(false);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (reloading.current) return;
    reloading.current = true;
    try {
      const [nextTrades, nextCapitalFlows, nextSummary, nextSettings] = await Promise.all([
        forexApi.listTrades({ page: 1, page_size: 500 }),
        forexApi.listCapitalFlows({ page: 1, page_size: 500 }),
        forexApi.getDashboardSummary(),
        forexApi.getSettings(),
      ]);

      if (!mounted.current) return;
      setTrades(nextTrades.items);
      setCapitalFlows(nextCapitalFlows.items);
      setSummary(nextSummary);
      setSettings({
        ...EMPTY_SETTINGS,
        ...nextSettings,
      });
    } finally {
      reloading.current = false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    const load = async () => {
      setLoading(true);
      try {
        await reload();
      } catch (error) {
        if (mounted.current) {
          showToastRef.current(buildApiErrorMessage(error, '外汇页面加载失败。'), 'error');
        }
      } finally {
        if (mounted.current) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const updateSettings = useCallback(async (patch: Partial<ForexPageState['settings']>) => {
    try {
      const next = await forexApi.updateSettings(patch);
      setSettings((current) => ({
        ...current,
        ...next,
      }));
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '外汇设置保存失败。'), 'error');
    }
  }, [reload, showToast]);

  const effectiveDashboardRange = useMemo(
    () => normalizeForexDashboardRange(trades, settings.dashboardStartDate, settings.dashboardEndDate),
    [settings.dashboardEndDate, settings.dashboardStartDate, trades],
  );

  const frontendSummary = useMemo(
    () => buildForexDashboardSummary(trades, capitalFlows, effectiveDashboardRange.startDate, effectiveDashboardRange.endDate),
    [capitalFlows, effectiveDashboardRange.endDate, effectiveDashboardRange.startDate, trades],
  );

  useEffect(() => {
    if (effectiveDashboardRange.shouldReset) {
      void updateSettings({ dashboardStartDate: '', dashboardEndDate: '' });
    }
  }, [effectiveDashboardRange.shouldReset]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImportApplied = useCallback((_nextTrades: ForexTradeRecord[]) => {
    // After import, handleTradesChange already saves trades to the backend and
    // calls reload(). The effective dashboard range is computed from the full
    // trade dataset when settings dates are empty, so no separate settings
    // update is needed here. The user can still manually set date ranges via
    // the date pickers in the dashboard section.
  }, []);

  const handleTradesChange = useCallback(async (updater: (items: ForexTradeRecord[]) => ForexTradeRecord[]) => {
    const previous = trades;
    const next = updater(previous);
    setTrades(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => forexApi.createTrade({
          tradeDate: item.tradeDate,
          instrument: item.instrument,
          orderType: item.orderType,
          openPrice: item.openPrice,
          lotSize: item.lotSize,
          commission: item.commission,
          closePrice: item.closePrice,
          pnl: item.pnl,
          openTime: item.openTime,
          closeTime: item.closeTime,
          holdTime: item.holdTime,
          remark: item.remark,
        })),
        ...updated.map((item) => forexApi.updateTrade(item.id, {
          tradeDate: item.tradeDate,
          instrument: item.instrument,
          orderType: item.orderType,
          openPrice: item.openPrice,
          lotSize: item.lotSize,
          commission: item.commission,
          closePrice: item.closePrice,
          pnl: item.pnl,
          openTime: item.openTime,
          closeTime: item.closeTime,
          holdTime: item.holdTime,
          remark: item.remark,
        })),
        ...deletedIds.map((id) => forexApi.deleteTrade(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '交易记录保存失败。'), 'error');
      await reload();
    }
  }, [reload, showToast, trades]);

  const handleCapitalFlowsChange = useCallback(async (updater: (items: ForexCapitalFlow[]) => ForexCapitalFlow[]) => {
    const previous = capitalFlows;
    const next = updater(previous);
    setCapitalFlows(next);

    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => forexApi.createCapitalFlow({
          flowDate: item.flowDate,
          flowType: item.flowType,
          amount: item.amount,
          remark: item.remark,
        })),
        ...updated.map((item) => forexApi.updateCapitalFlow(item.id, {
          flowDate: item.flowDate,
          flowType: item.flowType,
          amount: item.amount,
          remark: item.remark,
        })),
        ...deletedIds.map((id) => forexApi.deleteCapitalFlow(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '出入金记录保存失败。'), 'error');
      await reload();
    }
  }, [capitalFlows, reload, showToast]);

  return (
    <div className="page-stack">
      <PageHeader
        title="外汇市场"
        subtitle={loading ? '正在从后端加载交易、出入金、统计和设置。' : '外汇页面已切到后端唯一数据源，浏览器不再保存整页交易真相。'}
      />

      <StatGrid
        items={[
          { label: '净收益', value: `${summary.realizedNetPnl >= 0 ? '+' : ''}$${summary.realizedNetPnl.toFixed(2)}`, accent: summary.realizedNetPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
          { label: '胜率', value: `${(summary.winRate * 100).toFixed(1)}%`, helper: `${summary.tradeCount} 笔交易` },
          { label: '总手数', value: `${summary.longCount + summary.shortCount}`, helper: `多 ${summary.longCount} / 空 ${summary.shortCount}` },
          { label: 'ROI', value: `${frontendSummary.roi >= 0 ? '+' : ''}${frontendSummary.roi.toFixed(1)}%`, accent: frontendSummary.roi >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="统计、交易、计算器和出入金都直接以数据库与接口响应为准。"
      >
        <PillTabs
          options={TAB_OPTIONS}
          value={tab}
          onChange={(value) => setTab(value as ForexTab)}
        />
      </SectionCard>

      {tab === 'dashboard' ? (
        <ForexDashboardSection
          trades={trades}
          capitalFlows={capitalFlows}
          startDate={effectiveDashboardRange.startDate}
          endDate={effectiveDashboardRange.endDate}
          onStartDateChange={(value) => {
            void updateSettings({ dashboardStartDate: value });
          }}
          onEndDateChange={(value) => {
            void updateSettings({ dashboardEndDate: value });
          }}
        />
      ) : null}

      {tab === 'trades' ? (
        <ForexTradesSection
          trades={trades}
          onChangeTrades={(updater) => {
            void handleTradesChange(updater);
          }}
          onImportApplied={handleImportApplied}
          showToast={showToast}
        />
      ) : null}

      {tab === 'calculator' ? (
        <ForexCalculatorSection
          leverage={settings.leverage}
          forcedLiquidationRatio={settings.forcedLiquidationRatio}
          defaultBalance={summary.equity > 0 ? summary.equity : summary.netCapital}
          onLeverageChange={(value) => {
            void updateSettings({ leverage: Math.max(1, Math.round(value || settings.leverage)) });
          }}
          onForcedLiquidationRatioChange={(value) => {
            void updateSettings({
              forcedLiquidationRatio: Math.min(1, Math.max(0.1, Number((value || settings.forcedLiquidationRatio).toFixed(2)))),
            });
          }}
        />
      ) : null}

      {tab === 'capital' ? (
        <ForexCapitalSection
          capitalFlows={capitalFlows}
          onChangeCapitalFlows={(updater) => {
            void handleCapitalFlowsChange(updater);
          }}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
