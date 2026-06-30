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
  updateWeightRecord,
} from '../../services/fitness';
import type { WeightRecord, WeightRecordDraft } from '../../types/fitness';

interface FitnessWeightSectionProps {
  records: WeightRecord[];
  defaultHeightCm: number;
  onChangeRecords: (updater: (records: WeightRecord[]) => WeightRecord[]) => void;
  onDefaultHeightChange?: (value: number) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface WeightFormState {
  date: string;
  weight: string;
  height: string;
  bodyFat: string;
  visceralFat: string;
  fatMass: string;
  muscleRate: string;
  muscleMass: string;
  bodyWaterRate: string;
  bodyWaterMass: string;
  proteinRate: string;
  proteinMass: string;
  boneRate: string;
  boneMass: string;
  skeletalMuscleRate: string;
  skeletalMuscleMass: string;
  subcutaneousFatRate: string;
  subcutaneousFatMass: string;
}

const defaultFormState = (defaultHeightCm: number): WeightFormState => ({
  date: dayjs().format('YYYY-MM-DD'),
  weight: '',
  height: String(defaultHeightCm),
  bodyFat: '',
  visceralFat: '',
  fatMass: '',
  muscleRate: '',
  muscleMass: '',
  bodyWaterRate: '',
  bodyWaterMass: '',
  proteinRate: '',
  proteinMass: '',
  boneRate: '',
  boneMass: '',
  skeletalMuscleRate: '',
  skeletalMuscleMass: '',
  subcutaneousFatRate: '',
  subcutaneousFatMass: '',
});

function parseDraft(form: WeightFormState): WeightRecordDraft | null {
  const weight = Number(form.weight);
  const height = Number(form.height) || 170;

  if (!dayjs(form.date).isValid()) {
    return null;
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    return null;
  }

  return {
    date: form.date,
    weight,
    height,
    bodyFat: Number(form.bodyFat) || 0,
    visceralFat: Number(form.visceralFat) || 0,
    fatMass: Number(form.fatMass) || 0,
    muscleRate: Number(form.muscleRate) || 0,
    muscleMass: Number(form.muscleMass) || 0,
    bodyWaterRate: Number(form.bodyWaterRate) || 0,
    bodyWaterMass: Number(form.bodyWaterMass) || 0,
    proteinRate: Number(form.proteinRate) || 0,
    proteinMass: Number(form.proteinMass) || 0,
    boneRate: Number(form.boneRate) || 0,
    boneMass: Number(form.boneMass) || 0,
    skeletalMuscleRate: Number(form.skeletalMuscleRate) || 0,
    skeletalMuscleMass: Number(form.skeletalMuscleMass) || 0,
    subcutaneousFatRate: Number(form.subcutaneousFatRate) || 0,
    subcutaneousFatMass: Number(form.subcutaneousFatMass) || 0,
  };
}

export function FitnessWeightSection({
  records,
  defaultHeightCm,
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

  const filteredRecords = useMemo(() => {
    if (!filterDate) {
      return records;
    }
    return records.filter((record) => record.date === filterDate);
  }, [filterDate, records]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / FITNESS_RECORD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * FITNESS_RECORD_PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + FITNESS_RECORD_PAGE_SIZE);
  }, [filteredRecords, page]);

  const latest = filteredRecords[0];
  const previous = filteredRecords[1];
  const latestBmi = latest ? calculateBmi(latest.weight, latest.height || defaultHeightCm) : null;
  const weightDelta = latest && previous
    ? Number((latest.weight - previous.weight).toFixed(1))
    : 0;

