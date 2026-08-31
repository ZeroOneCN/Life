import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Grid } from '@arco-design/web-react';
const Row = Grid.Row;
const Col = Grid.Col;

import { ShoppingDashboardSection } from '../../components/finance/ShoppingDashboardSection';
import { ShoppingLedgersSection } from '../../components/finance/ShoppingLedgersSection';
import { ShoppingPlatformsSection } from '../../components/finance/ShoppingPlatformsSection';
import { ShoppingRecordsSection } from '../../components/finance/ShoppingRecordsSection';
import { PageHeader, StatGrid } from '../../components/page';
import { Btn, Modal, PillTabs, Toast, useToastState } from '../../components/ui';
import { useBreadcrumbTail } from '../../hooks/useBreadcrumbTail';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { createSyncCollection } from '../../lib/collection';
import { importShoppingWorkbook } from '../../services/shopping';
import { shoppingApi } from '../../services/shoppingApi';
import type {
  ShoppingCurrencyMode,
  ShoppingImportResult,
  ShoppingLedger,
  ShoppingPageState,
  ShoppingPlatform,
  ShoppingRecord,
  ShoppingTab,
} from '../../types/shopping';

const TAB_OPTIONS: Array<{ value: ShoppingTab; label: string }> = [
  { value: 'records', label: '购物记录' },
  { value: 'dashboard', label: '统计看板' },
  { value: 'ledgers', label: '账本管理' },
  { value: 'platforms', label: '平台管理' },
];

const EMPTY_SETTINGS: ShoppingPageState['settings'] = {
  activeLedgerId: '',
  recordsLedgerId: '',
  dashboardLedgerId: '',
  currencyMode: 'CNY',
  usdtRate: 7.2,
};

