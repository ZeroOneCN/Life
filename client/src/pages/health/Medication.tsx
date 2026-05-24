import { useEffect, useMemo } from 'react';
import dayjs from 'dayjs';

import { MedicationAnalysisSection } from '../../components/health/MedicationAnalysisSection';
import { MedicationPurchasesSection } from '../../components/health/MedicationPurchasesSection';
import { MedicationRecordsSection } from '../../components/health/MedicationRecordsSection';
import { MedicationSummarySection } from '../../components/health/MedicationSummarySection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, Field, PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  MEDICATION_REMINDER_META,
  buildInitialMedicationState,
  buildMedicationLowStockItems,
  buildMedicationOverview,
  normalizeMedicationPageState,
  normalizeMedicationUserId,
  saveMedicationDailySummary,
} from '../../services/medication';
import { enqueueSceneNotification, updateSceneConfig } from '../../services/notificationCenter';
import type { MedicationPageState, MedicationReminderTimeKey, MedicationTab } from '../../types/medication';

const STORAGE_KEY = 'lifeos_health_medication_page';

const TAB_OPTIONS: Array<{ value: MedicationTab; label: string }> = [
  { value: 'records', label: '每日用药' },
  { value: 'purchases', label: '购药记录' },
  { value: 'analysis', label: '分析看板' },
  { value: 'summary', label: '总结与提醒' },
];

