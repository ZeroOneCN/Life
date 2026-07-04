import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';

import { PageHeader } from '../../components/page';
import { DeleteModal, Modal, Toast, useToastState } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { vitalApi } from '../../services/vitalApi';
import { VitalEntrySection } from '../../components/health/vital/VitalEntrySection';
import { VitalOverviewSection } from '../../components/health/vital/VitalOverviewSection';
import { VitalTrendSection } from '../../components/health/vital/VitalTrendSection';
import { VitalRecordsSection } from '../../components/health/vital/VitalRecordsSection';
import type { VitalMetricInfo, VitalMetricKey, VitalRecord, VitalTrend, VitalOverview } from '../../types/vital';

/**
 * 日常体征页面：心率、血压、血氧、血糖、体温等生命体征记录与趋势分析。
 *
 * 包含 4 个 Section：
 * 1. 体征录入 — 快速录入各指标
 * 2. 体征概览 — 各指标最新值与异常统计
 * 3. 趋势分析 — 折线图 + 参考范围线
 * 4. 体征记录 — 历史记录列表（筛选 + 分页）
 */
export default function VitalPage() {
  const { toast, showToast } = useToastState();

  const [metrics, setMetrics] = useState<VitalMetricInfo[]>([]);
  const [overview, setOverview] = useState<VitalOverview | null>(null);
  const [trend, setTrend] = useState<VitalTrend | null>(null);

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [entryLoading, setEntryLoading] = useState(false);

  const [selectedMetric, setSelectedMetric] = useState<VitalMetricKey>('heart_rate');
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month' | 'year'>('week');

  const [records, setRecords] = useState<VitalRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [filterMetric, setFilterMetric] = useState<VitalMetricKey | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<VitalRecord | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VitalRecord | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editRecordTime, setEditRecordTime] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  /**
   * 加载指标列表（只加载一次）。
   */
  useEffect(() => {
    void vitalApi.getMetrics().then(setMetrics).catch((error) => {
      showToast(buildApiErrorMessage(error, '体征指标加载失败。'), 'error');
    });
  }, [showToast]);

  /**
   * 加载概览数据（仅页面初始化加载一次）。
   */
  useEffect(() => {
    let cancelled = false;
    setOverviewLoading(true);
    void vitalApi.getOverview().then((data) => {
      if (!cancelled) setOverview(data);
    }).catch((error) => {
      if (!cancelled) showToast(buildApiErrorMessage(error, '体征概览加载失败。'), 'error');
    }).finally(() => {
      if (!cancelled) setOverviewLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  /**
   * 加载趋势数据（指标/周期变化时重新加载）。
   */
  useEffect(() => {
    let cancelled = false;
    setTrendLoading(true);
    void vitalApi.getTrend(selectedMetric, trendPeriod).then((data) => {
      if (!cancelled) setTrend(data);
    }).catch((error) => {
      if (!cancelled) showToast(buildApiErrorMessage(error, '趋势数据加载失败。'), 'error');
    }).finally(() => {
      if (!cancelled) setTrendLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedMetric, trendPeriod, showToast]);

  /**
   * 加载记录列表（筛选条件/页码变化时重新加载）。
   */
  useEffect(() => {
    let cancelled = false;
    setRecordsLoading(true);
    void vitalApi.listRecords({
      metric: filterMetric === 'all' ? undefined : filterMetric,
      page,
      pageSize,
    }).then((data) => {
      if (!cancelled) {
        setRecords(data.items);
        setRecordsTotal(data.total);
      }
    }).catch((error) => {
      if (!cancelled) showToast(buildApiErrorMessage(error, '体征记录加载失败。'), 'error');
    }).finally(() => {
      if (!cancelled) setRecordsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [filterMetric, page, pageSize, showToast]);

  /**
   * 刷新所有数据（录入/编辑/删除后调用）。
   */
  const refreshAll = useCallback(() => {
    void vitalApi.getOverview().then(setOverview).catch(() => {});
    void vitalApi.getTrend(selectedMetric, trendPeriod).then(setTrend).catch(() => {});
    void vitalApi.listRecords({
      metric: filterMetric === 'all' ? undefined : filterMetric,
      page,
      pageSize,
    }).then((data) => {
      setRecords(data.items);
      setRecordsTotal(data.total);
    }).catch(() => {});
  }, [selectedMetric, trendPeriod, filterMetric, page, pageSize]);

  /**
   * 提交新体征记录。
   */
  const handleSubmitEntry = useCallback(async (payload: {
    metric: VitalMetricKey;
    value: number;
    recordTime: string;
    notes: string;
  }) => {
    setEntryLoading(true);
    try {
      await vitalApi.createRecord(payload);
      showToast('体征记录已保存。');
      refreshAll();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '体征记录保存失败。'), 'error');
    } finally {
      setEntryLoading(false);
    }
  }, [refreshAll, showToast]);

  /**
   * 打开编辑对话框。
   */
  const handleEdit = useCallback((record: VitalRecord) => {
    setEditingRecord(record);
    setEditValue(String(record.value));
    setEditNotes(record.notes);
    setEditRecordTime(dayjs(record.recordTime).format('YYYY-MM-DDTHH:mm'));
    setEditOpen(true);
  }, []);

  /**
   * 保存编辑。
   */
  const handleSaveEdit = useCallback(async () => {
    if (!editingRecord) return;
    setEditSaving(true);
    try {
      await vitalApi.updateRecord(editingRecord.id, {
        value: Number(editValue),
        notes: editNotes,
        recordTime: dayjs(editRecordTime).format('YYYY-MM-DD HH:mm'),
      });
      showToast('记录已更新。');
      setEditOpen(false);
      refreshAll();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '记录更新失败。'), 'error');
    } finally {
      setEditSaving(false);
    }
  }, [editingRecord, editValue, editNotes, editRecordTime, refreshAll, showToast]);

  /**
   * 打开删除确认。
   */
  const handleDelete = useCallback((record: VitalRecord) => {
    setDeletingRecord(record);
    setDeleteOpen(true);
  }, []);

  /**
   * 确认删除。
   */
  const confirmDelete = useCallback(async () => {
    if (!deletingRecord) return;
    try {
      await vitalApi.deleteRecord(deletingRecord.id);
      showToast('记录已删除。');
      setDeleteOpen(false);
      setDeletingRecord(null);
      refreshAll();
    } catch (error) {
      showToast(buildApiErrorMessage(error, '删除失败。'), 'error');
    }
  }, [deletingRecord, refreshAll, showToast]);

  /**
   * 切指标时重置页码。
   */
  const handleFilterChange = useCallback((metric: VitalMetricKey | 'all') => {
    setFilterMetric(metric);
    setPage(1);
  }, []);

  /**
   * 趋势指标切换。
   */
  const handleTrendMetricChange = useCallback((metric: VitalMetricKey) => {
    setSelectedMetric(metric);
  }, []);

  /**
   * 趋势周期切换。
   */
  const handleTrendPeriodChange = useCallback((period: 'week' | 'month' | 'year') => {
    setTrendPeriod(period);
  }, []);

  return (
    <div className="page-stack">
      <PageHeader
        title="日常体征"
        subtitle="记录心率、血压、血氧、血糖、体温等生命体征，追踪健康趋势"
      />

      <VitalEntrySection
        metrics={metrics}
        loading={entryLoading}
        onSubmit={handleSubmitEntry}
      />

      <VitalOverviewSection
        overview={overview}
        loading={overviewLoading}
      />

      <VitalTrendSection
        trend={trend}
        loading={trendLoading}
        metrics={metrics}
        selectedMetric={selectedMetric}
        period={trendPeriod}
        onMetricChange={handleTrendMetricChange}
        onPeriodChange={handleTrendPeriodChange}
      />

      <VitalRecordsSection
        records={records}
        total={recordsTotal}
        loading={recordsLoading}
        metrics={metrics}
        filterMetric={filterMetric}
        page={page}
        pageSize={pageSize}
        onFilterChange={handleFilterChange}
        onPageChange={setPage}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* 编辑弹窗 */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="编辑体征记录"
        width={460}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>取消</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSaveEdit()}
              disabled={editSaving}
            >
              {editSaving ? '保存中…' : '保存'}
            </button>
          </>
        }
      >
        {editingRecord ? (
          <div className="form-stack">
            <div className="form-field">
              <label>指标</label>
              <input type="text" value={editingRecord.metricLabel} disabled className="form-input" />
            </div>
            <div className="form-field">
              <label>
                数值 ({editingRecord.unit})
              </label>
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                step="0.1"
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label>记录时间</label>
              <input
                type="datetime-local"
                value={editRecordTime}
                onChange={(e) => setEditRecordTime(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-field">
              <label>备注</label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="可选"
                className="form-input"
              />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* 删除确认 */}
      <DeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        title="删除体征记录"
      >
        {deletingRecord
          ? `确定删除 ${deletingRecord.metricLabel}（${deletingRecord.value} ${deletingRecord.unit}）的记录吗？此操作不可恢复。`
          : '确定删除这条记录吗？此操作不可恢复。'}
      </DeleteModal>

      <Toast toast={toast} />
    </div>
  );
}
