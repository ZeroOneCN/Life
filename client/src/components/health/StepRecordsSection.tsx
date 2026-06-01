import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DateTimePickerField } from '../date';
import { DeleteModal, Modal, Pagination, Btn, Field, SelectField, TableSkeleton } from '../ui';
import {
  STEP_HOURS,
  buildStepRecordTime,
  calculateStepDistanceKm,
  formatStepRecordTime,
  getStepHourLabel,
  inferStepHourFromRecordTime,
} from '../../services/stepRecords';
import { stepApi } from '../../services/stepApi';
import type { StepHour, StepRecord, StepRecordDraft, StepRecordSortField } from '../../types/health';
import { SectionCard } from '../page';

type SortDirection = 'asc' | 'desc';

interface StepRecordsSectionProps {
  reloadKey?: number;
  filterUserId: string;
  strideLength: number;
  onFilterUserIdChange: (value: string) => void;
  onUpdateRecord: (id: string, draft: StepRecordDraft) => void;
  onDeleteRecord: (id: string) => void;
  onDeleteRecords: (ids: string[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

function getSortIndicator(active: boolean, direction: SortDirection) {
  if (!active) {
    return '↕';
  }

  return direction === 'asc' ? '↑' : '↓';
}

const PAGE_SIZE = 10;

export function StepRecordsSection({
  reloadKey,
  filterUserId,
  strideLength,
  onFilterUserIdChange,
  onUpdateRecord,
  onDeleteRecord,
  onDeleteRecords,
  showToast,
}: StepRecordsSectionProps) {
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<StepRecordSortField>('recordTime');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingRecord, setEditingRecord] = useState<StepRecord | null>(null);
  const [editingUserId, setEditingUserId] = useState('');
  const [editingSteps, setEditingSteps] = useState('');
  const [editingHour, setEditingHour] = useState<StepHour>(null);
  const [editingRecordTime, setEditingRecordTime] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // 后端分页数据
  const [records, setRecords] = useState<StepRecord[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(true);

  /**
   * 从后端分页加载记录，替代前端全量加载。
   */
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await stepApi.listRecords({
        page,
        page_size: PAGE_SIZE,
        userId: filterUserId || undefined,
      });
      setRecords(response.items);
      setTotalRecords(response.total);
    } catch {
      setRecords([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [page, filterUserId, reloadKey]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  // 筛选条件变化时重置页码
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [filterUserId]);

  // 当删除导致当前页超出范围时，回退到最后一页
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalRecords, page]);

  // 前端排序（仅对当前页数据排序，后端已按 recordTime DESC 排序）
  const sortedRecords = useMemo(() => {
    if (sortField === 'recordTime' && sortDirection === 'desc') {
      // 默认排序，无需额外处理
      return records;
    }

    const nextRecords = [...records];

    nextRecords.sort((left, right) => {
      if (sortField === 'steps') {
        return sortDirection === 'asc' ? left.steps - right.steps : right.steps - left.steps;
      }

      if (sortField === 'hour') {
        const leftHour = left.hour === null ? 24 : left.hour;
        const rightHour = right.hour === null ? 24 : right.hour;
        return sortDirection === 'asc' ? leftHour - rightHour : rightHour - leftHour;
      }

      const leftTime = new Date(left.recordTime).getTime();
      const rightTime = new Date(right.recordTime).getTime();
      return sortDirection === 'asc' ? leftTime - rightTime : rightTime - leftTime;
    });

    return nextRecords;
  }, [records, sortDirection, sortField]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const allPageSelected = sortedRecords.length > 0 && sortedRecords.every((record) => selectedIds.includes(record.id));

  const toggleSort = (field: StepRecordSortField) => {
    if (sortField === field) {
      setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection(field === 'recordTime' ? 'desc' : 'asc');
  };

  const openEditModal = (record: StepRecord) => {
    setEditingRecord(record);
    setEditingUserId(record.userId);
    setEditingSteps(String(record.steps));
    setEditingHour(record.hour);
    setEditingRecordTime(record.recordTime);
  };

  const closeEditModal = () => {
    setEditingRecord(null);
    setEditingUserId('');
    setEditingSteps('');
    setEditingHour(null);
    setEditingRecordTime('');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const steps = Number(editingSteps);

    if (!editingUserId.trim()) {
      showToast('请输入用户 ID。', 'error');
      return;
    }

    if (!Number.isFinite(steps) || steps <= 0) {
      showToast('请输入有效的步数。', 'error');
      return;
    }

    if (!dayjs(editingRecordTime).isValid()) {
      showToast('请选择有效的记录时间。', 'error');
      return;
    }

    onUpdateRecord(editingRecord.id, {
      userId: editingUserId,
      steps,
      hour: editingHour,
      recordTime: editingRecordTime,
    });
    closeEditModal();
    showToast('记录已更新。');
  };

  return (
    <SectionCard title="记录管理" description="支持按用户筛选、排序、分页、编辑和批量删除。">
      <div className="page-stack">
        <div className="step-filter-grid">
          <Field
            label="记录用户 ID"
            placeholder="留空查看全部用户"
            value={filterUserId}
            onChange={(event) => onFilterUserIdChange(event.target.value)}
            hint="用于筛选当前列表，留空时会显示全部用户记录。"
          />
        </div>

        <div className="step-records-toolbar">
          <div className="step-records-selection">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelectedIds((previous) => [...new Set([...previous, ...sortedRecords.map((record) => record.id)])]);
                    return;
                  }

                  setSelectedIds((previous) => previous.filter((id) => !sortedRecords.some((record) => record.id === id)));
                }}
              />
              <span>全选当前页</span>
            </label>
            <Btn
              tone="danger"
              disabled={!selectedIds.length || batchDeleting}
              onClick={() => setShowBatchDeleteModal(true)}
            >
              {batchDeleting ? '删除中...' : '批量删除'}
            </Btn>
          </div>
          <span className="subtle-text">
            共 {totalRecords} 条记录
            {filterUserId.trim() ? `（用户 ${filterUserId.trim()}）` : '（全部用户）'}
            {selectedIds.length ? `，已选择 ${selectedIds.length} 条` : ''}
          </span>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : sortedRecords.length ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 54 }}>选择</th>
                    <th>用户 ID</th>
                    <th>
                      <button type="button" className="step-sort-button" onClick={() => toggleSort('steps')}>
                        步数
                        <span>{getSortIndicator(sortField === 'steps', sortDirection)}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="step-sort-button" onClick={() => toggleSort('hour')}>
                        时间段
                        <span>{getSortIndicator(sortField === 'hour', sortDirection)}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="step-sort-button" onClick={() => toggleSort('recordTime')}>
                        记录时间
                        <span>{getSortIndicator(sortField === 'recordTime', sortDirection)}</span>
                      </button>
                    </th>
                    <th>距离</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <input
                          className="step-record-checkbox"
                          type="checkbox"
                          checked={selectedIds.includes(record.id)}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setSelectedIds((previous) => [...new Set([...previous, record.id])]);
                              return;
                            }

                            setSelectedIds((previous) => previous.filter((item) => item !== record.id));
                          }}
                        />
                      </td>
                      <td>{record.userId}</td>
                      <td>{record.steps.toLocaleString()}</td>
                      <td>{getStepHourLabel(record.hour)}</td>
                      <td>{formatStepRecordTime(record.recordTime)}</td>
                      <td>{calculateStepDistanceKm(record.steps, strideLength)} 公里</td>
                      <td>
                        <div className="step-record-actions">
                          <Btn tone="secondary" onClick={() => openEditModal(record)}>编辑</Btn>
                          <Btn tone="danger" onClick={() => setPendingDeleteId(record.id)}>删除</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <div className="empty-state">
            <strong>还没有步数记录</strong>
            <span>{filterUserId.trim() ? '这个用户当前还没有记录。' : '先在上方录入一条记录，这里会自动展示可管理的列表。'}</span>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={closeEditModal}
        width={760}
        title="编辑步数记录"
        footer={(
          <>
            <Btn tone="secondary" onClick={closeEditModal}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="page-stack">
          <Field
            label="用户 ID"
            value={editingUserId}
            onChange={(event) => setEditingUserId(event.target.value)}
          />

          <Field
            label="步数"
            type="number"
            min="1"
            value={editingSteps}
            onChange={(event) => setEditingSteps(event.target.value)}
          />

          <DateTimePickerField
            label="记录时间"
            value={editingRecordTime}
            clearable={false}
            popoverStrategy="inline"
            onChange={(nextValue) => {
              setEditingRecordTime(nextValue);
              setEditingHour(inferStepHourFromRecordTime(nextValue));
            }}
            hint="如果改成 23:59，会自动识别为全天记录。"
          />

          <SelectField
            label="时间段"
            value={editingHour ?? ''}
            onChange={(event) => {
              const nextHour = event.target.value ? Number(event.target.value) as Exclude<StepHour, null> : null;
              setEditingHour(nextHour);

              if (!editingRecordTime) {
                return;
              }

              setEditingRecordTime(buildStepRecordTime(editingRecordTime, nextHour, nextHour === null ? 59 : 0));
            }}
          >
            <option value="">全天</option>
            {STEP_HOURS.map((hour) => (
              <option key={hour} value={hour}>{getStepHourLabel(hour)}</option>
            ))}
          </SelectField>
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }

          onDeleteRecord(pendingDeleteId);
          setPendingDeleteId(null);
          setSelectedIds((previous) => previous.filter((id) => id !== pendingDeleteId));
          showToast('记录已删除。');
        }}
        title="确认删除这条步数记录？"
      >
        删除后，趋势统计和记录列表会立即同步刷新。
      </DeleteModal>

      <DeleteModal
        open={showBatchDeleteModal}
        onClose={() => setShowBatchDeleteModal(false)}
        onConfirm={() => {
          const idsToDelete = [...selectedIds];
          setBatchDeleting(true);
          setShowBatchDeleteModal(false);
          onDeleteRecords(idsToDelete);
          setSelectedIds([]);
          setBatchDeleting(false);
          showToast(`已删除 ${idsToDelete.length} 条记录。`);
        }}
        title={`确认批量删除 ${selectedIds.length} 条记录？`}
      >
        这个操作不可恢复，删除后聚合统计和图表会立即更新。
      </DeleteModal>
    </SectionCard>
  );
}
