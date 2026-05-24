import { useEffect, useMemo, useState } from 'react';

import { CheckupBatchEntrySection } from '../../components/health/CheckupBatchEntrySection';
import { CheckupInsightsSection } from '../../components/health/CheckupInsightsSection';
import { CheckupRecordsSection } from '../../components/health/CheckupRecordsSection';
import { CheckupTemplatesSection } from '../../components/health/CheckupTemplatesSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, Field, PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { usePageTab } from '../../hooks/usePageTab';
import {
  buildCheckupOverview,
  buildDueFollowUps,
  buildInitialCheckupState,
  createBatchCheckupRecords,
  createCheckupRecord,
  createCheckupTemplate,
  deleteCheckupRecord,
  deleteCheckupTemplate,
  materializeCheckupRecord,
  normalizeCheckupPageState,
  normalizeCheckupUserId,
  updateCheckupRecord,
  updateCheckupTemplate,
} from '../../services/checkup';
import { enqueueSceneNotification, updateSceneConfig } from '../../services/notificationCenter';
import type {
  CheckupPageState,
  CheckupRecord,
  CheckupRecordDraft,
  CheckupTab,
  CheckupTemplateItem,
} from '../../types/checkup';

const STORAGE_KEY = 'lifeos_health_checkup_page';

const TAB_OPTIONS: Array<{ value: CheckupTab; label: string }> = [
  { value: 'records', label: '指标记录' },
  { value: 'batch', label: '批量录入' },
  { value: 'templates', label: '模板中心' },
  { value: 'insights', label: '分析与提醒' },
];

