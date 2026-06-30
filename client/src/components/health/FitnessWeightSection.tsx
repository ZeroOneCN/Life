import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { DataTable, Btn, DeleteModal, Field, Modal, Pagination, Tag } from '../ui';
import { EmptyState, SectionCard, StatGrid } from '../page';
import {
  FITNESS_RECORD_PAGE_SIZE,
  calculateBmi,
  createWeightRecord,
  deleteWeightRecord,
  updateWeightRecord,
} from '../../services/fitness';
import { recognizeFitnessImageLocal, type FitnessOcrResult } from '../../services/fitnessOcr';
import '../../styles/fitness-ocr.css';
import type { WeightRecord, WeightRecordDraft } from '../../types/fitness';

interface FitnessWeightSectionProps {
  defaultHeightCm: number;
  records: WeightRecord[];
  onChangeRecords: (updater: (records: WeightRecord[]) => WeightRecord[]) => void;
  onDefaultHeightChange: (value: number) => void;
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
  const height = Number(form.height);
  const bodyFat = Number(form.bodyFat || 0);

  if (!dayjs(form.date).isValid()) {
    return null;
  }

  if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }

  return {
    date: form.date,
    weight,
    height,
    bodyFat: Number.isFinite(bodyFat) ? bodyFat : 0,
    visceralFat: Number(form.visceralFat) || undefined,
    fatMass: Number(form.fatMass) || undefined,
    muscleRate: Number(form.muscleRate) || undefined,
    muscleMass: Number(form.muscleMass) || undefined,
    bodyWaterRate: Number(form.bodyWaterRate) || undefined,
    bodyWaterMass: Number(form.bodyWaterMass) || undefined,
    proteinRate: Number(form.proteinRate) || undefined,
    proteinMass: Number(form.proteinMass) || undefined,
    boneRate: Number(form.boneRate) || undefined,
    boneMass: Number(form.boneMass) || undefined,
    skeletalMuscleRate: Number(form.skeletalMuscleRate) || undefined,
    skeletalMuscleMass: Number(form.skeletalMuscleMass) || undefined,
    subcutaneousFatRate: Number(form.subcutaneousFatRate) || undefined,
    subcutaneousFatMass: Number(form.subcutaneousFatMass) || undefined,
  };
}

function getStatusTone(value: number, metric: string): 'green' | 'orange' | 'blue' {
  switch (metric) {
    case 'bodyFat':
    case 'fatMass':
    case 'subcutaneousFatRate':
    case 'subcutaneousFatMass':
      if (value >= 25) return 'orange';
      break;
    case 'muscleRate':
    case 'muscleMass':
    case 'skeletalMuscleRate':
    case 'skeletalMuscleMass':
      if (value >= 70) return 'green';
      break;
    case 'proteinRate':
    case 'proteinMass':
      if (value >= 18) return 'green';
      break;
    case 'boneRate':
    case 'boneMass':
      if (value <= 3) return 'blue';
      break;
    case 'bodyWaterRate':
    case 'bodyWaterMass':
      if (value >= 50) return 'green';
      break;
    case 'visceralFat':
      if (value <= 9) return 'green';
      if (value <= 14) return 'orange';
      return 'blue';
    default:
      break;
  }
  return 'green';
}

function getStatusLabel(value: number, metric: string): string {
  switch (metric) {
    case 'bodyFat':
    case 'fatMass':
    case 'subcutaneousFatRate':
    case 'subcutaneousFatMass':
      if (value >= 25) return '偏高';
      return '标准';
    case 'muscleRate':
    case 'muscleMass':
    case 'skeletalMuscleRate':
    case 'skeletalMuscleMass':
      if (value >= 70) return '优';
      return '标准';
    case 'proteinRate':
    case 'proteinMass':
      if (value >= 18) return '优';
      return '标准';
    case 'boneRate':
    case 'boneMass':
      if (value <= 3) return '偏低';
      return '标准';
    case 'bodyWaterRate':
    case 'bodyWaterMass':
      if (value >= 50) return '标准';
      return '偏低';
    case 'visceralFat':
      if (value <= 9) return '标准';
      if (value <= 14) return '偏高';
      return '偏高';
    default:
      return '标准';
  }
}

