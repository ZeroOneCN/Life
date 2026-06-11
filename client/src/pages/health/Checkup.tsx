import { useCallback, useEffect, useRef, useState } from 'react';

import { CheckupBatchEntrySection } from '../../components/health/CheckupBatchEntrySection';
import { CheckupInsightsSection } from '../../components/health/CheckupInsightsSection';
import { CheckupRecordsSection } from '../../components/health/CheckupRecordsSection';
import { CheckupTemplatesSection } from '../../components/health/CheckupTemplatesSection';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, PillTabs, Tag, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { getAuthUserDisplayName, useAuthState } from '../../services/auth';
import { checkupApi } from '../../services/checkupApi';
import type {
  CheckupOverviewSummary,
  CheckupPageState,
  CheckupRecord,
  CheckupRecordDraft,
  CheckupTab,
  CheckupTemplate,
} from '../../types/checkup';

const TAB_OPTIONS: Array<{ value: CheckupTab; label: string }> = [
  { value: 'records', label: '指标记录' },
  { value: 'batch', label: '批量录入' },
  { value: 'templates', label: '模板中心' },
  { value: 'insights', label: '分析与提醒' },
];

const EMPTY_SETTINGS: CheckupPageState['settings'] = {
  reminderEnabled: true,
  abnormalAlertEnabled: true,
  followUpLeadDays: 7,
};

const EMPTY_OVERVIEW: CheckupOverviewSummary = {
  totalRecords: 0,
  abnormalCount: 0,
  attentionCount: 0,
  dueFollowUpCount: 0,
  uniqueIndicatorCount: 0,
  recentTestDate: null,
};

export default function CheckupPage() {
  const authState = useAuthState();
  const [tab, setTab] = usePageTab<CheckupTab>('records', TAB_OPTIONS.map((item) => item.value), 'checkupTab');
  const [records, setRecords] = useState<CheckupRecord[]>([]);
  const [templates, setTemplates] = useState<CheckupTemplate[]>([]);
  const [settings, setSettings] = useState<CheckupPageState['settings']>(EMPTY_SETTINGS);
  const [overview, setOverview] = useState<CheckupOverviewSummary>(EMPTY_OVERVIEW);
  const [preferredTemplateId, setPreferredTemplateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const reload = useCallback(async () => {
    const [nextRecords, nextTemplates, nextOverview, nextSettings] = await Promise.all([
      checkupApi.listRecords({ page: 1, page_size: 1000 }),
      checkupApi.listTemplates(),
      checkupApi.getOverview(),
      checkupApi.getSettings(),
    ]);

    setRecords(nextRecords.items);
    setTemplates(nextTemplates.items);
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
          showToastRef.current(buildApiErrorMessage(error, '体检页加载失败。'), 'error');
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

  const updateSettings = useCallback(async (patch: Partial<CheckupPageState['settings']>) => {
    try {
      const next = await checkupApi.updateSettings(patch);
      setSettings((current) => ({
        ...current,
        ...next,
      }));
      await reload();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '体检设置保存失败。'), 'error');
    }
  }, [reload, showToast]);

  const runWithReload = useCallback(async (action: () => Promise<void>, successMessage?: string) => {
    try {
      await action();
      await reload();
      if (successMessage) {
        showToast(successMessage);
      }
    } catch (error) {
      showToast(buildApiErrorMessage(error, '体检数据保存失败。'), 'error');
    }
  }, [reload, showToast]);

  return (
    <div className="page-stack">
      <PageHeader
        title="体检指标"
        subtitle={loading ? '正在加载体检数据...' : '统一管理体检指标记录、模板配置和复查提醒。'}
        actions={tab !== 'batch' ? (
          <Btn tone="secondary" onClick={() => setTab('batch')}>批量录入</Btn>
        ) : undefined}
      />

      <StatGrid
        items={[
          { label: '指标总数', value: `${overview.totalRecords}`, helper: '累计检查记录' },
          { label: '异常 / 关注', value: `${overview.abnormalCount} / ${overview.attentionCount}`, accent: overview.abnormalCount > 0 ? 'var(--color-warning)' : undefined, helper: overview.abnormalCount > 0 ? '需要关注' : '正常范围' },
          { label: '待复查', value: `${overview.dueFollowUpCount}`, accent: overview.dueFollowUpCount > 0 ? 'var(--color-danger)' : undefined, helper: overview.dueFollowUpCount > 0 ? '请安排复查' : '无需复查' },
          { label: '最近检查', value: overview.recentTestDate ?? '-', helper: '最近一次检查日期' },
        ]}
      />

      <SectionCard
        title="业务视图"
        description="指标记录、批量录入、模板和提醒都直接以数据库与通知中心为准。"
      >
        <PillTabs options={TAB_OPTIONS} value={tab} onChange={(value) => setTab(value as CheckupTab)} />
      </SectionCard>

      {tab === 'records' ? (
        <CheckupRecordsSection
          records={records}
          onCreateRecord={(draft) => {
            void runWithReload(() => checkupApi.createRecord(draft).then(() => undefined), '指标记录已新增。');
          }}
          onUpdateRecord={(id, draft) => {
            void runWithReload(() => checkupApi.updateRecord(id, draft).then(() => undefined), '指标记录已更新。');
          }}
          onDeleteRecord={(id) => {
            void runWithReload(() => checkupApi.deleteRecord(id).then(() => undefined), '指标记录已删除。');
          }}
          showToast={showToast}
        />
      ) : null}

      {tab === 'batch' ? (
        <CheckupBatchEntrySection
          templates={templates}
          preferredTemplateId={preferredTemplateId}
          onPreferredTemplateConsumed={() => setPreferredTemplateId(null)}
          onCreateBatch={(drafts: CheckupRecordDraft[]) => {
            void runWithReload(() => Promise.all(drafts.map((draft) => checkupApi.createRecord(draft))).then(() => undefined), `已批量保存 ${drafts.length} 条指标记录。`);
          }}
          onSaveSuccess={() => setTab('records')}
          showToast={showToast}
        />
      ) : null}

      {tab === 'templates' ? (
        <CheckupTemplatesSection
          templates={templates}
          onCreateTemplate={(draft) => {
            void runWithReload(() => checkupApi.createTemplate(draft).then(() => undefined), '模板已创建。');
          }}
          onUpdateTemplate={(id, draft) => {
            void runWithReload(() => checkupApi.updateTemplate(id, draft).then(() => undefined), '模板已更新。');
          }}
          onDeleteTemplate={(id) => {
            void runWithReload(() => checkupApi.deleteTemplate(id).then(() => undefined), '模板已删除。');
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
          records={records}
          settings={settings}
          onSettingsChange={(patch) => {
            void updateSettings(patch);
          }}
          onReminderToggle={(checked) => {
            void updateSettings({ reminderEnabled: checked });
          }}
          onAbnormalAlertToggle={(checked) => {
            void updateSettings({ abnormalAlertEnabled: checked });
          }}
        />
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