export default function CheckupPage() {
  const [data, setData] = useLocalStorageState<CheckupPageState>(STORAGE_KEY, buildInitialCheckupState);
  const [tab, setTab] = usePageTab<CheckupTab>('records', TAB_OPTIONS.map((item) => item.value), 'checkupTab');
  const [preferredTemplateId, setPreferredTemplateId] = useState<string | null>(null);
  const { toast, showToast } = useToastState();
  const normalizedData = useMemo(() => normalizeCheckupPageState(data), [data]);

  useEffect(() => {
    const shouldSync = JSON.stringify(normalizedData) !== JSON.stringify(data);

    if (shouldSync) {
      setData(normalizedData);
    }
  }, [data, normalizedData, setData]);

  const overview = useMemo(
    () => buildCheckupOverview(
      normalizedData.records,
      normalizedData.settings.activeUserId,
      normalizedData.settings.followUpLeadDays,
    ),
    [normalizedData.records, normalizedData.settings.activeUserId, normalizedData.settings.followUpLeadDays],
  );

  const dueFollowUps = useMemo(
    () => buildDueFollowUps(
      normalizedData.records,
      normalizedData.settings.insightUserId,
      normalizedData.settings.followUpLeadDays,
    ),
    [normalizedData.records, normalizedData.settings.followUpLeadDays, normalizedData.settings.insightUserId],
  );

  useEffect(() => {
    if (!normalizedData.settings.reminderEnabled || !dueFollowUps.length) {
      return;
    }

    const pendingRecordIds = dueFollowUps
      .filter((item) => {
        const source = normalizedData.records.find((record) => record.id === item.id);
        return source && !source.lastFollowUpReminderAt;
      })
      .map((item) => item.id);

    if (!pendingRecordIds.length) {
      return;
    }

    enqueueSceneNotification('checkup.followup_reminder', {
      message: `体检中心发现 ${pendingRecordIds.length} 项已进入复查窗口，请尽快查看并安排复查。`,
    });

    const now = new Date().toISOString();
    setData((previous) => ({
      ...previous,
      records: previous.records.map((record) => (
        pendingRecordIds.includes(record.id)
          ? { ...record, lastFollowUpReminderAt: now }
          : record
      )),
    }));
  }, [dueFollowUps, normalizedData.records, normalizedData.settings.reminderEnabled, setData]);

  const updateSettings = (patch: Partial<CheckupPageState['settings']>) => {
    setData((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
      },
    }));
  };

  const applyAbnormalAlertIfNeeded = (records: CheckupRecord[]) => {
    if (!normalizedData.settings.abnormalAlertEnabled) {
      return records;
    }

    const abnormalRecords = records.filter((record) => record.status === 'abnormal' || record.status === 'attention');
    if (!abnormalRecords.length) {
      return records;
    }

    const now = new Date().toISOString();
    enqueueSceneNotification('checkup.abnormal_alert', {
      message: `体检中心新增或更新了 ${abnormalRecords.length} 条需关注指标，请前往指标记录查看详情。`,
    });

    return records.map((record) => (
      abnormalRecords.some((item) => item.id === record.id)
        ? { ...record, lastAbnormalAlertAt: now }
        : record
    ));
  };

  const handleCreateRecord = (draft: CheckupRecordDraft) => {
    let nextRecord = materializeCheckupRecord(draft);
    [nextRecord] = applyAbnormalAlertIfNeeded([nextRecord]);

    setData((previous) => ({
      ...previous,
      records: createCheckupRecord(previous.records, nextRecord),
    }));
  };

  const handleUpdateRecord = (id: string, draft: CheckupRecordDraft) => {
    const existingRecord = normalizedData.records.find((record) => record.id === id);
    if (!existingRecord) {
      return;
    }

    let nextRecord = materializeCheckupRecord(draft, existingRecord);
    [nextRecord] = applyAbnormalAlertIfNeeded([nextRecord]);

    setData((previous) => ({
      ...previous,
      records: updateCheckupRecord(previous.records, id, nextRecord),
    }));
  };

  const handleCreateBatch = (drafts: CheckupRecordDraft[]) => {
    const preparedRecords = applyAbnormalAlertIfNeeded(drafts.map((draft) => materializeCheckupRecord(draft)));

    setData((previous) => ({
      ...previous,
      records: createBatchCheckupRecords(previous.records, preparedRecords),
    }));
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="体检指标中心"
        subtitle="将旧版生化检查原型重构进当前 LifeOS 前端体系，统一管理指标记录、批量录入、模板复用、本地分析和通知联动。"
        actions={(
          <>
            <Tag tone="blue">前端本地档案</Tag>
            <Btn tone="primary" onClick={() => setTab('batch')}>去批量录入</Btn>
          </>
        )}
      />

      <SectionCard
        title="当前用户与录入上下文"
        description="这里的当前用户会作为新增记录的默认对象，也会驱动顶部总览统计。"
        action={<Tag tone="green">通知中心联动</Tag>}
      >
        <div className="checkup-filter-grid">
          <Field
            label="当前用户 ID"
            value={normalizedData.settings.activeUserId}
            onChange={(event) => updateSettings({ activeUserId: event.target.value })}
            placeholder="例如：user-001"
            hint="录入表单默认使用这个用户，也可在各视图里独立筛选其他用户。"
          />
        </div>
      </SectionCard>

      <StatGrid
        items={[
          {
            label: '当前用户',
            value: normalizeCheckupUserId(normalizedData.settings.activeUserId) || '-',
            helper: '顶部当前用户用于新增记录和总览卡片统计',
          },
          {
            label: '指标总数',
            value: `${overview.totalRecords}`,
            helper: `覆盖 ${overview.uniqueIndicatorCount} 个指标项目`,
          },
          {
            label: '异常 / 关注',
            value: `${overview.abnormalCount} / ${overview.attentionCount}`,
            helper: '异常与关注状态会参与分析和提醒判断',
          },
          {
            label: '待复查',
            value: `${overview.dueFollowUpCount}`,
            helper: overview.recentTestDate ? `最近检查：${overview.recentTestDate}` : '尚未录入检查日期',
          },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="在指标记录、批量录入、模板中心和分析提醒之间切换。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as CheckupTab)} />
      </SectionCard>

      {tab === 'records' ? (
        <CheckupRecordsSection
          activeUserId={normalizedData.settings.activeUserId}
          filterUserId={normalizedData.settings.recordsUserId}
          trendUserId={normalizedData.settings.trendUserId}
          records={normalizedData.records}
          onFilterUserIdChange={(value) => updateSettings({ recordsUserId: value })}
          onTrendUserIdChange={(value) => updateSettings({ trendUserId: value })}
          onCreateRecord={handleCreateRecord}
          onUpdateRecord={handleUpdateRecord}
          onDeleteRecord={(id) => {
            setData((previous) => ({
              ...previous,
              records: deleteCheckupRecord(previous.records, id),
            }));
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'batch' ? (
        <CheckupBatchEntrySection
          activeUserId={normalizedData.settings.activeUserId}
          templates={normalizedData.templates}
          preferredTemplateId={preferredTemplateId}
          onPreferredTemplateConsumed={() => setPreferredTemplateId(null)}
          onCreateBatch={handleCreateBatch}
          showToast={showToast}
        />
      ) : null}

      {tab === 'templates' ? (
        <CheckupTemplatesSection
          templates={normalizedData.templates}
          onCreateTemplate={(draft) => {
            setData((previous) => ({
              ...previous,
              templates: createCheckupTemplate(previous.templates, draft),
            }));
          }}
          onUpdateTemplate={(id, draft) => {
            setData((previous) => ({
              ...previous,
              templates: updateCheckupTemplate(previous.templates, id, draft),
            }));
          }}
          onDeleteTemplate={(id) => {
            setData((previous) => ({
              ...previous,
              templates: deleteCheckupTemplate(previous.templates, id),
            }));
          }}
          onUseTemplate={(id) => {
            setPreferredTemplateId(id);
            setTab('batch');
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'insights' ? (
        <CheckupInsightsSection
          records={normalizedData.records}
          settings={normalizedData.settings}
          onSettingsChange={updateSettings}
          onReminderToggle={(checked) => {
            updateSettings({ reminderEnabled: checked });
            updateSceneConfig('checkup.followup_reminder', { enabled: checked });
            showToast(`复查提醒已${checked ? '启用' : '停用'}。`);
          }}
          onAbnormalAlertToggle={(checked) => {
            updateSettings({ abnormalAlertEnabled: checked });
            updateSceneConfig('checkup.abnormal_alert', { enabled: checked });
            showToast(`异常指标提醒已${checked ? '启用' : '停用'}。`);
          }}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
