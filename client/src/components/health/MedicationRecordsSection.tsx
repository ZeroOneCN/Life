import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination } from '../ui';
import {
  MEDICATION_RECORD_PAGE_SIZE,
  createMedicationRecord,
  deleteMedicationRecord,
  filterMedicationRecordsByUserId,
  normalizeMedicationUserId,
  updateMedicationRecord,
} from '../../services/medication';
import type { MedicationRecord, MedicationRecordDraft } from '../../types/medication';

interface MedicationRecordsSectionProps {
  activeUserId: string;
  filterUserId: string;
  records: MedicationRecord[];
  onFilterUserIdChange: (value: string) => void;
  onChangeRecords: (updater: (records: MedicationRecord[]) => MedicationRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface MedicationRecordFormState {
  date: string;
  medicineName: string;
  breakfast: string;
  lunch: string;
  dinner: string;
}

function createDefaultFormState(): MedicationRecordFormState {
  return {
    date: dayjs().format('YYYY-MM-DD'),
    medicineName: '',
    breakfast: '0',
    lunch: '0',
    dinner: '0',
  };
}

function buildFormState(record: MedicationRecord): MedicationRecordFormState {
  return {
    date: record.date,
    medicineName: record.medicineName,
    breakfast: String(record.breakfast),
    lunch: String(record.lunch),
    dinner: String(record.dinner),
  };
}

function parseDraft(form: MedicationRecordFormState, userId: string): MedicationRecordDraft | null {
  const normalizedUserId = normalizeMedicationUserId(userId);
  const breakfast = Number(form.breakfast || 0);
  const lunch = Number(form.lunch || 0);
  const dinner = Number(form.dinner || 0);

  if (!normalizedUserId || !form.medicineName.trim() || !dayjs(form.date).isValid()) {
    return null;
  }

  if (![breakfast, lunch, dinner].every((value) => Number.isFinite(value) && value >= 0)) {
    return null;
  }

  if (breakfast + lunch + dinner <= 0) {
    return null;
  }

  return {
    userId: normalizedUserId,
    date: form.date,
    medicineName: form.medicineName.trim(),
    breakfast,
    lunch,
    dinner,
  };
}

export function MedicationRecordsSection({
  activeUserId,
  filterUserId,
  records,
  onFilterUserIdChange,
  onChangeRecords,
  showToast,
}: MedicationRecordsSectionProps) {
  const [form, setForm] = useState<MedicationRecordFormState>(createDefaultFormState);
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minTotal, setMinTotal] = useState('');
  const [maxTotal, setMaxTotal] = useState('');
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<MedicationRecord | null>(null);
  const [editingForm, setEditingForm] = useState<MedicationRecordFormState>(createDefaultFormState);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const minimum = minTotal ? Number(minTotal) : null;
    const maximum = maxTotal ? Number(maxTotal) : null;

    return filterMedicationRecordsByUserId(records, filterUserId)
      .filter((record) => (!startDate || record.date >= startDate))
      .filter((record) => (!endDate || record.date <= endDate))
      .filter((record) => {
        const total = record.breakfast + record.lunch + record.dinner;

        if (minimum !== null && total < minimum) {
          return false;
        }

        if (maximum !== null && total > maximum) {
          return false;
        }

        return true;
      })
      .filter((record) => (!normalizedKeyword || record.medicineName.toLowerCase().includes(normalizedKeyword)));
  }, [records, filterUserId, startDate, endDate, minTotal, maxTotal, keyword]);

  useEffect(() => {
    setPage(1);
  }, [filterUserId, startDate, endDate, minTotal, maxTotal, keyword]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / MEDICATION_RECORD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * MEDICATION_RECORD_PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + MEDICATION_RECORD_PAGE_SIZE);
  }, [filteredRecords, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const editingTotalDose = useMemo(() => (
    Number(editingForm.breakfast || 0) + Number(editingForm.lunch || 0) + Number(editingForm.dinner || 0)
  ), [editingForm.breakfast, editingForm.dinner, editingForm.lunch]);

  const columns = useMemo(() => [
    { key: 'date', title: '日期', dataIndex: 'date' as const },
    { key: 'userId', title: '用户 ID', dataIndex: 'userId' as const },
    { key: 'medicineName', title: '药品名称', dataIndex: 'medicineName' as const },
    { key: 'breakfast', title: '早餐', render: (_value: unknown, row: MedicationRecord) => `${row.breakfast}` },
    { key: 'lunch', title: '午餐', render: (_value: unknown, row: MedicationRecord) => `${row.lunch}` },
    { key: 'dinner', title: '晚餐', render: (_value: unknown, row: MedicationRecord) => `${row.dinner}` },
    {
      key: 'total',
      title: '总用量',
      render: (_value: unknown, row: MedicationRecord) => `${row.breakfast + row.lunch + row.dinner}`,
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: MedicationRecord) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingRecord(row);
              setEditingForm(buildFormState(row));
            }}
          >
            编辑
          </Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(row.id)}>删除</Btn>
        </div>
      ),
    },
  ], []);

  const handleCreate = () => {
    const draft = parseDraft(form, activeUserId);

    if (!draft) {
      showToast('请补全日期、药品名称，并至少填写一个大于 0 的时段用量。', 'error');
      return;
    }

    onChangeRecords((previous) => createMedicationRecord(previous, draft));
    setForm(createDefaultFormState());
    showToast('每日用药记录已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm, editingRecord.userId);
    if (!draft) {
      showToast('请补全要保存的每日用药记录。', 'error');
      return;
    }

    onChangeRecords((previous) => updateMedicationRecord(previous, editingRecord.id, draft));
    setEditingRecord(null);
    setEditingForm(createDefaultFormState());
    showToast('每日用药记录已更新。');
  };

  return (
    <SectionCard
      title="每日用药"
      description="按日期记录药品在早餐、午餐、晚餐的使用情况，并支持按用量和日期范围回看。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          当前默认录入用户为 <strong>{normalizeMedicationUserId(activeUserId) || '未设置'}</strong>，如果要切换新增对象，请先在页面顶部修改当前用户 ID。
        </div>

        <div className="medication-entry-grid">
          <DatePickerField
            label="日期"
            value={form.date}
            onChange={(value) => setForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
          />
          <Field
            label="药品名称"
            value={form.medicineName}
            onChange={(event) => setForm((previous) => ({ ...previous, medicineName: event.target.value }))}
            placeholder="例如：维生素 C"
          />
          <Field
            label="早餐用量"
            type="number"
            min="0"
            value={form.breakfast}
            onChange={(event) => setForm((previous) => ({ ...previous, breakfast: event.target.value }))}
          />
          <Field
            label="午餐用量"
            type="number"
            min="0"
            value={form.lunch}
            onChange={(event) => setForm((previous) => ({ ...previous, lunch: event.target.value }))}
          />
          <Field
            label="晚餐用量"
            type="number"
            min="0"
            value={form.dinner}
            onChange={(event) => setForm((previous) => ({ ...previous, dinner: event.target.value }))}
          />
          <div className="medication-inline-action">
            <span className="field-label">保存</span>
            <Btn tone="primary" onClick={handleCreate}>保存每日用药</Btn>
          </div>
        </div>

        <div className="medication-filter-grid">
          <Field
            label="记录用户 ID"
            value={filterUserId}
            onChange={(event) => onFilterUserIdChange(event.target.value)}
            placeholder="留空查看全部用户"
          />
          <Field
            label="药品名称"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索药品名称"
          />
          <DatePickerField label="开始日期" value={startDate} onChange={setStartDate} placeholder="不限" />
          <DatePickerField label="结束日期" value={endDate} onChange={setEndDate} placeholder="不限" />
          <Field
            label="最小总用量"
            type="number"
            min="0"
            value={minTotal}
            onChange={(event) => setMinTotal(event.target.value)}
            placeholder="例如：1"
          />
          <Field
            label="最大总用量"
            type="number"
            min="0"
            value={maxTotal}
            onChange={(event) => setMaxTotal(event.target.value)}
            placeholder="例如：6"
          />
        </div>

        {filteredRecords.length ? (
          <>
            <DataTable rowKey="id" columns={columns} data={pageRecords} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无每日用药记录"
            description="先录入一条今日用药数据，后续分析、总结和提醒才会完整联动。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => {
          setEditingRecord(null);
          setEditingForm(createDefaultFormState());
        }}
        title={editingRecord ? `编辑记录：${editingRecord.medicineName}` : '编辑记录'}
        width={760}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingRecord(null);
                setEditingForm(createDefaultFormState());
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="medication-modal-layout">
          <div className="medication-modal-summary">
            <div className="medication-modal-summary-card">
              <span className="medication-modal-summary-label">当前用户</span>
              <strong>{editingRecord?.userId ?? '-'}</strong>
            </div>
            <div className="medication-modal-summary-card">
              <span className="medication-modal-summary-label">记录日期</span>
              <strong>{editingForm.date || '-'}</strong>
            </div>
            <div className="medication-modal-summary-card">
              <span className="medication-modal-summary-label">总用量</span>
              <strong>{editingTotalDose}</strong>
            </div>
          </div>

          <div className="medication-modal-section">
            <div className="medication-modal-section-head">
              <strong>基础信息</strong>
              <span>先确认日期和药品名称，再调整三个时段的服药剂量。</span>
            </div>
            <div className="medication-modal-grid medication-modal-grid-records">
              <DatePickerField
                label="日期"
                value={editingForm.date}
                onChange={(value) => setEditingForm((previous) => ({ ...previous, date: value }))}
                clearable={false}
              />
              <Field
                label="药品名称"
                value={editingForm.medicineName}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, medicineName: event.target.value }))}
                placeholder="例如：维生素 C"
              />
            </div>
          </div>

          <div className="medication-modal-section">
            <div className="medication-modal-section-head">
              <strong>三餐用量</strong>
              <span>保存后会同步刷新趋势分析、每日总结和提醒触发条件。</span>
            </div>
            <div className="medication-modal-grid medication-modal-grid-dose">
              <Field
                label="早餐用量"
                type="number"
                min="0"
                value={editingForm.breakfast}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, breakfast: event.target.value }))}
              />
              <Field
                label="午餐用量"
                type="number"
                min="0"
                value={editingForm.lunch}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, lunch: event.target.value }))}
              />
              <Field
                label="晚餐用量"
                type="number"
                min="0"
                value={editingForm.dinner}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, dinner: event.target.value }))}
              />
            </div>
          </div>
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }

          onChangeRecords((previous) => deleteMedicationRecord(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('每日用药记录已删除。');
        }}
        title="删除这条每日用药记录？"
      >
        删除后将影响用药趋势、库存估算和当日总结总量统计。
      </DeleteModal>
    </SectionCard>
  );
}
