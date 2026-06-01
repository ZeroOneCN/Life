import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ShoppingDashboardSection } from '../../components/finance/ShoppingDashboardSection';
import { ShoppingLedgersSection } from '../../components/finance/ShoppingLedgersSection';
import { ShoppingPlatformsSection } from '../../components/finance/ShoppingPlatformsSection';
import { ShoppingRecordsSection } from '../../components/finance/ShoppingRecordsSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, Modal, PillTabs, SelectField, Tag, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { getAuthUserDisplayName, useAuthState } from '../../services/auth';
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
  activeUserId: '',
  recordsUserId: '',
  dashboardUserId: '',
  activeLedgerId: '',
  recordsLedgerId: '',
  dashboardLedgerId: '',
  currencyMode: 'CNY',
  usdtRate: 7.2,
};

function findCreated<T extends { id: string }>(previous: T[], next: T[]) {
  return next.filter((item) => !previous.some((record) => record.id === item.id));
}

function findDeletedIds<T extends { id: string }>(previous: T[], next: T[]) {
  return previous.filter((item) => !next.some((record) => record.id === item.id)).map((item) => item.id);
}

export default function ShoppingPage() {
  const authState = useAuthState();
  const currentUserLabel = getAuthUserDisplayName(authState.session?.user, '当前登录用户');
  const [tab, setTab] = usePageTab<ShoppingTab>('records', TAB_OPTIONS.map((item) => item.value), 'shoppingTab');
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
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const reload = useCallback(async () => {
    const [recordsResponse, ledgersResponse, platformsResponse, nextOverview, nextSettings] = await Promise.all([
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

  const updateSettings = useCallback(async (patch: Partial<ShoppingPageState['settings']>) => {
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
  }, [reload, showToast]);

  const syncCollection = useCallback(async <T extends { id: string }>(
    previous: T[],
    next: T[],
    createItem: (item: T) => Promise<unknown>,
    updateItem: (item: T) => Promise<unknown>,
    deleteItem: (id: string) => Promise<unknown>,
    errorMessage: string,
  ) => {
    try {
      const created = findCreated(previous, next);
      const deletedIds = findDeletedIds(previous, next);
      const updated = next.filter((item) => previous.some((record) => record.id === item.id && JSON.stringify(record) !== JSON.stringify(item)));

      await Promise.all([
        ...created.map((item) => createItem(item)),
        ...updated.map((item) => updateItem(item)),
        ...deletedIds.map((id) => deleteItem(id)),
      ]);
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, errorMessage), 'error');
      await reload();
    }
  }, [reload, showToast]);

  const activeLedger = useMemo(
    () => ledgers.find((ledger) => ledger.id === settings.activeLedgerId) ?? ledgers.find((ledger) => ledger.isActive) ?? ledgers[0] ?? null,
    [ledgers, settings.activeLedgerId],
  );

  const handleImportFile = async (file: File) => {
    setImporting(true);
    try {
      const result = await importShoppingWorkbook(file, {
        activeUserId: settings.activeUserId,
        activeLedgerId: settings.activeLedgerId,
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
      }

      showToast(result.importedCount ? `导入完成，新增 ${result.importedCount} 条记录。` : '导入完成，但没有新增记录。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '购物导入失败。'), 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="网上购物"
        subtitle={loading ? '正在从后端加载购物记录、账本、平台和设置。' : '购物页已切到后端唯一数据源，页面刷新后数据直接回显数据库内容。'}
        actions={(
          <div className="inline-row">
            <Btn tone="secondary" onClick={() => setImportOpen(true)}>导入 Excel</Btn>
            <Btn
              tone="secondary"
              onClick={() => {
                const next = settings.currencyMode === 'CNY' ? 'USDT' : 'CNY';
                void updateSettings({ currencyMode: next as ShoppingCurrencyMode });
                showToast(`已切换到 ${next === 'CNY' ? '人民币' : 'USDT'} 视图`);
              }}
            >
              切换到 {settings.currencyMode === 'CNY' ? 'USDT' : '人民币'}
            </Btn>
          </div>
        )}
      />

      <SectionCard
        title="当前上下文"
        description="账本上下文与货币模式都以后端 settings 为准。"
        action={<Tag tone="green">{settings.currencyMode === 'USDT' ? `1 USDT = ¥${(settings.usdtRate ?? 7).toFixed(2)}` : '人民币主视图'}</Tag>}
      >
        <div className="shopping-context-grid">
          <SelectField
            label="当前账本"
            value={activeLedger?.id ?? ''}
            onChange={(event) => {
              void updateSettings({ activeLedgerId: event.target.value });
            }}
          >
            {ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>{ledger.name}</option>
            ))}
          </SelectField>
          <SelectField
            label="货币模式"
            value={settings.currencyMode}
            onChange={(event) => {
              void updateSettings({ currencyMode: event.target.value as ShoppingCurrencyMode });
            }}
          >
            <option value="CNY">人民币</option>
            <option value="USDT">USDT</option>
          </SelectField>
        </div>
      </SectionCard>

      <StatGrid
        items={[
          { label: '当前账本', value: activeLedger?.name ?? '未选择' },
          { label: '本月订单数', value: `${overview.currentMonthOrders}` },
          { label: '本月消费额', value: `¥${overview.currentMonthAmount.toFixed(2)}` },
          { label: '累计消费额', value: `¥${overview.totalAmount.toFixed(2)}` },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="购物记录、看板、账本和平台都直接基于后端返回工作。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as ShoppingTab)} />
      </SectionCard>

      {tab === 'records' ? (
        <ShoppingRecordsSection
          currentUserLabel={currentUserLabel}
          activeUserId={settings.activeUserId}
          activeLedgerId={settings.activeLedgerId}
          filterUserId={settings.recordsUserId}
          filterLedgerId={settings.recordsLedgerId}
          records={records}
          ledgers={ledgers}
          platforms={platforms}
          currencyMode={settings.currencyMode}
          usdtRate={settings.usdtRate}
          onFilterUserIdChange={(value) => {
            void updateSettings({ recordsUserId: value });
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

      {tab === 'dashboard' ? (
        <ShoppingDashboardSection
          userId={settings.dashboardUserId}
          ledgerId={settings.dashboardLedgerId}
          records={records}
          ledgers={ledgers}
          platforms={platforms}
          currencyMode={settings.currencyMode}
          usdtRate={settings.usdtRate}
          onUserIdChange={(value) => {
            void updateSettings({ dashboardUserId: value });
          }}
          onLedgerIdChange={(value) => {
            void updateSettings({ dashboardLedgerId: value });
          }}
        />
      ) : null}

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

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="导入购物记录"
        width={560}
      >
        <div className="page-stack">
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
                const fileInput = document.querySelector('.shopping-import-file-input') as HTMLInputElement;
                fileInput?.click();
              }}
            >
              {importing ? '导入中...' : '选择文件'}
            </Btn>
          </div>

          {importResult ? (
            <div className={`callout ${importResult.invalidCount > 0 ? 'callout-warning' : 'callout-success'}`}>
              <strong>导入完成</strong>
              <div className="shopping-import-result-grid">
                <span>总行数: {importResult.totalRows}</span>
                <span className="text-success">成功: {importResult.importedCount}</span>
                <span className="text-warning">重复: {importResult.duplicateCount}</span>
                {importResult.invalidCount > 0 ? (
                  <span className="text-danger">无效: {importResult.invalidCount}</span>
                ) : null}
              </div>
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
}