export default forwardRef<{ openImportModal: () => void }, { hideHeader?: boolean }>(
  function ShoppingPage({ hideHeader = false }, ref) {
    useImperativeHandle(ref, () => ({
      openImportModal: () => setImportOpen(true),
    }));
    const [tab, setTab] = usePageTab<ShoppingTab>(
      'records',
      TAB_OPTIONS.map((item) => item.value),
      'shoppingTab',
    );
    const [records, setRecords] = useState<ShoppingRecord[]>([]);
    const [ledgers, setLedgers] = useState<ShoppingLedger[]>([]);
    const [platforms, setPlatforms] = useState<ShoppingPlatform[]>([]);
    const [settings, setSettings] = useState<ShoppingPageState['settings']>(EMPTY_SETTINGS);
    const [overview, setOverview] = useState({
      currentMonthOrders: 0,
      currentMonthAmount: 0,
      totalAmount: 0,
      totalOrders: 0,
      activePlatformCount: 0,
      trackedMonths: 0,
    });
    const [importOpen, setImportOpen] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<ShoppingImportResult | null>(null);
    const [formResetKey, setFormResetKey] = useState(0);
    /* 累计消费额的本地货币切换（仅作用于该统计项，不改变全局货币模式） */
    const [totalInUsdt, setTotalInUsdt] = useState(false);
    const [loading, setLoading] = useState(true);
    const { toast, showToast } = useToastState();
    const showToastRef = useRef(showToast);
    showToastRef.current = showToast;

    const reload = useCallback(async () => {
      const [recordsResponse, ledgersResponse, platformsResponse, nextOverview, nextSettings] =
        await Promise.all([
          shoppingApi.listRecords({ page: 1, page_size: 1000 }),
          shoppingApi.listLedgers(),
          shoppingApi.listPlatforms(),
          shoppingApi.getOverview(),
          shoppingApi.getSettings(),
        ]);

      setRecords(recordsResponse.items);
      setLedgers(ledgersResponse.items);
      setPlatforms(platformsResponse.items);
      setOverview(nextOverview);
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
        } catch (error) {
          if (!cancelled) {
            showToastRef.current(buildApiErrorMessage(error, '购物页加载失败。'), 'error');
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
    }, [reload]);

    const updateSettings = useCallback(
      async (patch: Partial<ShoppingPageState['settings']>) => {
        try {
          const next = await shoppingApi.updateSettings(patch);
          setSettings((current) => ({
            ...current,
            ...next,
          }));
          await reload();
        } catch (error) {
          showToast(buildApiErrorMessage(error, '购物设置保存失败。'), 'error');
        }
      },
      [reload, showToast],
    );

    const syncCollection = useMemo(
      () => createSyncCollection({ reload, showToast }),
      [reload, showToast],
    );

    const activeLedger = useMemo(
      () =>
        ledgers.find((ledger) => ledger.id === settings.activeLedgerId) ??
        ledgers.find((ledger) => ledger.isActive) ??
        ledgers[0] ??
        null,
      [ledgers, settings.activeLedgerId],
    );

    const handleImportFile = async (file: File) => {
      setImporting(true);
      try {
        const importLedgerId = settings.activeLedgerId || activeLedger?.id || '';
        const result = await importShoppingWorkbook(file, {
          activeLedgerId: importLedgerId,
          records,
          ledgers,
          platforms,
        });
        setImportResult(result);

        if (result.importedCount || result.createdLedgerCount || result.createdPlatformCount) {
          await Promise.all([
            ...result.nextLedgers
              .filter((item) => !ledgers.some((current) => current.id === item.id))
              .map((item) => shoppingApi.createLedger(item)),
            ...result.nextPlatforms
              .filter((item) => !platforms.some((current) => current.id === item.id))
              .map((item) => shoppingApi.createPlatform(item)),
            ...result.importedRecords.map((item) => shoppingApi.createRecord(item)),
          ]);
          await reload();
          setFormResetKey((k) => k + 1);
        }

        showToast(
          result.importedCount
            ? `导入完成，新增 ${result.importedCount} 条记录。`
            : '导入完成，但没有新增记录。',
        );
      } catch (error) {
        showToast(buildApiErrorMessage(error, '购物导入失败。'), 'error');
      } finally {
        setImporting(false);
      }
    };

    return (
      <div className="page-grid-wrapper">
        <Row gutter={[24, 20]}>
          <Col span={24}>
            {!hideHeader && (
              <PageHeader
                title="网上购物"
                subtitle="记录购物订单与消费，支持多账本多币种"
                actions={
                  <PillTabs
                    options={TAB_OPTIONS}
                    value={tab}
                    onChange={(value) => setTab(value as ShoppingTab)}
                  />
                }
              />
            )}
          </Col>

          <Col span={24}>
            <StatGrid
              items={[
                { label: '当前账本', value: activeLedger?.name ?? '未选择' },
                { label: '本月订单数', value: `${overview.currentMonthOrders}` },
                { label: '本月消费额', value: `¥${overview.currentMonthAmount.toFixed(2)}` },
                {
                  label: '累计消费额',
                  value: (
                    <span className="shopping-total-toggle">
                      <span>
                        {totalInUsdt
                          ? `$${(overview.totalAmount / (settings.usdtRate || 7)).toFixed(2)}`
                          : `¥${overview.totalAmount.toFixed(2)}`}
                      </span>
                      <button
                        type="button"
                        className="shopping-total-toggle-btn"
                        onClick={() => setTotalInUsdt((current) => !current)}
                        title={totalInUsdt ? '切换为人民币显示' : '切换为 USDT 显示'}
                      >
                        {totalInUsdt ? 'USDT' : 'CNY'}
                      </button>
                    </span>
                  ),
                },
              ]}
            />
          </Col>

          <Col span={24}>
            {tab === 'records' ? (
              <ShoppingRecordsSection
                key={formResetKey}
                activeLedgerId={settings.activeLedgerId}
                filterLedgerId={settings.recordsLedgerId}
                records={records}
                ledgers={ledgers}
                platforms={platforms}
                currencyMode={settings.currencyMode}
                usdtRate={settings.usdtRate}
                onImportExcel={() => setImportOpen(true)}
                onActiveLedgerIdChange={(value) => {
                  void updateSettings({ activeLedgerId: value });
                }}
                onCurrencyModeChange={(value) => {
                  void updateSettings({ currencyMode: value as ShoppingCurrencyMode });
                }}
                onFilterLedgerIdChange={(value) => {
                  void updateSettings({ recordsLedgerId: value });
                }}
                onChangeRecords={(updater) => {
                  const previous = records;
                  const next = updater(previous);
                  setRecords(next);
                  void syncCollection(
                    previous,
                    next,
                    (item) => shoppingApi.createRecord(item),
                    (item) => shoppingApi.updateRecord(item.id, item),
                    (id) => shoppingApi.deleteRecord(id),
                    '购物记录保存失败。',
                  );
                }}
                showToast={showToast}
              />
            ) : null}
          </Col>

          <Col span={24}>
            {tab === 'dashboard' ? (
              <ShoppingDashboardSection
                ledgerId={settings.dashboardLedgerId}
                records={records}
                ledgers={ledgers}
                platforms={platforms}
                currencyMode={settings.currencyMode}
                usdtRate={settings.usdtRate}
                onLedgerIdChange={(value) => {
                  void updateSettings({ dashboardLedgerId: value });
                }}
              />
            ) : null}
          </Col>

          <Col span={24}>
            {tab === 'ledgers' ? (
              <ShoppingLedgersSection
                activeLedgerId={settings.activeLedgerId}
                records={records}
                ledgers={ledgers}
                currencyMode={settings.currencyMode}
                usdtRate={settings.usdtRate}
                onActiveLedgerChange={(ledgerId) => {
                  void updateSettings({ activeLedgerId: ledgerId });
                }}
                onChangeLedgers={(updater) => {
                  const previous = ledgers;
                  const next = updater(previous);
                  setLedgers(next);
                  void syncCollection(
                    previous,
                    next,
                    (item) => shoppingApi.createLedger(item),
                    (item) => shoppingApi.updateLedger(item.id, item),
                    (id) => shoppingApi.deleteLedger(id),
                    '账本保存失败。',
                  );
                }}
                showToast={showToast}
              />
            ) : null}
          </Col>

          <Col span={24}>
            {tab === 'platforms' ? (
              <ShoppingPlatformsSection
                records={records}
                platforms={platforms}
                currencyMode={settings.currencyMode}
                usdtRate={settings.usdtRate}
                onChangePlatforms={(updater) => {
                  const previous = platforms;
                  const next = updater(previous);
                  setPlatforms(next);
                  void syncCollection(
                    previous,
                    next,
                    (item) => shoppingApi.createPlatform(item),
                    (item) => shoppingApi.updatePlatform(item.id, item),
                    (id) => shoppingApi.deletePlatform(id),
                    '平台保存失败。',
                  );
                }}
                showToast={showToast}
              />
            ) : null}
          </Col>
        </Row>

        <Modal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          title="导入购物记录"
          width={560}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              className={`shopping-import-dropzone ${importing ? 'importing' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.currentTarget.classList.add('drag-over');
              }}
              onDragLeave={(event) => {
                event.currentTarget.classList.remove('drag-over');
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.currentTarget.classList.remove('drag-over');
                const file = event.dataTransfer.files?.[0];
                if (file) {
                  void handleImportFile(file);
                }
              }}
            >
              <div className="shopping-import-dropzone-icon">📊</div>
              <div className="shopping-import-dropzone-text">
                <strong>拖拽 Excel/CSV 文件到此处</strong>
                <span>或点击下方按钮选择文件</span>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={importing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleImportFile(file);
                  }
                }}
                className="shopping-import-file-input"
              />
              <Btn
                tone={importing ? 'secondary' : 'primary'}
                disabled={importing}
                onClick={() => {
                  const fileInput = document.querySelector(
                    '.shopping-import-file-input',
                  ) as HTMLInputElement;
                  fileInput?.click();
                }}
              >
                {importing ? '导入中...' : '选择文件'}
              </Btn>
            </div>

            {importResult ? (
              <div
                className={`callout ${importResult.invalidCount > 0 ? 'callout-warning' : 'callout-success'}`}
              >
                <strong>导入完成</strong>
                <Row gutter={[12, 12]}>
                  <Col span={6}>
                    <span>总行数: {importResult.totalRows}</span>
                  </Col>
                  <Col span={6}>
                    <span className="text-success">成功: {importResult.importedCount}</span>
                  </Col>
                  <Col span={6}>
                    <span className="text-warning">重复: {importResult.duplicateCount}</span>
                  </Col>
                  {importResult.invalidCount > 0 ? (
                    <Col span={6}>
                      <span className="text-danger">无效: {importResult.invalidCount}</span>
                    </Col>
                  ) : null}
                </Row>
              </div>
            ) : null}

            {importing ? (
              <div className="shopping-import-progress">
                <div className="shopping-import-progress-bar" />
                <span>正在解析并导入数据，请稍候...</span>
              </div>
            ) : null}
          </div>
        </Modal>

        <Toast toast={toast} />
      </div>
    );
  },
);