  useEffect(() => {
    setPage(1);
  }, [filterDate]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const columns = useMemo(() => [
    {
      key: 'date',
      title: '日期',
      dataIndex: 'date' as const,
    },
    {
      key: 'weight',
      title: '体重',
      render: (_value: unknown, record: WeightRecord) => `${record.weight} kg`,
    },
    {
      key: 'height',
      title: '身高',
      render: (_value: unknown, record: WeightRecord) => `${record.height} cm`,
    },
    {
      key: 'bmi',
      title: 'BMI',
      render: (_value: unknown, record: WeightRecord) => {
        const bmi = calculateBmi(record.weight, record.height || defaultHeightCm);
        return bmi ? bmi.toFixed(1) : '—';
      },
    },
    {
      key: 'bodyFat',
      title: '体脂率',
      render: (_value: unknown, record: WeightRecord) => (record.bodyFat ? `${record.bodyFat}%` : '—'),
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
                bodyFat: String(record.bodyFat || ''),
                visceralFat: String(record.visceralFat || ''),
                fatMass: String(record.fatMass || ''),
                muscleRate: String(record.muscleRate || ''),
                muscleMass: String(record.muscleMass || ''),
                bodyWaterRate: String(record.bodyWaterRate || ''),
                bodyWaterMass: String(record.bodyWaterMass || ''),
                proteinRate: String(record.proteinRate || ''),
                proteinMass: String(record.proteinMass || ''),
                boneRate: String(record.boneRate || ''),
                boneMass: String(record.boneMass || ''),
                skeletalMuscleRate: String(record.skeletalMuscleRate || ''),
                skeletalMuscleMass: String(record.skeletalMuscleMass || ''),
                subcutaneousFatRate: String(record.subcutaneousFatRate || ''),
                subcutaneousFatMass: String(record.subcutaneousFatMass || ''),
              });
            }}
          >
            编辑
          </Btn>
          <Btn tone="danger" onClick={() => setPendingDeleteId(record.id)}>删除</Btn>
        </div>
      ),
    },
  ], [defaultHeightCm]);

  const handleCreate = () => {
    const draft = parseDraft(form);
    if (!draft) {
      showToast('请补全体重记录的日期和体重。', 'error');
      return;
    }

    onChangeRecords((previous) => createWeightRecord(previous, draft));
    setForm(defaultFormState(defaultHeightCm));
    showToast('体重记录已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;

    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('请补全要保存的体重记录。', 'error');
      return;
    }

    onChangeRecords((previous) => updateWeightRecord(previous, editingRecord.id, draft));
    setEditingRecord(null);
    setEditingForm(defaultFormState(defaultHeightCm));
    showToast('体重记录已更新。');
  };

  const handleDelete = () => {
    if (!pendingDeleteId) return;
    onChangeRecords((previous) => deleteWeightRecord(previous, pendingDeleteId));
    setPendingDeleteId(null);
    showToast('体重记录已删除。');
  };

  return (
    <SectionCard
      title="体重记录"
      description="记录体重、体脂率和身体成分变化，用于趋势追踪和健康建议分析。"
    >
      <div className="page-stack">
        {/* 录入表单 */}
        <form
          className="form-grid fitness-entry-grid"
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          <DatePickerField
            label="记录日期"
            value={form.date}
            onChange={(value) => setForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
          />
          <Field
            label="体重（kg）"
            type="number"
            step="0.01"
            placeholder="例如：73.8"
            value={form.weight}
            onChange={(event) => setForm((previous) => ({ ...previous, weight: event.target.value }))}
          />
          <Field
            label="身高（cm）"
            type="number"
            step="0.1"
            placeholder="例如：170"
            value={form.height}
            onChange={(event) => {
              const value = event.target.value;
              setForm((previous) => ({ ...previous, height: value }));
              const num = Number(value);
              if (num > 0 && onDefaultHeightChange) {
                onDefaultHeightChange(num);
              }
            }}
          />
          <Field
            label="体脂率（%）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.bodyFat}
            onChange={(event) => setForm((previous) => ({ ...previous, bodyFat: event.target.value }))}
          />
          <Field
            label="内脏脂肪"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.visceralFat}
            onChange={(event) => setForm((previous) => ({ ...previous, visceralFat: event.target.value }))}
          />
          <Field
            label="脂肪量（kg）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.fatMass}
            onChange={(event) => setForm((previous) => ({ ...previous, fatMass: event.target.value }))}
          />
          <Field
            label="肌肉率（%）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.muscleRate}
            onChange={(event) => setForm((previous) => ({ ...previous, muscleRate: event.target.value }))}
          />
          <Field
            label="肌肉量（kg）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.muscleMass}
            onChange={(event) => setForm((previous) => ({ ...previous, muscleMass: event.target.value }))}
          />
          <Field
            label="体水分率（%）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.bodyWaterRate}
            onChange={(event) => setForm((previous) => ({ ...previous, bodyWaterRate: event.target.value }))}
          />
          <Field
            label="体水分量（kg）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.bodyWaterMass}
            onChange={(event) => setForm((previous) => ({ ...previous, bodyWaterMass: event.target.value }))}
          />
          <Field
            label="蛋白量占比（%）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.proteinRate}
            onChange={(event) => setForm((previous) => ({ ...previous, proteinRate: event.target.value }))}
          />
          <Field
            label="蛋白量含量（kg）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.proteinMass}
            onChange={(event) => setForm((previous) => ({ ...previous, proteinMass: event.target.value }))}
          />
          <Field
            label="骨量占比（%）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.boneRate}
            onChange={(event) => setForm((previous) => ({ ...previous, boneRate: event.target.value }))}
          />
          <Field
            label="骨量（kg）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.boneMass}
            onChange={(event) => setForm((previous) => ({ ...previous, boneMass: event.target.value }))}
          />
          <Field
            label="骨骼肌率（%）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.skeletalMuscleRate}
            onChange={(event) => setForm((previous) => ({ ...previous, skeletalMuscleRate: event.target.value }))}
          />
          <Field
            label="骨骼肌量（kg）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.skeletalMuscleMass}
            onChange={(event) => setForm((previous) => ({ ...previous, skeletalMuscleMass: event.target.value }))}
          />
          <Field
            label="皮下脂肪率（%）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.subcutaneousFatRate}
            onChange={(event) => setForm((previous) => ({ ...previous, subcutaneousFatRate: event.target.value }))}
          />
          <Field
            label="皮下脂肪量（kg）"
            type="number"
            step="0.1"
            placeholder="可选"
            value={form.subcutaneousFatMass}
            onChange={(event) => setForm((previous) => ({ ...previous, subcutaneousFatMass: event.target.value }))}
          />
          <div className="form-grid-spacer">
            <Btn type="submit">保存记录</Btn>
          </div>
        </form>

        {/* 最新概览 */}
        {latest ? (
          <div className="fitness-latest-row">
            <div className="fitness-latest-item">
              <span className="fitness-latest-label">最新体重</span>
              <strong className="fitness-latest-value">{latest.weight} kg</strong>
              <span className={`fitness-latest-delta ${weightDelta < 0 ? 'is-down' : weightDelta > 0 ? 'is-up' : ''}`.trim()}>
                {weightDelta > 0 ? '+' : ''}{weightDelta} kg
              </span>
            </div>
            <div className="fitness-latest-item">
              <span className="fitness-latest-label">BMI</span>
              <strong className="fitness-latest-value">{latestBmi ? latestBmi.toFixed(1) : '—'}</strong>
            </div>
            {latest.bodyFat ? (
              <div className="fitness-latest-item">
                <span className="fitness-latest-label">体脂率</span>
                <strong className="fitness-latest-value">{latest.bodyFat}%</strong>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 筛选 & 列表 */}
        <div className="fitness-filter-row">
          <DatePickerField
            label="筛选日期"
            value={filterDate}
            onChange={setFilterDate}
            clearable
          />
          <div className="fitness-filter-spacer" />
        </div>

        {pageRecords.length === 0 ? (
          <EmptyState
            title="暂无体重记录"
            description="添加第一条体重记录，开始追踪身体变化。"
          />
        ) : (
          <>
            <DataTable columns={columns} data={pageRecords} rowKey="id" />
            {filteredRecords.length > FITNESS_RECORD_PAGE_SIZE ? (
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            ) : null}
          </>
        )}
      </div>

      {/* 编辑弹窗 */}
      <Modal
        open={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        title="编辑体重记录"
        footer={
          <div className="modal-footer">
            <Btn tone="secondary" onClick={() => setEditingRecord(null)}>取消</Btn>
            <Btn onClick={handleSaveEdit}>保存</Btn>
          </div>
        }
      >
        <form
          className="form-grid fitness-entry-grid"
          onSubmit={(event) => {
            event.preventDefault();
            handleSaveEdit();
          }}
        >
          <DatePickerField
            label="记录日期"
            value={editingForm.date}
            onChange={(value) => setEditingForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
          />
          <Field
            label="体重（kg）"
            type="number"
            step="0.01"
            value={editingForm.weight}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, weight: event.target.value }))}
          />
          <Field
            label="身高（cm）"
            type="number"
            step="0.1"
            value={editingForm.height}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, height: event.target.value }))}
          />
          <Field
            label="体脂率（%）"
            type="number"
            step="0.1"
            value={editingForm.bodyFat}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, bodyFat: event.target.value }))}
          />
          <Field
            label="内脏脂肪"
            type="number"
            step="0.1"
            value={editingForm.visceralFat}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, visceralFat: event.target.value }))}
          />
          <Field
            label="脂肪量（kg）"
            type="number"
            step="0.1"
            value={editingForm.fatMass}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, fatMass: event.target.value }))}
          />
          <Field
            label="肌肉率（%）"
            type="number"
            step="0.1"
            value={editingForm.muscleRate}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, muscleRate: event.target.value }))}
          />
          <Field
            label="肌肉量（kg）"
            type="number"
            step="0.1"
            value={editingForm.muscleMass}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, muscleMass: event.target.value }))}
          />
          <Field
            label="体水分率（%）"
            type="number"
            step="0.1"
            value={editingForm.bodyWaterRate}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, bodyWaterRate: event.target.value }))}
          />
          <Field
            label="体水分量（kg）"
            type="number"
            step="0.1"
            value={editingForm.bodyWaterMass}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, bodyWaterMass: event.target.value }))}
          />
          <Field
            label="蛋白量占比（%）"
            type="number"
            step="0.1"
            value={editingForm.proteinRate}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, proteinRate: event.target.value }))}
          />
          <Field
            label="蛋白量含量（kg）"
            type="number"
            step="0.1"
            value={editingForm.proteinMass}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, proteinMass: event.target.value }))}
          />
          <Field
            label="骨量占比（%）"
            type="number"
            step="0.1"
            value={editingForm.boneRate}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, boneRate: event.target.value }))}
          />
          <Field
            label="骨量（kg）"
            type="number"
            step="0.1"
            value={editingForm.boneMass}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, boneMass: event.target.value }))}
          />
          <Field
            label="骨骼肌率（%）"
            type="number"
            step="0.1"
            value={editingForm.skeletalMuscleRate}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, skeletalMuscleRate: event.target.value }))}
          />
          <Field
            label="骨骼肌量（kg）"
            type="number"
            step="0.1"
            value={editingForm.skeletalMuscleMass}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, skeletalMuscleMass: event.target.value }))}
          />
          <Field
            label="皮下脂肪率（%）"
            type="number"
            step="0.1"
            value={editingForm.subcutaneousFatRate}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, subcutaneousFatRate: event.target.value }))}
          />
          <Field
            label="皮下脂肪量（kg）"
            type="number"
            step="0.1"
            value={editingForm.subcutaneousFatMass}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, subcutaneousFatMass: event.target.value }))}
          />
        </form>
      </Modal>

      {/* 删除确认 */}
      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleDelete}
        title="确认删除这条体重记录？"
      >
        删除后，对应日期的体重统计和趋势分析都会同步刷新。
      </DeleteModal>
    </SectionCard>
  );
}
