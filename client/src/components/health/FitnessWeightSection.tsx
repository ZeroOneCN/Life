import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { DataTable, Btn, DeleteModal, Field, Modal, Pagination } from '../ui';
import { EmptyState, SectionCard } from '../page';
import {
  FITNESS_RECORD_PAGE_SIZE,
  calculateBmi,
  createWeightRecord,
  deleteWeightRecord,
  filterRecordsByUserId,
  normalizeFitnessUserId,
  updateWeightRecord,
} from '../../services/fitness';
import type { WeightRecord, WeightRecordDraft } from '../../types/fitness';

interface FitnessWeightSectionProps {
  currentUserLabel: string;
  activeUserId: string;
  filterUserId: string;
  defaultHeightCm: number;
  records: WeightRecord[];
  onFilterUserIdChange: (value: string) => void;
  onChangeRecords: (updater: (records: WeightRecord[]) => WeightRecord[]) => void;
  onDefaultHeightChange: (value: number) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface WeightFormState {
  date: string;
  weight: string;
  height: string;
  bodyFat: string;
}

const defaultFormState = (defaultHeightCm: number): WeightFormState => ({
  date: dayjs().format('YYYY-MM-DD'),
  weight: '',
  height: String(defaultHeightCm),
  bodyFat: '',
});

function parseDraft(form: WeightFormState, userId: string): WeightRecordDraft | null {
  const normalizedUserId = normalizeFitnessUserId(userId);
  const weight = Number(form.weight);
  const height = Number(form.height);
  const bodyFat = Number(form.bodyFat || 0);

  if (!normalizedUserId || !dayjs(form.date).isValid()) {
    return null;
  }

  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }

  return {
    userId: normalizedUserId,
    date: form.date,
    weight,
    height,
    bodyFat: Number.isFinite(bodyFat) ? bodyFat : 0,
  };
}

