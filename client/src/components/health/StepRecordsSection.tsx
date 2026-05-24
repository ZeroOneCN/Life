import { useEffect, useMemo, useState } from 'react';

import {
  STEP_HOURS,
  STEP_RECORD_PAGE_SIZE,
  buildStepRecordTime,
  calculateStepDistanceKm,
  findDuplicateStepRecord,
  formatStepRecordTime,
  getStepHourLabel,
  inferStepHourFromRecordTime,
} from '../../services/stepRecords';
import type { StepHour, StepRecord, StepRecordDraft, StepRecordSortField } from '../../types/health';
import { DeleteModal, Modal, Pagination, Btn } from '../ui';
import { SectionCard } from '../page';

type SortDirection = 'asc' | 'desc';

interface StepRecordsSectionProps {
  records: StepRecord[];
  strideLength: number;
  onUpdateRecord: (id: string, draft: StepRecordDraft) => void;
  onDeleteRecord: (id: string) => void;
  onDeleteRecords: (ids: string[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function StepRecordsSection({
  records,
  strideLength,
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
  const [editingSteps, setEditingSteps] = useState('');
  const [editingHour, setEditingHour] = useState<StepHour>(null);
  const [editingRecordTime, setEditingRecordTime] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  const sortedRecords = useMemo(() => {
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

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / STEP_RECORD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * STEP_RECORD_PAGE_SIZE;
    return sortedRecords.slice(startIndex, startIndex + STEP_RECORD_PAGE_SIZE);
  }, [page, sortedRecords]);

  useEffect(() => {
    setSelectedIds([]);
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages, records.length]);

  const allPageSelected = pageRecords.length > 0 && pageRecords.every((record) => selectedIds.includes(record.id));

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
    setEditingSteps(String(record.steps));
    setEditingHour(record.hour);
    setEditingRecordTime(record.recordTime);
  };

  const closeEditModal = () => {
    setEditingRecord(null);
    setEditingSteps('');
    setEditingHour(null);
    setEditingRecordTime('');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const steps = Number(editingSteps);

    if (!Number.isFinite(steps) || steps <= 0) {
      showToast('请输入有效的步数。', 'error');
      return;
    }

    const duplicate = findDuplicateStepRecord(records, {
      steps,
      hour: editingHour,
      recordTime: editingRecordTime,
    }, editingRecord.id);

    if (duplicate) {
      showToast('该时间段已存在记录，请调整时间段后再保存。', 'error');
      return;
    }

    onUpdateRecord(editingRecord.id, {
      steps,
      hour: editingHour,
      recordTime: editingRecordTime,
    });
    closeEditModal();
    showToast('记录已更新。');
  };

  return (
    <SectionCard title="记录管理" description="支持排序、分页、编辑和批量删除。">
      <div className="page-stack">
        <div className="step-records-toolbar">
          <div className="step-records-selection">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={(event) => {
                  if (event.target.checked) {
                    setSelectedIds(pageRecords.map((record) => record.id));
                    return;
                  }

                  setSelectedIds([]);
                }}
              />
              <span>全选当前页</span>
            </label>
            <Btn
              tone="danger"
              disabled={!selectedIds.length}
              onClick={() => setShowBatchDeleteModal(true)}
            >
              批量删除
            </Btn>
          </div>
          <span className="subtle-text">
            共 {records.length} 条记录{selectedIds.length ? `，已选择 ${selectedIds.length} 条` : ''}
          </span>
        </div>

        {records.length ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 54 }}>选择</th>
                    <th>
                      <button type="button" className="step-sort-button" onClick={() => toggleSort('steps')}>
                        步数
                        <span>{sortField === 'steps' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="step-sort-button" onClick={() => toggleSort('hour')}>
                        时间段
                        <span>{sortField === 'hour' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                    <th>
                      <button type="button" className="step-sort-button" onClick={() => toggleSort('recordTime')}>
                        记录时间
                        <span>{sortField === 'recordTime' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                      </button>
                    </th>
                    <th>距离</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map((record) => (
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
            <span>先在上方录入一条记录，这里会自动显示管理列表。</span>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={closeEditModal}
        title="编辑步数记录"
        footer={(
          <>
            <Btn tone="secondary" onClick={closeEditModal}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="page-stack">
          <label className="field">
            <span className="field-label">步数</span>
            <input
              type="number"
              min="1"
              value={editingSteps}
              onChange={(event) => setEditingSteps(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">记录时间</span>
            <input
              type="datetime-local"
              value={editingRecordTime}
              onChange={(event) => {
                const nextValue = event.target.value;
                setEditingRecordTime(nextValue);
                setEditingHour(inferStepHourFromRecordTime(nextValue));
              }}
            />
          </label>

          <label className="field">
            <span className="field-label">时间段</span>
            <select
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
            </select>
          </label>
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
        删除后，趋势统计和记录列表会立即同步更新。
      </DeleteModal>

      <DeleteModal
        open={showBatchDeleteModal}
        onClose={() => setShowBatchDeleteModal(false)}
        onConfirm={() => {
          onDeleteRecords(selectedIds);
          setSelectedIds([]);
          setShowBatchDeleteModal(false);
          showToast(`已删除 ${selectedIds.length} 条记录。`);
        }}
        title={`确认批量删除 ${selectedIds.length} 条记录？`}
      >
        该操作不可恢复，删除后聚合统计和图表会立即更新。
      </DeleteModal>
    </SectionCard>
  );
}
