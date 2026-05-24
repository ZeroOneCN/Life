import { useEffect, useMemo, useState } from 'react';

import { ShoppingDashboardSection } from '../../components/finance/ShoppingDashboardSection';
import { ShoppingLedgersSection } from '../../components/finance/ShoppingLedgersSection';
import { ShoppingPlatformsSection } from '../../components/finance/ShoppingPlatformsSection';
import { ShoppingRecordsSection } from '../../components/finance/ShoppingRecordsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, Field, Modal, PillTabs, SelectField, Tag, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  buildInitialShoppingState,
  buildShoppingOverview,
  formatShoppingAmount,
  importShoppingWorkbook,
  normalizeShoppingPageState,
} from '../../services/shopping';
import type { ShoppingCurrencyMode, ShoppingImportResult, ShoppingPageState, ShoppingTab } from '../../types/shopping';

const STORAGE_KEY = 'lifeos_finance_shopping_page';

const TAB_OPTIONS: Array<{ value: ShoppingTab; label: string }> = [
  { value: 'records', label: '购物记录' },
  { value: 'dashboard', label: '统计看板' },
  { value: 'ledgers', label: '账本管理' },
  { value: 'platforms', label: '平台管理' },
];

interface SettingsDraft {
  currencyMode: ShoppingCurrencyMode;
  usdtRate: string;
}

function buildSettingsDraft(data: ShoppingPageState): SettingsDraft {
  return {
    currencyMode: data.settings.currencyMode,
    usdtRate: String(data.settings.usdtRate),
  };
}