export function FitnessWeightSection({
  currentUserLabel,
  activeUserId,
  filterUserId,
  defaultHeightCm,
  records,
  onFilterUserIdChange,
  onChangeRecords,
  onDefaultHeightChange,
  showToast,
}: FitnessWeightSectionProps) {
  const [form, setForm] = useState<WeightFormState>(() => defaultFormState(defaultHeightCm));
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<WeightRecord | null>(null);
  const [editingForm, setEditingForm] = useState<WeightFormState>(() => defaultFormState(defaultHeightCm));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setForm((previous) => (
      previous.height.trim()
        ? previous
        : { ...previous, height: String(defaultHeightCm) }
    ));
  }, [defaultHeightCm]);

  const filteredRecords = useMemo(() => {
    const byUser = filterRecordsByUserId(records, filterUserId);

    if (!filterDate) {
      return byUser;
    }

    return byUser.filter((record) => record.date === filterDate);
  }, [filterDate, filterUserId, records]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / FITNESS_RECORD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * FITNESS_RECORD_PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + FITNESS_RECORD_PAGE_SIZE);
  }, [filteredRecords, page]);

  useEffect(() => {
    setPage(1);
  }, [filterDate, filterUserId]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const columns = useMemo(() => [
    { key: 'date', title: '日期', dataIndex: 'date' as const },
    {
      key: 'weight',
      title: '体重',
      render: (_value: unknown, record: WeightRecord) => `${record.weight.toFixed(1)} kg`,
    },
    {
      key: 'height',
      title: '身高',
      render: (_value: unknown, record: WeightRecord) => `${record.height} cm`,
    },
    {
      key: 'bodyFat',
      title: '体脂',
      render: (_value: unknown, record: WeightRecord) => `${record.bodyFat.toFixed(1)} %`,
    },
    {
      key: 'bmi',
      title: 'BMI',
      render: (_value: unknown, record: WeightRecord) => {
        const bmi = calculateBmi(record.weight, record.height);
        return bmi === null ? '-' : bmi.toFixed(1);
      },
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, record: WeightRecord) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingRecord(record);
              setEditingForm({
                date: record.date,
                weight: String(record.weight),
                height: String(record.height),
                bodyFat: String(record.bodyFat),
              });
            }}
          >
            编辑
          </Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(record.id)}>删除</Btn>
        </div>
      ),
    },
  ], []);

  const handleCreate = () => {
    const draft = parseDraft(form, activeUserId);

    if (!draft) {
      showToast('请补全体重记录的用户、日期、体重和身高。', 'error');
      return;
    }

    onChangeRecords((previous) => createWeightRecord(previous, draft));
    onDefaultHeightChange(draft.height);
    setForm(defaultFormState(draft.height));
    showToast('体重记录已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm, editingRecord.userId);

    if (!draft) {
      showToast('请补全要保存的体重记录。', 'error');
      return;
    }

    onChangeRecords((previous) => updateWeightRecord(previous, editingRecord.id, draft));
    onDefaultHeightChange(draft.height);
    setEditingRecord(null);
    setEditingForm(defaultFormState(draft.height));
    showToast('体重记录已更新。');
  };

  return (
    <SectionCard
      title="体重记录"
      description="记录体重、身高和体脂，用于计算 BMI 并绘制近 30 天体型趋势。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          当前录入用户：<strong>{currentUserLabel}</strong>。默认身高会跟随最近一次保存值更新。
        </div>

        <div className="form-grid fitness-entry-grid fitness-entry-grid-weight">
          <DatePickerField
            label="记录日期"
            value={form.date}
            onChange={(value) => setForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
          />
          <Field
            label="体重（kg）"
            type="number"
            min="1"
            step="0.1"
            value={form.weight}
            onChange={(event) => setForm((previous) => ({ ...previous, weight: event.target.value }))}
          />
          <Field
            label="身高（cm）"
            type="number"
            min="1"
            value={form.height}
            onChange={(event) => setForm((previous) => ({ ...previous, height: event.target.value }))}
          />
          <Field
            label="体脂（%）"
            type="number"
            min="0"
            step="0.1"
            value={form.bodyFat}
            onChange={(event) => setForm((previous) => ({ ...previous, bodyFat: event.target.value }))}
          />
        </div>

        <div className="fitness-form-actions">
          <Btn tone="primary" onClick={handleCreate}>新增体重记录</Btn>
          <span className="subtle-text">
            当前输入的 BMI 预估：{(() => {
              const bmi = calculateBmi(Number(form.weight), Number(form.height));
              return bmi === null ? '-' : bmi.toFixed(1);
            })()}
          </span>
        </div>

        <div className="step-filter-grid">
          <Field
            label="筛选用户 ID"
            placeholder="留空查看全部用户"
            value={filterUserId}
            onChange={(event) => onFilterUserIdChange(event.target.value)}
          />
          <DatePickerField
            label="筛选日期"
            value={filterDate}
            onChange={setFilterDate}
            placeholder="按日期筛选"
            hint="留空时显示该用户的全部体重记录。"
          />
        </div>

        <div className="fitness-section-summary">
          <span className="subtle-text">
            共 {filteredRecords.length} 条体重记录
            {filterUserId.trim() ? `（用户 ${filterUserId.trim()}）` : '（全部用户）'}
          </span>
        </div>

        {filteredRecords.length ? (
          <>
            <DataTable columns={columns} data={pageRecords} rowKey="id" />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无体重记录"
            description="先录入一条体重数据，这里会展示可筛选和可编辑的列表。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title="编辑体重记录"
        width={720}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingRecord(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="page-stack">
          <DatePickerField
            label="记录日期"
            value={editingForm.date}
            onChange={(value) => setEditingForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
            popoverStrategy="inline"
          />
          <div className="form-grid">
            <Field
              label="体重（kg）"
              type="number"
              min="1"
              step="0.1"
              value={editingForm.weight}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, weight: event.target.value }))}
            />
            <Field
              label="身高（cm）"
              type="number"
              min="1"
              value={editingForm.height}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, height: event.target.value }))}
            />
            <Field
              label="体脂（%）"
              type="number"
              min="0"
              step="0.1"
              value={editingForm.bodyFat}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, bodyFat: event.target.value }))}
            />
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

          onChangeRecords((previous) => deleteWeightRecord(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('体重记录已删除。');
        }}
        title="确认删除这条体重记录？"
      >
        删除后，对应日期的 BMI 和近 30 天体重趋势会同步刷新。
      </DeleteModal>
    </SectionCard>
  );
}
