import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';

import { PageHeader } from '../../components/page';
import { DeleteModal, Modal, PillTabs, Toast, useToastState } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { vitalApi } from '../../services/vitalApi';
import { sleepApi } from '../../services/sleepApi';
import { VitalEntrySection } from '../../components/health/vital/VitalEntrySection';
import { VitalOverviewSection } from '../../components/health/vital/VitalOverviewSection';
import { VitalTrendSection } from '../../components/health/vital/VitalTrendSection';
import { VitalRecordsSection } from '../../components/health/vital/VitalRecordsSection';
import { SleepEntrySection } from '../../components/health/sleep/SleepEntrySection';
import { SleepOverviewSection } from '../../components/health/sleep/SleepOverviewSection';
import { SleepTrendSection } from '../../components/health/sleep/SleepTrendSection';
import { SleepRecordsSection } from '../../components/health/sleep/SleepRecordsSection';
import type { VitalMetricInfo, VitalMetricKey, VitalRecord, VitalTrend, VitalOverview } from '../../types/vital';
import type { SleepOverview, SleepRecord, SleepTrend } from '../../types/sleep';

type TabKey = 'vital' | 'sleep';

const TAB_OPTIONS = [
  { value: 'vital', label: '日常体征' },
  { value: 'sleep', label: '睡眠记录' },
] as const;

/**
 * 健康记录页面：日常体征 + 睡眠记录，通过 Tab 切换。
 *
 * 体征 Tab：心率、血压、血氧、血糖、体温等生命体征
 * 睡眠 Tab：睡眠时长、质量评分、趋势分析
 */
