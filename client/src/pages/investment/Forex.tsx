import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ForexCalculatorSection } from '../../components/investment/ForexCalculatorSection';
import { ForexCapitalSection } from '../../components/investment/ForexCapitalSection';
import { ForexDashboardSection } from '../../components/investment/ForexDashboardSection';
import { ForexTradesSection } from '../../components/investment/ForexTradesSection';
import { DatePickerField } from '../../components/date';
import { ContextBar, PageHeader, SectionCard } from '../../components/page';
import { PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { findCreated, findDeletedIds, findUpdated } from '../../lib/collection';
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
  totalOvernightFee: 0,
  realizedNetPnl: 0,
  winRate: 0,
  profitLossRatio: 0,
  longCount: 0,
  shortCount: 0,
  instrumentCounts: {},
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

export default function ForexPage() {
  const [tab, setTab] = usePageTab<ForexTab>('dashboard', TAB_OPTIONS.map((item) => item.value), 'forexTab');
  useBreadcrumbTail(TAB_OPTIONS.find((item) => item.value === tab)?.label);
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
    if (reloading.current) return [];
    reloading.current = true;
    try {
      const [nextTrades, nextCapitalFlows, nextSummary, nextSettings] = await Promise.all([
        forexApi.listTrades({ page: 1, page_size: 5000 }),
        forexApi.listCapitalFlows({ page: 1, page_size: 5000 }),
        forexApi.getDashboardSummary(),
        forexApi.getSettings(),
      ]);

      if (!mounted.current) return nextTrades.items;
      setTrades(nextTrades.items);
      setCapitalFlows(nextCapitalFlows.items);
      setSummary(nextSummary);
      setSettings({
        ...EMPTY_SETTINGS,
        ...nextSettings,
      });
      return nextTrades.items;
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
      const updated = findUpdated(previous, next);

      const batchSize = 10;

      const executeBatch = async <T,>(items: T[], fn: (item: T) => Promise<unknown>) => {
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          await Promise.all(batch.map(fn));
        }
      };

      await executeBatch(created, (item) => forexApi.createTrade({
        tradeDate: item.tradeDate,
        positionId: item.positionId,
        instrument: item.instrument,
        orderType: item.orderType,
        openPrice: item.openPrice,
        lotSize: item.lotSize,
        commission: item.commission,
        closePrice: item.closePrice,
        pnl: item.pnl,
        overnightFee: item.overnightFee,
        openTime: item.openTime,
        closeTime: item.closeTime,
        holdTime: item.holdTime,
        remark: item.remark,
      }));

      await executeBatch(updated, (item) => forexApi.updateTrade(item.id, {
        tradeDate: item.tradeDate,
        positionId: item.positionId,
        instrument: item.instrument,
        orderType: item.orderType,
        openPrice: item.openPrice,
        lotSize: item.lotSize,
        commission: item.commission,
        closePrice: item.closePrice,
        pnl: item.pnl,
        overnightFee: item.overnightFee,
        openTime: item.openTime,
        closeTime: item.closeTime,
        holdTime: item.holdTime,
        remark: item.remark,
      }));

      await executeBatch(deletedIds, (id) => forexApi.deleteTrade(id));

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
      const updated = findUpdated(previous, next);

      await Promise.all([
        ...created.map((item) => forexApi.createCapitalFlow({
          flowDate: item.flowDate,
          flowType: item.flowType,
          amount: item.amount,
          remark: item.remark,
          isBonus: item.isBonus,
        })),
        ...updated.map((item) => forexApi.updateCapitalFlow(item.id, {
          flowDate: item.flowDate,
          flowType: item.flowType,
          amount: item.amount,
          remark: item.remark,
          isBonus: item.isBonus,
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
        subtitle={loading ? '正在加载交易数据...' : '交易与资金'}
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
        <ContextBar label="看板范围">
          <DatePickerField
            label="开始日期"
            value={settings.dashboardStartDate}
            onChange={(value) => {
              void updateSettings({ dashboardStartDate: value });
            }}
            placeholder="选择开始日期"
          />
          <DatePickerField
            label="结束日期"
            value={settings.dashboardEndDate}
            onChange={(value) => {
              void updateSettings({ dashboardEndDate: value });
            }}
            placeholder="选择结束日期"
          />
          <Tag tone="blue">{`${effectiveDashboardRange.startDate} 至 ${effectiveDashboardRange.endDate}`}</Tag>
        </ContextBar>
      ) : null}

      {tab === 'dashboard' ? (
        <ForexDashboardSection
          trades={trades}
          capitalFlows={capitalFlows}
          startDate={effectiveDashboardRange.startDate}
          endDate={effectiveDashboardRange.endDate}
          summary={frontendSummary}
        />
      ) : null}

      {tab === 'trades' ? (
        <ForexTradesSection
          trades={trades}
          capitalFlows={capitalFlows}
          onChangeTrades={(updater) => handleTradesChange(updater)}
          onImportApplied={handleImportApplied}
          onReload={reload}
          showToast={showToast}
        />
      ) : null}

      {tab === 'calculator' ? (
        <ForexCalculatorSection
          leverage={settings.leverage}
          forcedLiquidationRatio={settings.forcedLiquidationRatio}
          defaultBalance={summary.equity > 0 ? summary.equity : summary.netCapital}
          trades={trades}
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