export default function ShoppingPage() {
  const [data, setData] = useLocalStorageState<ShoppingPageState>(STORAGE_KEY, buildInitialShoppingState);
  const [tab, setTab] = usePageTab<ShoppingTab>('records', TAB_OPTIONS.map((item) => item.value), 'shoppingTab');
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ShoppingImportResult | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => buildSettingsDraft(buildInitialShoppingState()));
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeShoppingPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  useEffect(() => {
    const activeLedger = normalizedData.ledgers.find((ledger) => ledger.isActive) ?? normalizedData.ledgers[0];

    if (activeLedger && normalizedData.settings.activeLedgerId !== activeLedger.id) {
      setData((previous) => ({
        ...previous,
        settings: {
          ...previous.settings,
          activeLedgerId: activeLedger.id,
        },
      }));
    }
  }, [normalizedData.ledgers, normalizedData.settings.activeLedgerId, setData]);

  const activeOverview = useMemo(
    () => buildShoppingOverview(
      normalizedData.records,
      normalizedData.settings.activeUserId,
      normalizedData.settings.activeLedgerId,
    ),
    [normalizedData.records, normalizedData.settings.activeUserId, normalizedData.settings.activeLedgerId],
  );

  const activeLedger = normalizedData.ledgers.find((ledger) => ledger.id === normalizedData.settings.activeLedgerId);

  const updateSettings = (patch: Partial<ShoppingPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
  };

  const toggleCurrencyMode = () => {
    updateSettings({
      currencyMode: normalizedData.settings.currencyMode === 'CNY' ? 'USDT' : 'CNY',
    });
  };

  const handleOpenSettings = () => {
    setSettingsDraft(buildSettingsDraft(normalizedData));
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    const parsedRate = Number(settingsDraft.usdtRate);

    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      showToast('请填写有效的 USDT 汇率。', 'error');
      return;
    }

    updateSettings({
      currencyMode: settingsDraft.currencyMode,
      usdtRate: parsedRate,
    });
    setSettingsOpen(false);
    showToast('购物页设置已保存。');
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);

    try {
      const result = await importShoppingWorkbook(file, {
        activeUserId: normalizedData.settings.activeUserId,
        activeLedgerId: normalizedData.settings.activeLedgerId,
        records: normalizedData.records,
        ledgers: normalizedData.ledgers,
        platforms: normalizedData.platforms,
      });

      setImportResult(result);

      if (result.importedCount > 0 || result.createdLedgerCount > 0 || result.createdPlatformCount > 0) {
        setData((previous) => ({
          ...previous,
          records: result.nextRecords,
          ledgers: result.nextLedgers,
          platforms: result.nextPlatforms,
        }));
      }

      showToast(
        result.importedCount > 0
          ? `导入完成，新增 ${result.importedCount} 条记录。`
          : '导入完成，但没有新增记录，请检查重复项或无效行。',
        result.importedCount > 0 ? 'success' : 'error',
      );
    } catch (error) {
      showToast(`导入失败：${String(error)}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="网上购物"
        subtitle="把购物记录、平台、账本、导入和消费看板统一收进当前 LifeOS 前端体系，保持本地数据、自定义日期控件和主题风格一致。"
        actions={(
          <div className="inline-row">
            <Btn tone="secondary" onClick={() => setImportOpen(true)}>导入 Excel</Btn>
            <Btn tone="secondary" onClick={toggleCurrencyMode}>
              切换到 {normalizedData.settings.currencyMode === 'CNY' ? 'USDT' : '人民币'}
            </Btn>
            <Btn tone="primary" onClick={handleOpenSettings}>页面设置</Btn>
          </div>
        )}
      />

      <SectionCard
        title="当前上下文"
        description="这里决定新建购物记录默认归属的用户和账本，同时也作为顶部总览卡的统计口径。列表和看板仍可单独切换筛选条件。"
        action={<Tag tone="green">{normalizedData.settings.currencyMode === 'USDT' ? `1 USDT = ¥${normalizedData.settings.usdtRate.toFixed(2)}` : '人民币主视图'}</Tag>}
      >
        <div className="shopping-context-grid">
          <Field
            label="当前用户 ID"
            value={normalizedData.settings.activeUserId}
            onChange={(event) => updateSettings({
              activeUserId: event.target.value,
              recordsUserId: event.target.value,
              dashboardUserId: event.target.value,
            })}
            placeholder="例如：user-001"
          />
          <SelectField
            label="当前账本"
            value={normalizedData.settings.activeLedgerId}
            onChange={(event) => updateSettings({ activeLedgerId: event.target.value })}
          >
            {normalizedData.ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>{ledger.name}</option>
            ))}
          </SelectField>
        </div>
      </SectionCard>

      <StatGrid
        items={[
          {
            label: '当前用户',
            value: normalizedData.settings.activeUserId || '未设置',
            helper: '驱动新建购物记录默认用户',
          },
          {
            label: '当前账本',
            value: activeLedger?.name ?? '未选择账本',
            helper: activeLedger?.description || '驱动新建记录默认账本',
          },
          {
            label: '本月订单数',
            value: `${activeOverview.currentMonthOrders}`,
          },
          {
            label: '本月消费额',
            value: formatShoppingAmount(
              activeOverview.currentMonthAmount,
              normalizedData.settings.currencyMode,
              normalizedData.settings.usdtRate,
            ),
          },
          {
            label: '累计消费额',
            value: formatShoppingAmount(
              activeOverview.totalAmount,
              normalizedData.settings.currencyMode,
              normalizedData.settings.usdtRate,
            ),
            helper: `共 ${activeOverview.totalOrders} 笔订单`,
          },
          {
            label: '活跃平台数',
            value: `${activeOverview.activePlatformCount}`,
            helper: `覆盖 ${activeOverview.trackedMonths} 个记录月份`,
          },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="购物记录、统计看板、账本管理和平台管理共用一套本地数据模型与主题组件。"
      >
        <PillTabs
          options={TAB_OPTIONS}
          value={tab}
          onChange={(value) => setTab(value as ShoppingTab)}
        />
      </SectionCard>

      {tab === 'records' ? (
        <ShoppingRecordsSection
          activeUserId={normalizedData.settings.activeUserId}
          activeLedgerId={normalizedData.settings.activeLedgerId}
          filterUserId={normalizedData.settings.recordsUserId}
          filterLedgerId={normalizedData.settings.recordsLedgerId}
          records={normalizedData.records}
          ledgers={normalizedData.ledgers}
          platforms={normalizedData.platforms}
          currencyMode={normalizedData.settings.currencyMode}
          usdtRate={normalizedData.settings.usdtRate}
          onFilterUserIdChange={(value) => updateSettings({ recordsUserId: value })}
          onFilterLedgerIdChange={(value) => updateSettings({ recordsLedgerId: value })}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              records: updater(previous.records),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'dashboard' ? (
        <ShoppingDashboardSection
          userId={normalizedData.settings.dashboardUserId}
          ledgerId={normalizedData.settings.dashboardLedgerId}
          records={normalizedData.records}
          ledgers={normalizedData.ledgers}
          platforms={normalizedData.platforms}
          currencyMode={normalizedData.settings.currencyMode}
          usdtRate={normalizedData.settings.usdtRate}
          onUserIdChange={(value) => updateSettings({ dashboardUserId: value })}
          onLedgerIdChange={(value) => updateSettings({ dashboardLedgerId: value })}
        />
      ) : null}

      {tab === 'ledgers' ? (
        <ShoppingLedgersSection
          activeLedgerId={normalizedData.settings.activeLedgerId}
          records={normalizedData.records}
          ledgers={normalizedData.ledgers}
          currencyMode={normalizedData.settings.currencyMode}
          usdtRate={normalizedData.settings.usdtRate}
          onActiveLedgerChange={(ledgerId) => updateSettings({ activeLedgerId: ledgerId })}
          onChangeLedgers={(updater) => {
            setData((previous) => ({
              ...previous,
              ledgers: updater(previous.ledgers),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'platforms' ? (
        <ShoppingPlatformsSection
          records={normalizedData.records}
          platforms={normalizedData.platforms}
          currencyMode={normalizedData.settings.currencyMode}
          usdtRate={normalizedData.settings.usdtRate}
          onChangePlatforms={(updater) => {
            setData((previous) => ({
              ...previous,
              platforms: updater(previous.platforms),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      <Modal
        open={importOpen}
        onClose={() => {
          if (!importing) {
            setImportOpen(false);
          }
        }}
        title="导入 Excel 购物记录"
        width={760}
        footer={<Btn tone="secondary" onClick={() => setImportOpen(false)} disabled={importing}>关闭</Btn>}
      >
        <div className="page-stack">
          <div className="callout callout-info">
            支持列别名：用户ID、账本、日期、平台、商品名称、规格、价格、单价、订单号、备注。
            缺失用户或账本时，会回落到当前页面上下文；重复项会按去重规则自动跳过。
          </div>

          <label className="field">
            <span className="field-label">选择 Excel 文件</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImportFile(file);
                }
              }}
            />
          </label>

          {importing ? <span className="subtle-text">正在解析并写入本地记录，请稍候…</span> : null}

          {importResult ? (
            <div className="shopping-import-result">
              <div className="shopping-import-result-grid">
                <div className="stat-card">
                  <span className="stat-label">总行数</span>
                  <strong className="stat-value">{importResult.totalRows}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">成功导入</span>
                  <strong className="stat-value">{importResult.importedCount}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">重复跳过</span>
                  <strong className="stat-value">{importResult.duplicateCount}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">无效行</span>
                  <strong className="stat-value">{importResult.invalidCount}</strong>
                </div>
              </div>
              <div className="shopping-import-meta">
                <span className="subtle-text">自动新增账本 {importResult.createdLedgerCount} 个</span>
                <span className="subtle-text">自动新增平台 {importResult.createdPlatformCount} 个</span>
              </div>
              {importResult.invalidRows.length ? (
                <div className="shopping-import-errors">
                  <strong>无效行摘要</strong>
                  {importResult.invalidRows.slice(0, 5).map((item) => (
                    <span key={`${item.rowNumber}-${item.reason}`}>第 {item.rowNumber} 行：{item.reason}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="购物页设置"
        width={560}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setSettingsOpen(false)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveSettings}>保存设置</Btn>
          </>
        )}
      >
        <div className="page-stack">
          <SelectField
            label="金额展示模式"
            value={settingsDraft.currencyMode}
            onChange={(event) => setSettingsDraft((previous) => ({
              ...previous,
              currencyMode: event.target.value as ShoppingCurrencyMode,
            }))}
          >
            <option value="CNY">人民币</option>
            <option value="USDT">USDT</option>
          </SelectField>
          <Field
            label="USDT 汇率"
            type="number"
            min="0"
            step="0.01"
            value={settingsDraft.usdtRate}
            onChange={(event) => setSettingsDraft((previous) => ({ ...previous, usdtRate: event.target.value }))}
            hint="只影响购物页金额展示换算，不会改变底层本地存储币种。"
          />
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
