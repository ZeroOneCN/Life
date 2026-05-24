import { useEffect, useMemo } from 'react';

import { ForexCalculatorSection } from '../../components/investment/ForexCalculatorSection';
import { ForexCapitalSection } from '../../components/investment/ForexCapitalSection';
import { ForexDashboardSection } from '../../components/investment/ForexDashboardSection';
import { ForexTradesSection } from '../../components/investment/ForexTradesSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { PillTabs, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  FOREX_STORAGE_KEY,
  buildForexDashboardSummary,
  buildInitialForexState,
  formatForexAmount,
  formatForexMoney,
  formatForexPercent,
  normalizeForexPageState,
} from '../../services/forex';
import type { ForexPageState, ForexTab } from '../../types/forex';

const TAB_OPTIONS: Array<{ value: ForexTab; label: string }> = [
  { value: 'dashboard', label: '统计看板' },
  { value: 'trades', label: '交易记录' },
  { value: 'calculator', label: '交易计算' },
  { value: 'capital', label: '出入金' },
];

export default function ForexPage() {
  const [data, setData] = useLocalStorageState<ForexPageState>(FOREX_STORAGE_KEY, buildInitialForexState);
  const [tab, setTab] = usePageTab<ForexTab>('dashboard', TAB_OPTIONS.map((item) => item.value), 'forexTab');
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeForexPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const overview = useMemo(
    () => buildForexDashboardSummary(normalizedData.trades, normalizedData.capitalFlows),
    [normalizedData.capitalFlows, normalizedData.trades],
  );

  const updateSettings = (patch: Partial<ForexPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="外汇市场"
        subtitle="把旧原型里的交易、计算、出入金和分析能力统一收进当前 LifeOS 的本地投资工作台里，聚焦 XAUUSD 与 XAGUSD 的单账户复盘。"
      />

      <SectionCard
        title="账户总览"
        description="当前页面固定为单用户单账户模型，不暴露额外的账户切换。顶部概览会始终按全部本地记录计算。"
      >
        <StatGrid
          items={[
            { label: '总交易数', value: `${overview.tradeCount} 笔`, helper: `做多 ${overview.longCount} / 做空 ${overview.shortCount}` },
            { label: '总毛盈亏', value: formatForexAmount(overview.grossPnl), accent: overview.grossPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: '净收益', value: formatForexAmount(overview.realizedNetPnl), accent: overview.realizedNetPnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
            { label: '净入金', value: formatForexMoney(overview.netCapital) },
            { label: '当前净值', value: formatForexMoney(overview.equity), helper: `ROI ${formatForexPercent(overview.roi)}` },
            { label: '默认杠杆', value: `${normalizedData.settings.leverage} 倍`, helper: `强平比例 ${normalizedData.settings.forcedLiquidationRatio}` },
          ]}
        />
      </SectionCard>

      <PillTabs
        options={TAB_OPTIONS}
        value={tab}
        onChange={(value) => setTab(value as ForexTab)}
      />

      {tab === 'dashboard' ? (
        <ForexDashboardSection
          trades={normalizedData.trades}
          capitalFlows={normalizedData.capitalFlows}
          startDate={normalizedData.settings.dashboardStartDate}
          endDate={normalizedData.settings.dashboardEndDate}
          onStartDateChange={(value) => updateSettings({ dashboardStartDate: value })}
          onEndDateChange={(value) => updateSettings({ dashboardEndDate: value })}
        />
      ) : null}

      {tab === 'trades' ? (
        <ForexTradesSection
          trades={normalizedData.trades}
          onChangeTrades={(updater) => setData((previous) => ({
            ...previous,
            trades: updater(previous.trades),
          }))}
          showToast={showToast}
        />
      ) : null}

      {tab === 'calculator' ? (
        <ForexCalculatorSection
          leverage={normalizedData.settings.leverage}
          forcedLiquidationRatio={normalizedData.settings.forcedLiquidationRatio}
          defaultBalance={overview.equity > 0 ? overview.equity : overview.netCapital}
          onLeverageChange={(value) => updateSettings({ leverage: Math.max(1, Math.round(value || normalizedData.settings.leverage)) })}
          onForcedLiquidationRatioChange={(value) => updateSettings({
            forcedLiquidationRatio: Math.min(1, Math.max(0.1, Number((value || normalizedData.settings.forcedLiquidationRatio).toFixed(2)))),
          })}
        />
      ) : null}

      {tab === 'capital' ? (
        <ForexCapitalSection
          capitalFlows={normalizedData.capitalFlows}
          onChangeCapitalFlows={(updater) => setData((previous) => ({
            ...previous,
            capitalFlows: updater(previous.capitalFlows),
          }))}
          showToast={showToast}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