export default function VitalPage() {
  const { toast, showToast } = useToastState();
  const [activeTab, setActiveTab] = useState<TabKey>('vital');

  // ===== 体征状态 =====
  const [metrics, setMetrics] = useState<VitalMetricInfo[]>([]);
  const [vitalOverview, setVitalOverview] = useState<VitalOverview | null>(null);
  const [vitalTrend, setVitalTrend] = useState<VitalTrend | null>(null);
  const [vitalOverviewLoading, setVitalOverviewLoading] = useState(true);
  const [vitalTrendLoading, setVitalTrendLoading] = useState(true);
  const [vitalEntryLoading, setVitalEntryLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<VitalMetricKey>('heart_rate');
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [vitalRecords, setVitalRecords] = useState<VitalRecord[]>([]);
  const [vitalRecordsTotal, setVitalRecordsTotal] = useState(0);
  const [vitalRecordsLoading, setVitalRecordsLoading] = useState(false);
  const [filterMetric, setFilterMetric] = useState<VitalMetricKey | 'all'>('all');
  const [vitalPage, setVitalPage] = useState(1);
  const vitalPageSize = 20;

  // ===== 睡眠状态 =====
  const [sleepOverview, setSleepOverview] = useState<SleepOverview | null>(null);
  const [sleepTrend, setSleepTrend] = useState<SleepTrend | null>(null);
  const [sleepOverviewLoading, setSleepOverviewLoading] = useState(true);
  const [sleepTrendLoading, setSleepTrendLoading] = useState(true);
  const [sleepEntryLoading, setSleepEntryLoading] = useState(false);
  const [sleepPeriod, setSleepPeriod] = useState<'week' | 'month' | 'year'>('week');
  const [sleepRecords, setSleepRecords] = useState<SleepRecord[]>([]);
  const [sleepRecordsTotal, setSleepRecordsTotal] = useState(0);
  const [sleepRecordsLoading, setSleepRecordsLoading] = useState(false);
  const [sleepPage, setSleepPage] = useState(1);
  const sleepPageSize = 20;

  // ===== 通用弹窗状态 =====
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingVitalRecord, setDeletingVitalRecord] = useState<VitalRecord | null>(null);
  const [deletingSleepRecord, setDeletingSleepRecord] = useState<SleepRecord | null>(null);

  const [editVitalOpen, setEditVitalOpen] = useState(false);
  const [editingVitalRecord, setEditingVitalRecord] = useState<VitalRecord | null>(null);
  const [editVitalValue, setEditVitalValue] = useState('');
  const [editVitalNotes, setEditVitalNotes] = useState('');
  const [editVitalRecordTime, setEditVitalRecordTime] = useState('');
  const [editVitalSaving, setEditVitalSaving] = useState(false);

  const [editSleepOpen, setEditSleepOpen] = useState(false);
  const [editingSleepRecord, setEditingSleepRecord] = useState<SleepRecord | null>(null);
  const [editSleepBedtime, setEditSleepBedtime] = useState('');
  const [editSleepWakeTime, setEditSleepWakeTime] = useState('');
  const [editSleepQuality, setEditSleepQuality] = useState<number | null>(null);
  const [editSleepIsNap, setEditSleepIsNap] = useState(false);
  const [editSleepNotes, setEditSleepNotes] = useState('');
  const [editSleepSaving, setEditSleepSaving] = useState(false);

  // ===== 体征数据加载 =====
  useEffect(() => {
    void vitalApi.getMetrics().then(setMetrics).catch((error) => {
      showToast(buildApiErrorMessage(error, '体征指标加载失败。'), 'error');
    });
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    setVitalOverviewLoading(true);
    void vitalApi.getOverview().then((data) => {
      if (!cancelled) setVitalOverview(data);
    }).catch((error) => {
      if (!cancelled) showToast(buildApiErrorMessage(error, '体征概览加载失败。'), 'error');
    }).finally(() => {
      if (!cancelled) setVitalOverviewLoading(false);
    });
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    setVitalTrendLoading(true);
    void vitalApi.getTrend(selectedMetric, trendPeriod).then((data) => {
      if (!cancelled) setVitalTrend(data);
    }).catch((error) => {
      if (!cancelled) showToast(buildApiErrorMessage(error, '趋势数据加载失败。'), 'error');
    }).finally(() => {
      if (!cancelled) setVitalTrendLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedMetric, trendPeriod, showToast]);

  useEffect(() => {
    let cancelled = false;
    setVitalRecordsLoading(true);
    void vitalApi.listRecords({
      metric: filterMetric === 'all' ? undefined : filterMetric,
      page: vitalPage,
      pageSize: vitalPageSize,
    }).then((data) => {
      if (!cancelled) {
        setVitalRecords(data.items);
        setVitalRecordsTotal(data.total);
      }
    }).catch((error) => {
      if (!cancelled) showToast(buildApiErrorMessage(error, '体征记录加载失败。'), 'error');
    }).finally(() => {
      if (!cancelled) setVitalRecordsLoading(false);
    });
    return () => { cancelled = true; };
  }, [filterMetric, vitalPage, showToast]);

  // ===== 睡眠数据加载 =====
  useEffect(() => {
    if (activeTab !== 'sleep') return;
    let cancelled = false;
    setSleepOverviewLoading(true);
    void sleepApi.getOverview().then((data) => {
      if (!cancelled) setSleepOverview(data);
    }).catch((error) => {
      if (!cancelled) showToast(buildApiErrorMessage(error, '睡眠概览加载失败。'), 'error');
    }).finally(() => {
      if (!cancelled) setSleepOverviewLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, showToast]);

  useEffect(() => {
    if (activeTab !== 'sleep') return;
    let cancelled = false;
    setSleepTrendLoading(true);
    void sleepApi.getTrend(sleepPeriod).then((data) => {
      if (!cancelled) setSleepTrend(data);
    }).catch((error) => {
      if (!cancelled) showToast(buildApiErrorMessage(error, '睡眠趋势加载失败。'), 'error');
    }).finally(() => {
      if (!cancelled) setSleepTrendLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, sleepPeriod, showToast]);

  useEffect(() => {
    if (activeTab !== 'sleep') return;
    let cancelled = false;
    setSleepRecordsLoading(true);
    void sleepApi.listRecords({
      page: sleepPage,
      pageSize: sleepPageSize,
    }).then((data) => {
      if (!cancelled) {
        setSleepRecords(data.items);
        setSleepRecordsTotal(data.total);
      }
    }).catch((error) => {
      if (!cancelled) showToast(buildApiErrorMessage(error, '睡眠记录加载失败。'), 'error');
    }).finally(() => {
      if (!cancelled) setSleepRecordsLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, sleepPage, showToast]);

  // ===== 体征操作 =====
  const refreshVital = useCallback(() => {
    void vitalApi.getOverview().then(setVitalOverview).catch(() => {});
    void vitalApi.getTrend(selectedMetric, trendPeriod).then(setVitalTrend).catch(() => {});
    void vitalApi.listRecords({
      metric: filterMetric === 'all' ? undefined : filterMetric,
      page: vitalPage,
      pageSize: vitalPageSize,
    }).then((data) => {
      setVitalRecords(data.items);
      setVitalRecordsTotal(data.total);
    }).catch(() => {});
  }, [selectedMetric, trendPeriod, filterMetric, vitalPage]);

  const handleVitalSubmit = useCallback(async (payload: {
    metric: VitalMetricKey;
    value: number;
    recordTime: string;
    notes: string;
  }) => {
    setVitalEntryLoading(true);
    try {
      await vitalApi.createRecord(payload);
      showToast('体征记录已保存。');
      refreshVital();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '体征记录保存失败。'), 'error');
    } finally {
      setVitalEntryLoading(false);
    }
  }, [refreshVital, showToast]);

  const handleVitalEdit = useCallback((record: VitalRecord) => {
    setEditingVitalRecord(record);
    setEditVitalValue(String(record.value));
    setEditVitalNotes(record.notes);
    setEditVitalRecordTime(dayjs(record.recordTime).format('YYYY-MM-DDTHH:mm'));
    setEditVitalOpen(true);
  }, []);

  const handleVitalSaveEdit = useCallback(async () => {
    if (!editingVitalRecord) return;
    setEditVitalSaving(true);
    try {
      await vitalApi.updateRecord(editingVitalRecord.id, {
        value: Number(editVitalValue),
        notes: editVitalNotes,
        recordTime: dayjs(editVitalRecordTime).format('YYYY-MM-DD HH:mm'),
      });
      showToast('记录已更新。');
      setEditVitalOpen(false);
      refreshVital();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '记录更新失败。'), 'error');
    } finally {
      setEditVitalSaving(false);
    }
  }, [editingVitalRecord, editVitalValue, editVitalNotes, editVitalRecordTime, refreshVital, showToast]);

  const handleVitalDelete = useCallback((record: VitalRecord) => {
    setDeletingVitalRecord(record);
    setDeleteOpen(true);
  }, []);

  const handleVitalFilterChange = useCallback((metric: VitalMetricKey | 'all') => {
    setFilterMetric(metric);
    setVitalPage(1);
  }, []);

  const handleVitalTrendMetricChange = useCallback((metric: VitalMetricKey) => {
    setSelectedMetric(metric);
  }, []);

  const handleVitalTrendPeriodChange = useCallback((period: 'week' | 'month' | 'year') => {
    setTrendPeriod(period);
  }, []);

  // ===== 睡眠操作 =====
  const refreshSleep = useCallback(() => {
    void sleepApi.getOverview().then(setSleepOverview).catch(() => {});
    void sleepApi.getTrend(sleepPeriod).then(setSleepTrend).catch(() => {});
    void sleepApi.listRecords({
      page: sleepPage,
      pageSize: sleepPageSize,
    }).then((data) => {
      setSleepRecords(data.items);
      setSleepRecordsTotal(data.total);
    }).catch(() => {});
  }, [sleepPeriod, sleepPage]);

  const handleSleepSubmit = useCallback(async (payload: {
    date: string;
    bedtime: string;
    wakeTime: string;
    qualityScore: number | null;
    isNap: boolean;
    notes: string;
  }) => {
    setSleepEntryLoading(true);
    try {
      await sleepApi.createRecord(payload);
      showToast('睡眠记录已保存。');
      refreshSleep();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '睡眠记录保存失败。'), 'error');
    } finally {
      setSleepEntryLoading(false);
    }
  }, [refreshSleep, showToast]);

  const handleSleepEdit = useCallback((record: SleepRecord) => {
    setEditingSleepRecord(record);
    setEditSleepBedtime(dayjs(record.bedtime).format('YYYY-MM-DDTHH:mm'));
    setEditSleepWakeTime(dayjs(record.wakeTime).format('YYYY-MM-DDTHH:mm'));
    setEditSleepQuality(record.qualityScore);
    setEditSleepIsNap(record.isNap);
    setEditSleepNotes(record.notes);
    setEditSleepOpen(true);
  }, []);

  const handleSleepSaveEdit = useCallback(async () => {
    if (!editingSleepRecord) return;
    setEditSleepSaving(true);
    try {
      await sleepApi.updateRecord(editingSleepRecord.id, {
        bedtime: dayjs(editSleepBedtime).format('YYYY-MM-DD HH:mm'),
        wakeTime: dayjs(editSleepWakeTime).format('YYYY-MM-DD HH:mm'),
        qualityScore: editSleepQuality,
        isNap: editSleepIsNap,
        notes: editSleepNotes,
      });
      showToast('记录已更新。');
      setEditSleepOpen(false);
      refreshSleep();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '记录更新失败。'), 'error');
    } finally {
      setEditSleepSaving(false);
    }
  }, [editingSleepRecord, editSleepBedtime, editSleepWakeTime, editSleepQuality, editSleepIsNap, editSleepNotes, refreshSleep, showToast]);

  const handleSleepDelete = useCallback((record: SleepRecord) => {
    setDeletingSleepRecord(record);
    setDeleteOpen(true);
  }, []);

  const handleSleepPeriodChange = useCallback((period: 'week' | 'month' | 'year') => {
    setSleepPeriod(period);
  }, []);

  // ===== 删除确认（通用）=====
  const confirmDelete = useCallback(async () => {
    if (deletingVitalRecord) {
      try {
        await vitalApi.deleteRecord(deletingVitalRecord.id);
        showToast('记录已删除。');
        setDeleteOpen(false);
        setDeletingVitalRecord(null);
        refreshVital();
      } catch (error) {
        showToast(buildApiErrorMessage(error, '删除失败。'), 'error');
      }
    } else if (deletingSleepRecord) {
      try {
        await sleepApi.deleteRecord(deletingSleepRecord.id);
        showToast('记录已删除。');
        setDeleteOpen(false);
        setDeletingSleepRecord(null);
        refreshSleep();
      } catch (error) {
        showToast(buildApiErrorMessage(error, '删除失败。'), 'error');
      }
    }
  }, [deletingVitalRecord, deletingSleepRecord, refreshVital, refreshSleep, showToast]);

  const deleteTitle = deletingVitalRecord
    ? '删除体征记录'
    : deletingSleepRecord
      ? '删除睡眠记录'
      : '删除记录';

  const deleteMessage = deletingVitalRecord
    ? `确定删除 ${deletingVitalRecord.metricLabel}（${deletingVitalRecord.value} ${deletingVitalRecord.unit}）的记录吗？此操作不可恢复。`
    : deletingSleepRecord
      ? `确定删除 ${deletingSleepRecord.date} 的睡眠记录吗？此操作不可恢复。`
      : '确定删除这条记录吗？此操作不可恢复。';

  const QUALITY_OPTIONS = [
    { value: 1, label: '很差', emoji: '😫' },
    { value: 2, label: '较差', emoji: '😔' },
    { value: 3, label: '一般', emoji: '😐' },
    { value: 4, label: '较好', emoji: '😊' },
    { value: 5, label: '很好', emoji: '😴' },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="健康记录"
        subtitle="记录日常体征与睡眠情况，追踪健康趋势"
        actions={(
          <div style={{ width: 320 }}>
            <PillTabs
              options={TAB_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
              value={activeTab}
              onChange={(v) => setActiveTab(v as TabKey)}
            />
          </div>
        )}
      />

      {activeTab === 'vital' ? (
        <>
          <VitalEntrySection
            metrics={metrics}
            loading={vitalEntryLoading}
            onSubmit={handleVitalSubmit}
          />
          <VitalOverviewSection
            overview={vitalOverview}
            loading={vitalOverviewLoading}
          />
          <VitalTrendSection
            trend={vitalTrend}
            loading={vitalTrendLoading}
            metrics={metrics}
            selectedMetric={selectedMetric}
            period={trendPeriod}
            onMetricChange={handleVitalTrendMetricChange}
            onPeriodChange={handleVitalTrendPeriodChange}
          />
          <VitalRecordsSection
            records={vitalRecords}
            total={vitalRecordsTotal}
            loading={vitalRecordsLoading}
            metrics={metrics}
            filterMetric={filterMetric}
            page={vitalPage}
            pageSize={vitalPageSize}
            onFilterChange={handleVitalFilterChange}
            onPageChange={setVitalPage}
            onEdit={handleVitalEdit}
            onDelete={handleVitalDelete}
          />
        </>
      ) : (
        <>
          <SleepEntrySection
            loading={sleepEntryLoading}
            onSubmit={handleSleepSubmit}
          />
          <SleepOverviewSection
            overview={sleepOverview}
            loading={sleepOverviewLoading}
          />
          <SleepTrendSection
            trend={sleepTrend}
            loading={sleepTrendLoading}
            period={sleepPeriod}
            onPeriodChange={handleSleepPeriodChange}
          />
          <SleepRecordsSection
            records={sleepRecords}
            total={sleepRecordsTotal}
            loading={sleepRecordsLoading}
            page={sleepPage}
            pageSize={sleepPageSize}
            onPageChange={setSleepPage}
            onEdit={handleSleepEdit}
            onDelete={handleSleepDelete}
          />
        </>
      )}

      {/* 体征编辑弹窗 */}
      <Modal
        open={editVitalOpen}
        onClose={() => setEditVitalOpen(false)}
        title="编辑体征记录"
        width={460}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditVitalOpen(false)}>取消</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleVitalSaveEdit()}
              disabled={editVitalSaving}
            >
              {editVitalSaving ? '保存中…' : '保存'}
            </button>
          </>
        }
      >
        {editingVitalRecord ? (
          <div className="form-stack">
            <div className="form-field">
              <label>指标</label>
              <input type="text" value={editingVitalRecord.metricLabel} disabled className="form-input" />
            </div>
            <div className="form-field">
              <label>数值 ({editingVitalRecord.unit})</label>
              <input
                type="number"
                value={editVitalValue}
                onChange={(e) => setEditVitalValue(e.target.value)}
                step="0.1"
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label>记录时间</label>
              <input
                type="datetime-local"
                value={editVitalRecordTime}
                onChange={(e) => setEditVitalRecordTime(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label>备注</label>
              <input
                type="text"
                value={editVitalNotes}
                onChange={(e) => setEditVitalNotes(e.target.value)}
                placeholder="可选"
                className="form-input"
              />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 睡眠编辑弹窗 */}
      <Modal
        open={editSleepOpen}
        onClose={() => setEditSleepOpen(false)}
        title="编辑睡眠记录"
        width={460}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditSleepOpen(false)}>取消</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSleepSaveEdit()}
              disabled={editSleepSaving}
            >
              {editSleepSaving ? '保存中…' : '保存'}
            </button>
          </>
        }
      >
        {editingSleepRecord ? (
          <div className="form-stack">
            <div className="form-field">
              <label>日期</label>
              <input type="text" value={editingSleepRecord.date} disabled className="form-input" />
            </div>
            <div className="form-field">
              <label>类型</label>
              <div className="vital-entry-metric-tabs">
                <button
                  type="button"
                  className={`vital-entry-metric-tab ${!editSleepIsNap ? 'active' : ''}`}
                  onClick={() => setEditSleepIsNap(false)}
                >
                  夜间睡眠
                </button>
                <button
                  type="button"
                  className={`vital-entry-metric-tab ${editSleepIsNap ? 'active' : ''}`}
                  onClick={() => setEditSleepIsNap(true)}
                >
                  午睡
                </button>
              </div>
            </div>
            <div className="form-field">
              <label>就寝时间</label>
              <input
                type="datetime-local"
                value={editSleepBedtime}
                onChange={(e) => setEditSleepBedtime(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label>起床时间</label>
              <input
                type="datetime-local"
                value={editSleepWakeTime}
                onChange={(e) => setEditSleepWakeTime(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label>睡眠质量</label>
              <div className="vital-entry-metric-tabs">
                {QUALITY_OPTIONS.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    className={`vital-entry-metric-tab ${editSleepQuality === q.value ? 'active' : ''}`}
                    onClick={() => setEditSleepQuality(editSleepQuality === q.value ? null : q.value)}
                  >
                    {q.emoji} {q.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-field">
              <label>备注</label>
              <input
                type="text"
                value={editSleepNotes}
                onChange={(e) => setEditSleepNotes(e.target.value)}
                placeholder="可选"
                className="form-input"
              />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 删除确认（通用） */}
      <DeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        title={deleteTitle}
      >
        {deleteMessage}
      </DeleteModal>

      <Toast toast={toast} />
    </div>
  );
}
