import { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';

import { MedicationAnalysisSection } from '../../components/health/MedicationAnalysisSection';
import { MedicationPurchasesSection } from '../../components/health/MedicationPurchasesSection';
import { MedicationRecordsSection } from '../../components/health/MedicationRecordsSection';
import { MedicationSummarySection } from '../../components/health/MedicationSummarySection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { getAuthUserDisplayName, useAuthState } from '../../services/auth';
import { medicationApi } from '../../services/medicationApi';
import type {
  MedicationDailySummary,
  MedicationOverviewSummary,
  MedicationPageState,
  MedicationPurchaseRecord,
  MedicationRecord,
  MedicationReminderTimeKey,
  MedicationTab,
} from '../../types/medication';

const TAB_OPTIONS: Array<{ value: MedicationTab; label: string }> = [
  { value: 'records', label: '每日用药' },
  { value: 'purchases', label: '购药记录' },
  { value: 'analysis', label: '分析看板' },
  { value: 'summary', label: '总结与提醒' },
];

const EMPTY_SETTINGS: MedicationPageState['settings'] = {
  doseReminderEnabled: true,
  stockReminderEnabled: true,
  breakfastReminderTime: '08:00',
  lunchReminderTime: '12:00',
  dinnerReminderTime: '19:00',
  defaultStockThreshold: 3,
  medicineThresholds: {},
};

const EMPTY_OVERVIEW: MedicationOverviewSummary = {
  totalRecords: 0,
  totalDosage: 0,
  trackedDays: 0,
  avgDailyDosage: 0,
  activeMedicineCount: 0,
  purchaseCount: 0,
  totalPurchaseAmount: 0,
  latestRecordDate: null,
  todayDosage: 0,
};

function findCreated<T extends { id: string }>(previous: T[], next: T[]) {
  return next.filter((item) => !previous.some((record) => record.id === item.id));
}

function findDeletedIds<T extends { id: string }>(previous: T[], next: T[]) {
  return previous.filter((item) => !next.some((record) => record.id === item.id)).map((item) => item.id);
}

export default function MedicationPage() {
  const authState = useAuthState();
  const [tab, setTab] = usePageTab<MedicationTab>('records', TAB_OPTIONS.map((item) => item.value), 'medicationTab');
  const [records, setRecords] = useState<MedicationRecord[]>([]);
  const [purchases, setPurchases] = useState<MedicationPurchaseRecord[]>([]);
  const [summaries, setSummaries] = useState<MedicationDailySummary[]>([]);
  const [settings, setSettings] = useState<MedicationPageState['settings']>(EMPTY_SETTINGS);
  const [overview, setOverview] = useState<MedicationOverviewSummary>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const reload = useCallback(async () => {
    const [nextRecords, nextPurchases, nextSummaries, nextOverview, nextSettings] = await Promise.all([
      medicationApi.listRecords({ page: 1, page_size: 1000 }),
      medicationApi.listPurchases({ page: 1, page_size: 1000 }),
      medicationApi.listSummaries(),
      medicationApi.getOverview(),
      medicationApi.getSettings(),
    ]);

    const normalizeDate = (d: string) => (dayjs(d).isValid() ? dayjs(d).format('YYYY-MM-DD') : d);

    setRecords(nextRecords.items.map((r) => ({ ...r, date: normalizeDate(r.date) })));
    setPurchases(nextPurchases.items.map((p) => ({ ...p, purchaseDate: normalizeDate(p.purchaseDate) })));
    setSummaries(nextSummaries.items.map((s) => ({ ...s, date: normalizeDate(s.date) })));
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
          showToastRef.current(buildApiErrorMessage(error, '用药页加载失败。'), 'error');
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

  const updateSettings = useCallback(async (patch: Partial<MedicationPageState['settings']>) => {
    try {
      if (patch.medicineThresholds) {
        const currentThresholds = await medicationApi.listThresholds();
        const existingMap = new Map(currentThresholds.items.map((item) => [item.medicineName, item]));
        const nextThresholds = patch.medicineThresholds;

        await Promise.all([
          ...currentThresholds.items
            .filter((item) => !(item.medicineName in nextThresholds))
            .map((item) => medicationApi.deleteThreshold(item.id)),
          ...Object.entries(nextThresholds).map(([medicineName, threshold]) => {
            const existing = existingMap.get(medicineName);
            if (!existing) {
              return medicationApi.createThreshold({ medicineName, threshold });
            }
            if (existing.threshold !== threshold) {
              return medicationApi.updateThreshold(existing.id, { medicineName, threshold });
            }
            return Promise.resolve();
          }),
        ]);
      }

      const next = await medicationApi.updateSettings({
        ...patch,
        medicineThresholds: undefined,
      });
      setSettings((current) => ({
        ...current,
        ...next,
        medicineThresholds: patch.medicineThresholds ?? current.medicineThresholds,
      }));
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '用药设置保存失败。'), 'error');
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

  const handleSaveSummary = useCallback(async (date: string, content: string) => {
    try {
      const existing = summaries.find((item) => item.date === date);

      if (!content.trim()) {
        if (existing) {
          await medicationApi.deleteSummary(existing.id);
        }
      } else if (existing) {
        await medicationApi.updateSummary(existing.id, { date, content });
      } else {
        await medicationApi.createSummary({
          date,
          content,
        });
      }

      await reload();
      showToast(content.trim() ? '每日总结已保存。' : '该日期的每日总结已清除。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '每日总结保存失败。'), 'error');
    }
  }, [reload, showToast, summaries]);

  const triggerDoseReminder = useCallback(async (slot: MedicationReminderTimeKey) => {
    try {
      await medicationApi.triggerDoseReminder({
        title: `用药提醒：${slot}`,
      });
      showToast('用药提醒已交给通知中心处理。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '用药提醒触发失败。'), 'error');
    }
  }, [showToast]);

  const triggerStockReminder = useCallback(async () => {
    try {
      await medicationApi.triggerStockReminder();
      showToast('低库存提醒已交给通知中心处理。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '低库存提醒触发失败。'), 'error');
    }
  }, [showToast]);

  return (
    <div className="page-stack">
      <PageHeader
        title="日常用药"
        subtitle={loading ? '正在加载数据...' : '追踪用药记录、购药信息和服药提醒。'}
        actions={(
          <>
            <Tag tone="blue">通知中心联动</Tag>
            <Btn tone="secondary" onClick={() => setTab('summary')}>查看提醒</Btn>
          </>
        )}
      />

      <StatGrid
        items={[
          { label: '累计用量', value: `${overview.totalDosage}`, helper: `共 ${overview.trackedDays} 天追踪` },
          { label: '活跃药品', value: `${overview.activeMedicineCount}`, accent: overview.activeMedicineCount === 0 ? 'var(--color-warning)' : undefined, helper: overview.activeMedicineCount === 0 ? '尚未添加药品' : undefined },
          { label: '购药总额', value: `¥${overview.totalPurchaseAmount.toFixed(2)}`, helper: `${overview.purchaseCount} 次购药` },
          { label: '今日用量', value: `${overview.todayDosage}`, accent: overview.todayDosage > 0 ? 'var(--color-primary)' : undefined, helper: overview.todayDosage === 0 ? '今日暂无记录' : undefined },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="记录、购药、分析和提醒都直接基于后端响应工作。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as MedicationTab)} />
      </SectionCard>

      {tab === 'records' ? (
        <MedicationRecordsSection
          records={records}
          onChangeRecords={(updater) => {
            const previous = records;
            const next = updater(previous);
            setRecords(next);
            void syncCollection(
              previous,
              next,
              (item) => medicationApi.createRecord(item),
              (item) => medicationApi.updateRecord(item.id, item),
              (id) => medicationApi.deleteRecord(id),
              '用药记录保存失败。',
            );
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'purchases' ? (
        <MedicationPurchasesSection
          purchases={purchases}
          onChangePurchases={(updater) => {
            const previous = purchases;
            const next = updater(previous);
            setPurchases(next);
            void syncCollection(
              previous,
              next,
              (item) => medicationApi.createPurchase(item),
              (item) => medicationApi.updatePurchase(item.id, item),
              (id) => medicationApi.deletePurchase(id),
              '购药记录保存失败。',
            );
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'analysis' ? (
        <MedicationAnalysisSection
          records={records}
          purchases={purchases}
        />
      ) : null}

      {tab === 'summary' ? (
        <MedicationSummarySection
          records={records}
          purchases={purchases}
          summaries={summaries}
          settings={settings}
          onSettingsChange={(patch) => {
            void updateSettings(patch);
          }}
          onSaveSummary={(date, content) => {
            void handleSaveSummary(date, content);
          }}
          onDoseReminderToggle={(checked) => {
            void updateSettings({ doseReminderEnabled: checked });
          }}
          onStockReminderToggle={(checked) => {
            void updateSettings({ stockReminderEnabled: checked });
          }}
          onTriggerDoseReminder={(slot) => {
            void triggerDoseReminder(slot);
          }}
          onTriggerStockReminder={() => {
            void triggerStockReminder();
          }}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