export default function MedicationPage() {
  const [data, setData] = useLocalStorageState<MedicationPageState>(STORAGE_KEY, buildInitialMedicationState);
  const [tab, setTab] = usePageTab<MedicationTab>('records', TAB_OPTIONS.map((item) => item.value), 'medicationTab');
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeMedicationPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const overview = useMemo(
    () => buildMedicationOverview(
      normalizedData.records,
      normalizedData.purchases,
      normalizedData.settings.activeUserId,
    ),
    [normalizedData.records, normalizedData.purchases, normalizedData.settings.activeUserId],
  );

  const lowStockItems = useMemo(
    () => buildMedicationLowStockItems(
      normalizedData.records,
      normalizedData.purchases,
      normalizedData.settings.activeUserId,
      normalizedData.settings.defaultStockThreshold,
      normalizedData.settings.medicineThresholds,
    ),
    [
      normalizedData.records,
      normalizedData.purchases,
      normalizedData.settings.activeUserId,
      normalizedData.settings.defaultStockThreshold,
      normalizedData.settings.medicineThresholds,
    ],
  );

  const updateSettings = (patch: Partial<MedicationPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
  };

  const handleTriggerDoseReminder = (slot: MedicationReminderTimeKey) => {
    if (!normalizedData.settings.doseReminderEnabled) {
      showToast('服药提醒当前未启用，请先在总结与提醒页打开开关。', 'error');
      return;
    }

    const targetUserId = normalizeMedicationUserId(normalizedData.settings.summaryUserId)
      || normalizeMedicationUserId(normalizedData.settings.activeUserId)
      || '当前用户';

    const todayRecords = normalizedData.records.filter((record) => (
      normalizeMedicationUserId(record.userId) === targetUserId
      && record.date === dayjs().format('YYYY-MM-DD')
      && record[slot] > 0
    ));

    const results = enqueueSceneNotification('medication.dose_reminder', {
      message: todayRecords.length
        ? `${targetUserId} 在${MEDICATION_REMINDER_META[slot].label}时段共有 ${todayRecords.length} 条待服药记录，请按计划完成。`
        : `${targetUserId} 的${MEDICATION_REMINDER_META[slot].label}已触发，请确认是否按计划服药。`,
    });

    const success = results.some((item) => item.status === 'success');
    showToast(
      success
        ? `${MEDICATION_REMINDER_META[slot].label}已写入通知中心。`
        : `${MEDICATION_REMINDER_META[slot].label}未发送成功，请检查通知中心渠道状态。`,
      success ? 'success' : 'error',
    );
  };

  const handleTriggerStockReminder = () => {
    if (!normalizedData.settings.stockReminderEnabled) {
      showToast('低库存提醒当前未启用，请先在总结与提醒页打开开关。', 'error');
      return;
    }

    const targetUserId = normalizeMedicationUserId(normalizedData.settings.summaryUserId)
      || normalizeMedicationUserId(normalizedData.settings.activeUserId)
      || '当前用户';

    const stockItems = buildMedicationLowStockItems(
      normalizedData.records,
      normalizedData.purchases,
      targetUserId,
      normalizedData.settings.defaultStockThreshold,
      normalizedData.settings.medicineThresholds,
    );

    if (!stockItems.length) {
      showToast('当前没有进入低库存阈值的药品。');
      return;
    }

    const results = enqueueSceneNotification('medication.stock_low', {
      message: `${targetUserId} 共有 ${stockItems.length} 个药品进入低库存阈值：${stockItems.map((item) => item.medicineName).join('、')}。`,
    });

    const success = results.some((item) => item.status === 'success');
    showToast(
      success
        ? '低库存提醒已写入通知中心。'
        : '低库存提醒未发送成功，请检查通知中心渠道状态。',
      success ? 'success' : 'error',
    );
  };

  const handleSaveSummary = (date: string, content: string) => {
    const summaryUserId = normalizeMedicationUserId(normalizedData.settings.summaryUserId)
      || normalizeMedicationUserId(normalizedData.settings.activeUserId);

    if (!summaryUserId) {
      showToast('请先填写用于保存总结的用户 ID。', 'error');
      return;
    }

    setData((previous) => ({
      ...previous,
      summaries: saveMedicationDailySummary(previous.summaries, {
        userId: summaryUserId,
        date,
        content,
      }),
    }));

    showToast(content.trim() ? '每日总结已保存。' : '该日期的每日总结已清除。');
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="日常用药"
        subtitle="把旧版用药记录、购药、分析与设置原型收敛进当前 LifeOS 前端体系，统一管理每日服药、库存估算、总结和通知联动。"
        actions={(
          <>
            <Tag tone="blue">本地健康档案</Tag>
            <Btn tone="primary" onClick={() => setTab('summary')}>查看提醒</Btn>
          </>
        )}
      />

      <SectionCard
        title="当前用户与录入上下文"
        description="这里的当前用户会作为新增每日用药和购药记录的默认对象，并驱动顶部概览卡。"
        action={<Tag tone="green">通知中心联动</Tag>}
      >
        <div className="medication-filter-grid medication-filter-grid-header">
          <Field
            label="当前用户 ID"
            value={normalizedData.settings.activeUserId}
            onChange={(event) => updateSettings({ activeUserId: event.target.value })}
            placeholder="例如：user-001"
            hint="四个 tab 中的新建记录都会默认使用这个用户，也可以在各自视图里独立切换筛选用户。"
          />
        </div>
      </SectionCard>

      <StatGrid
        items={[
          {
            label: '当前用户',
            value: normalizeMedicationUserId(normalizedData.settings.activeUserId) || '-',
            helper: '顶部当前用户用于新增记录和总览统计',
          },
          {
            label: '累计用量',
            value: `${overview.totalDosage}`,
            helper: `覆盖 ${overview.trackedDays} 个记录日`,
          },
          {
            label: '活跃药品',
            value: `${overview.activeMedicineCount}`,
            helper: overview.latestRecordDate ? `最近记录：${overview.latestRecordDate}` : '暂无最近记录',
          },
          {
            label: '购药总额',
            value: `¥${overview.totalPurchaseAmount.toFixed(2)}`,
            helper: `共 ${overview.purchaseCount} 笔购药记录`,
          },
          {
            label: '低库存药品',
            value: `${lowStockItems.length}`,
            helper: lowStockItems.length
              ? lowStockItems.map((item) => item.medicineName).slice(0, 2).join('、')
              : '当前暂无低库存风险',
          },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="在每日用药、购药记录、分析看板和总结提醒之间切换。"
      >
        <PillTabs
          options={TAB_OPTIONS}
          value={tab}
          onChange={(value) => setTab(value as MedicationTab)}
        />
      </SectionCard>

      {tab === 'records' ? (
        <MedicationRecordsSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.recordsUserId}
          records={normalizedData.records}
          onFilterUserIdChange={(value) => updateSettings({ recordsUserId: value })}
          onChangeRecords={(updater) => {
            setData((previous) => ({
              ...previous,
              records: updater(previous.records),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'purchases' ? (
        <MedicationPurchasesSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.purchaseUserId}
          purchases={normalizedData.purchases}
          onFilterUserIdChange={(value) => updateSettings({ purchaseUserId: value })}
          onChangePurchases={(updater) => {
            setData((previous) => ({
              ...previous,
              purchases: updater(previous.purchases),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'analysis' ? (
        <MedicationAnalysisSection
          userId={normalizedData.settings.analysisUserId}
          records={normalizedData.records}
          purchases={normalizedData.purchases}
          onUserIdChange={(value) => updateSettings({ analysisUserId: value })}
        />
      ) : null}

      {tab === 'summary' ? (
        <MedicationSummarySection
          records={normalizedData.records}
          purchases={normalizedData.purchases}
          summaries={normalizedData.summaries}
          settings={normalizedData.settings}
          onSettingsChange={updateSettings}
          onSaveSummary={handleSaveSummary}
          onDoseReminderToggle={(checked) => {
            updateSettings({ doseReminderEnabled: checked });
            updateSceneConfig('medication.dose_reminder', { enabled: checked });
            showToast(`服药提醒已${checked ? '启用' : '停用'}。`);
          }}
          onStockReminderToggle={(checked) => {
            updateSettings({ stockReminderEnabled: checked });
            updateSceneConfig('medication.stock_low', { enabled: checked });
            showToast(`低库存提醒已${checked ? '启用' : '停用'}。`);
          }}
          onTriggerDoseReminder={handleTriggerDoseReminder}
          onTriggerStockReminder={handleTriggerStockReminder}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