export function FitnessWeightSection({
  defaultHeightCm,
  records,
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
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm((previous) => (
      previous.height.trim()
        ? previous
        : { ...previous, height: String(defaultHeightCm) }
    ));
  }, [defaultHeightCm]);

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

  useEffect(() => {
    setPage(1);
  }, [filterDate]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const latestRecord = useMemo(() => {
    if (!records.length) return null;
    return [...records].sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())[0];
  }, [records]);

  const stats = useMemo(() => {
    if (!latestRecord) return [];
    const bmi = calculateBmi(latestRecord.weight, latestRecord.height);
    return [
      {
        label: 'BMI',
        value: bmi === null ? '-' : bmi.toFixed(1),
        accent: bmi !== null && bmi >= 24 ? 'var(--color-warning)' : 'var(--color-success)',
        subtext: bmi !== null && bmi >= 24 ? '偏高' : '标准',
      },
      {
        label: '体重',
        value: `${latestRecord.weight.toFixed(2)} kg`,
      },
      {
        label: '体脂率',
        value: `${latestRecord.bodyFat.toFixed(1)}%`,
        accent: latestRecord.bodyFat >= 25 ? 'var(--color-warning)' : 'var(--color-success)',
        subtext: latestRecord.bodyFat >= 25 ? '偏高' : '标准',
      },
    ];
  }, [latestRecord]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrStatus('正在读取图片...');
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = (e.target?.result as string).split(',')[1];
        if (!base64Data) {
          setOcrLoading(false);
          setOcrStatus('');
          return;
        }

        setUploadedImage(e.target?.result as string);

        try {
          // 使用本地OCR识别
          const result = await recognizeFitnessImageLocal(base64Data, (progress, status) => {
            setOcrStatus(status);
          });

          setForm((current) => ({
            ...current,
            weight: result.weight?.toString() ?? current.weight,
            height: result.height?.toString() ?? current.height,
            bodyFat: result.bodyFat?.toString() ?? current.bodyFat,
            visceralFat: result.visceralFat?.toString() ?? current.visceralFat,
            fatMass: result.fatMass?.toString() ?? current.fatMass,
            muscleRate: result.muscleRate?.toString() ?? current.muscleRate,
            muscleMass: result.muscleMass?.toString() ?? current.muscleMass,
            bodyWaterRate: result.bodyWaterRate?.toString() ?? current.bodyWaterRate,
            bodyWaterMass: result.bodyWaterMass?.toString() ?? current.bodyWaterMass,
            proteinRate: result.proteinRate?.toString() ?? current.proteinRate,
            proteinMass: result.proteinMass?.toString() ?? current.proteinMass,
            boneRate: result.boneRate?.toString() ?? current.boneRate,
            boneMass: result.boneMass?.toString() ?? current.boneMass,
            skeletalMuscleRate: result.skeletalMuscleRate?.toString() ?? current.skeletalMuscleRate,
            skeletalMuscleMass: result.skeletalMuscleMass?.toString() ?? current.skeletalMuscleMass,
            subcutaneousFatRate: result.subcutaneousFatRate?.toString() ?? current.subcutaneousFatRate,
            subcutaneousFatMass: result.subcutaneousFatMass?.toString() ?? current.subcutaneousFatMass,
          }));
          showToast('图片识别成功，已自动填充数据');
        } catch (error) {
          console.error('OCR Error:', error);
          showToast('图片识别失败，请重试或手动输入', 'error');
        } finally {
          setOcrLoading(false);
          setOcrStatus('');
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setOcrLoading(false);
      showToast('图片读取失败', 'error');
    }
  }, [showToast]);

  const handleClearImage = useCallback(() => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const columns = useMemo(() => [
    { key: 'date', title: '日期', dataIndex: 'date' as const },
    {
      key: 'weight',
      title: '体重',
      render: (_value: unknown, record: WeightRecord) => `${record.weight.toFixed(2)} kg`,
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
                visceralFat: String(record.visceralFat),
                fatMass: String(record.fatMass),
                muscleRate: String(record.muscleRate),
                muscleMass: String(record.muscleMass),
                bodyWaterRate: String(record.bodyWaterRate),
                bodyWaterMass: String(record.bodyWaterMass),
                proteinRate: String(record.proteinRate),
                proteinMass: String(record.proteinMass),
                boneRate: String(record.boneRate),
                boneMass: String(record.boneMass),
                skeletalMuscleRate: String(record.skeletalMuscleRate),
                skeletalMuscleMass: String(record.skeletalMuscleMass),
                subcutaneousFatRate: String(record.subcutaneousFatRate),
                subcutaneousFatMass: String(record.subcutaneousFatMass),
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
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全体重记录的日期、体重和身高。', 'error');
      return;
    }

    onChangeRecords((previous) => createWeightRecord(previous, draft));
    onDefaultHeightChange(draft.height);
    setForm(defaultFormState(draft.height));
    setUploadedImage(null);
    showToast('体重记录已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm);

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

  const renderMetricItem = (label: string, value: string, metric: string, numericValue: number) => (
    <div className="fitness-weight-metric-item">
      <span className="fitness-weight-metric-label">{label}</span>
      <span className="fitness-weight-metric-value">{value}</span>
      {numericValue > 0 && (
        <Tag tone={getStatusTone(numericValue, metric) as 'green' | 'orange' | 'blue'}>
          {getStatusLabel(numericValue, metric)}
        </Tag>
      )}
    </div>
  );

  return (
    <SectionCard
      title="体重记录"
      description="记录体重、身高和体脂，支持图片自动识别体脂秤数据。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          默认身高会跟随最近一次保存值更新。支持上传体脂秤屏幕截图自动识别数据。
        </div>

        {stats.length > 0 && (
          <StatGrid
            items={stats.map((item) => ({
              label: item.label,
              value: item.value,
              accent: item.accent,
              subtext: item.subtext,
            }))}
            className="forex-calculator-stat-grid"
          />
        )}

        <div className="fitness-weight-form-wrapper">
          <form className="fitness-weight-form" onSubmit={(event) => { event.preventDefault(); handleCreate(); }}>
            <div className="fitness-weight-form-header">
              <div className="fitness-weight-form-title">新增记录</div>
              <div className="fitness-weight-form-actions">
                <Btn tone="primary" type="submit">保存记录</Btn>
              </div>
            </div>

            <div className="fitness-weight-section">
              <div className="fitness-weight-section-label">基础信息</div>
              <div className="fitness-weight-basic-grid">
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
                  step="0.01"
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
                  label="体脂率（%）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bodyFat}
                  onChange={(event) => setForm((previous) => ({ ...previous, bodyFat: event.target.value }))}
                />
              </div>
            </div>

            <div className="fitness-weight-section">
              <div className="fitness-weight-section-label">
                <span>图片识别</span>
                <span className="fitness-weight-section-hint">上传体脂秤截图自动填充数据</span>
              </div>
              <div className="fitness-weight-ocr-area">
                <div className="fitness-ocr-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="fitness-ocr-file-input"
                    disabled={ocrLoading}
                    ref={fileInputRef}
                  />
                  <Btn tone="secondary" type="button" disabled={ocrLoading} onClick={handleUploadClick}>
                    {ocrLoading ? '识别中...' : '上传体脂秤截图'}
                  </Btn>
                  {ocrStatus && (
                    <span className="fitness-ocr-status">{ocrStatus}</span>
                  )}
                  {uploadedImage && (
                    <Btn tone="danger" type="button" onClick={handleClearImage}>清除图片</Btn>
                  )}
                </div>
                {uploadedImage && (
                  <div className="fitness-ocr-preview">
                    <img src={uploadedImage} alt="上传预览" className="fitness-ocr-image" />
                  </div>
                )}
              </div>
            </div>

            <div className="fitness-weight-section">
              <div className="fitness-weight-section-label">详细指标（可选）</div>
              <div className="fitness-weight-detail-grid">
                <Field
                  label="内脏脂肪"
                  type="number"
                  min="0"
                  value={form.visceralFat}
                  onChange={(event) => setForm((previous) => ({ ...previous, visceralFat: event.target.value }))}
                />
                <Field
                  label="脂肪量（kg）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.fatMass}
                  onChange={(event) => setForm((previous) => ({ ...previous, fatMass: event.target.value }))}
                />
                <Field
                  label="肌肉率（%）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.muscleRate}
                  onChange={(event) => setForm((previous) => ({ ...previous, muscleRate: event.target.value }))}
                />
                <Field
                  label="肌肉量（kg）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.muscleMass}
                  onChange={(event) => setForm((previous) => ({ ...previous, muscleMass: event.target.value }))}
                />
                <Field
                  label="水分率（%）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bodyWaterRate}
                  onChange={(event) => setForm((previous) => ({ ...previous, bodyWaterRate: event.target.value }))}
                />
                <Field
                  label="水分量（kg）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bodyWaterMass}
                  onChange={(event) => setForm((previous) => ({ ...previous, bodyWaterMass: event.target.value }))}
                />
                <Field
                  label="蛋白质率（%）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.proteinRate}
                  onChange={(event) => setForm((previous) => ({ ...previous, proteinRate: event.target.value }))}
                />
                <Field
                  label="蛋白质量（kg）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.proteinMass}
                  onChange={(event) => setForm((previous) => ({ ...previous, proteinMass: event.target.value }))}
                />
                <Field
                  label="骨量率（%）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.boneRate}
                  onChange={(event) => setForm((previous) => ({ ...previous, boneRate: event.target.value }))}
                />
                <Field
                  label="骨量（kg）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.boneMass}
                  onChange={(event) => setForm((previous) => ({ ...previous, boneMass: event.target.value }))}
                />
                <Field
                  label="骨骼肌率（%）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.skeletalMuscleRate}
                  onChange={(event) => setForm((previous) => ({ ...previous, skeletalMuscleRate: event.target.value }))}
                />
                <Field
                  label="骨骼肌量（kg）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.skeletalMuscleMass}
                  onChange={(event) => setForm((previous) => ({ ...previous, skeletalMuscleMass: event.target.value }))}
                />
                <Field
                  label="皮下脂肪率（%）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.subcutaneousFatRate}
                  onChange={(event) => setForm((previous) => ({ ...previous, subcutaneousFatRate: event.target.value }))}
                />
                <Field
                  label="皮下脂肪量（kg）"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.subcutaneousFatMass}
                  onChange={(event) => setForm((previous) => ({ ...previous, subcutaneousFatMass: event.target.value }))}
                />
              </div>
            </div>
          </form>
        </div>

        <div className="step-filter-grid">
          <DatePickerField
            label="筛选日期"
            value={filterDate}
            onChange={setFilterDate}
            placeholder="按日期筛选"
          />
        </div>

        <div className="fitness-section-summary">
          <span className="subtle-text">
            共 {filteredRecords.length} 条体重记录
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
        <div className="fitness-weight-edit-modal">
          <div className="fitness-weight-section">
            <div className="fitness-weight-section-label">基础信息</div>
            <div className="fitness-weight-basic-grid">
              <DatePickerField
                label="记录日期"
                value={editingForm.date}
                onChange={(value) => setEditingForm((previous) => ({ ...previous, date: value }))}
                clearable={false}
                popoverStrategy="inline"
              />
              <Field
                label="体重（kg）"
                type="number"
                min="1"
                step="0.01"
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
                label="体脂率（%）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.bodyFat}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, bodyFat: event.target.value }))}
              />
            </div>
          </div>

          <div className="fitness-weight-section">
            <div className="fitness-weight-section-label">脂肪指标</div>
            <div className="fitness-weight-detail-grid">
              <Field
                label="内脏脂肪"
                type="number"
                min="0"
                value={editingForm.visceralFat}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, visceralFat: event.target.value }))}
              />
              <Field
                label="脂肪量（kg）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.fatMass}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, fatMass: event.target.value }))}
              />
              <Field
                label="皮下脂肪率（%）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.subcutaneousFatRate}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, subcutaneousFatRate: event.target.value }))}
              />
              <Field
                label="皮下脂肪量（kg）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.subcutaneousFatMass}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, subcutaneousFatMass: event.target.value }))}
              />
            </div>
          </div>

          <div className="fitness-weight-section">
            <div className="fitness-weight-section-label">肌肉与骨骼</div>
            <div className="fitness-weight-detail-grid">
              <Field
                label="肌肉率（%）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.muscleRate}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, muscleRate: event.target.value }))}
              />
              <Field
                label="肌肉量（kg）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.muscleMass}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, muscleMass: event.target.value }))}
              />
              <Field
                label="骨骼肌率（%）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.skeletalMuscleRate}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, skeletalMuscleRate: event.target.value }))}
              />
              <Field
                label="骨骼肌量（kg）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.skeletalMuscleMass}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, skeletalMuscleMass: event.target.value }))}
              />
              <Field
                label="骨量率（%）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.boneRate}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, boneRate: event.target.value }))}
              />
              <Field
                label="骨量（kg）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.boneMass}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, boneMass: event.target.value }))}
              />
            </div>
          </div>

          <div className="fitness-weight-section">
            <div className="fitness-weight-section-label">水分与蛋白质</div>
            <div className="fitness-weight-detail-grid">
              <Field
                label="水分率（%）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.bodyWaterRate}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, bodyWaterRate: event.target.value }))}
              />
              <Field
                label="水分量（kg）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.bodyWaterMass}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, bodyWaterMass: event.target.value }))}
              />
              <Field
                label="蛋白质率（%）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.proteinRate}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, proteinRate: event.target.value }))}
              />
              <Field
                label="蛋白质量（kg）"
                type="number"
                min="0"
                step="0.01"
                value={editingForm.proteinMass}
                onChange={(event) => setEditingForm((previous) => ({ ...previous, proteinMass: event.target.value }))}
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