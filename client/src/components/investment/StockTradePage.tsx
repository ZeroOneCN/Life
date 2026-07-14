import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../page';
import { PillTabs, Toast, useToastState } from '../ui';
import { StockPlatformsSection } from './StockPlatformsSection';
import { StockTradesSection } from './StockTradesSection';
import { StockDashboardSection } from './StockDashboardSection';
import { StockImportExportSection } from './StockImportExportSection';
import {
  listStockPlatforms,
  createStockPlatform,
  updateStockPlatform,
  deleteStockPlatform,
  listStockTrades,
  createStockTrade,
  updateStockTrade,
  deleteStockTrade,
  closeStockTrade,
  reopenStockTrade,
  type StockMarketType,
} from '../../services/stockStorage';
import { buildDashboardSummary } from '../../services/stockCalc';
import {
  type StockPlatform,
  type StockPlatformDraft,
  type StockTrade,
  type StockTradeDraft,
  INVESTMENT_MARKET_CONFIG,
} from '../../types/investment';

type StockTab = 'dashboard' | 'platforms' | 'trades' | 'import';

interface StockTradePageProps {
  market: StockMarketType;
}

const TAB_OPTIONS: Array<{ value: StockTab; label: string }> = [
  { value: 'dashboard', label: '统计看板' },
  { value: 'platforms', label: '交易平台' },
  { value: 'trades', label: '交易记录' },
  { value: 'import', label: '批量导入' },
];

export function StockTradePage({ market }: StockTradePageProps) {
  const config = INVESTMENT_MARKET_CONFIG[market];
  const [tab, setTab] = useState<StockTab>('dashboard');
  const [platforms, setPlatforms] = useState<StockPlatform[]>([]);
  const [trades, setTrades] = useState<StockTrade[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const { toast, showToast } = useToastState();

  useEffect(() => {
    setPlatforms(listStockPlatforms(market));
    setTrades(listStockTrades(market));
  }, [market, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const summary = useMemo(() => buildDashboardSummary(trades), [trades]);

  const handleAddPlatform = (draft: StockPlatformDraft) => {
    createStockPlatform(market, draft);
    showToast('平台已添加');
    reload();
  };

  const handleUpdatePlatform = (id: string, draft: Partial<StockPlatformDraft>) => {
    updateStockPlatform(market, id, draft);
    showToast('平台已更新');
    reload();
  };

  const handleDeletePlatform = (id: string) => {
    deleteStockPlatform(market, id);
    showToast('平台已删除');
    reload();
  };

  const handleAddTrade = (draft: StockTradeDraft) => {
    createStockTrade(market, draft);
    showToast('交易已添加');
    reload();
  };

  const handleUpdateTrade = (id: string, draft: Partial<StockTradeDraft>) => {
    updateStockTrade(market, id, draft);
    showToast('交易已更新');
    reload();
  };

  const handleDeleteTrade = (id: string) => {
    deleteStockTrade(market, id);
    showToast('交易已删除');
    reload();
  };

  const handleCloseTrade = (id: string, closePrice: number, closeDate: string, closeTime: string) => {
    closeStockTrade(market, id, closePrice, closeDate, closeTime);
    showToast('交易已平仓');
    reload();
  };

  const handleReopenTrade = (id: string) => {
    reopenStockTrade(market, id);
    showToast('交易已重开');
    reload();
  };

  const handleImportTrades = (drafts: StockTradeDraft[]) => {
    drafts.forEach((draft) => {
      createStockTrade(market, draft);
    });
    showToast(`成功导入 ${drafts.length} 笔交易`);
    reload();
  };

  return (
    <div className="stock-trade-page" style={{
      '--stock-accent': config.accent,
      '--stock-up': config.upColor,
      '--stock-down': config.downColor,
    } as React.CSSProperties}>
      <PageHeader
        title={config.name}
        subtitle={`记录你的每一笔${config.shortName}交易，自动计算盈亏统计`}
      />

      <div className="stock-trade-meta">
        <span>共 {trades.length} 笔交易 · {platforms.length} 个平台</span>
      </div>

      <div className="stock-tab-bar">
        <PillTabs
          options={TAB_OPTIONS}
          value={tab}
          onChange={(value) => setTab(value as StockTab)}
        />
      </div>

      {tab === 'dashboard' && (
        <StockDashboardSection summary={summary} market={market} />
      )}

      {tab === 'platforms' && (
        <StockPlatformsSection
          platforms={platforms}
          onAdd={handleAddPlatform}
          onUpdate={handleUpdatePlatform}
          onDelete={handleDeletePlatform}
        />
      )}

      {tab === 'trades' && (
        <StockTradesSection
          trades={trades}
          platforms={platforms}
          market={market}
          onAdd={handleAddTrade}
          onUpdate={handleUpdateTrade}
          onDelete={handleDeleteTrade}
          onClose={handleCloseTrade}
          onReopen={handleReopenTrade}
        />
      )}

      {tab === 'import' && (
        <StockImportExportSection
          market={market}
          onImport={handleImportTrades}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}