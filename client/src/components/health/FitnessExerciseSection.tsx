import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { DataTable, Btn, DeleteModal, Field, Modal, Pagination, SelectField } from '../ui';
import { EmptyState, SectionCard } from '../page';
import {
  EXERCISE_TYPE_META,
  FITNESS_RECORD_PAGE_SIZE,
  INTENSITY_LEVEL_META,
  createExerciseRecord,
  deleteExerciseRecord,
  updateExerciseRecord,
} from '../../services/fitness';
import { fetchExerciseCalorie } from '../../services/fitnessAiApi';
import { buildApiErrorMessage } from '../../lib/api';
import type { ExerciseRecord, ExerciseRecordDraft, ExerciseType, IntensityLevel } from '../../types/fitness';

interface FitnessExerciseSectionProps {
  records: ExerciseRecord[];
  onChangeRecords: (updater: (records: ExerciseRecord[]) => ExerciseRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface ExerciseFormState {
  date: string;
  exerciseType: ExerciseType;
  exerciseName: string;
  duration: string;
  calories: string;
  intensity: IntensityLevel;
}

const defaultFormState = (): ExerciseFormState => ({
  date: dayjs().format('YYYY-MM-DD'),
  exerciseType: 'cardio',
  exerciseName: '',
  duration: '',
  calories: '',
  intensity: 'medium',
});

function parseDraft(form: ExerciseFormState): ExerciseRecordDraft | null {
  const duration = Number(form.duration);
  const calories = Number(form.calories);

  if (!form.exerciseName.trim() || !dayjs(form.date).isValid()) {
    return null;
  }

  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(calories) || calories <= 0) {
    return null;
  }

  return {
    date: form.date,
    exerciseType: form.exerciseType,
    exerciseName: form.exerciseName.trim(),
    duration,
    calories,
    intensity: form.intensity,
  };
}

export function FitnessExerciseSection({
  records,
  onChangeRecords,
  showToast,
}: FitnessExerciseSectionProps) {
  const [form, setForm] = useState<ExerciseFormState>(defaultFormState);
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<ExerciseRecord | null>(null);
  const [editingForm, setEditingForm] = useState<ExerciseFormState>(defaultFormState);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [aiQuerying, setAiQuerying] = useState(false);
  const [aiHint, setAiHint] = useState<string>('');
  const [aiSource, setAiSource] = useState<'cache' | 'ai' | null>(null);

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

  const columns = useMemo(() => [
    {
      key: 'date',
      title: '日期',
      dataIndex: 'date' as const,
    },
    {
      key: 'exerciseType',
      title: '类型',
      render: (_value: unknown, record: ExerciseRecord) => (
        <span style={{ color: EXERCISE_TYPE_META[record.exerciseType].color }}>
          {EXERCISE_TYPE_META[record.exerciseType].label}
        </span>
      ),
    },
    {
      key: 'exerciseName',
      title: '运动名称',
      dataIndex: 'exerciseName' as const,
    },
    {
      key: 'duration',
      title: '时长',
      render: (_value: unknown, record: ExerciseRecord) => `${record.duration} 分钟`,
    },
    {
      key: 'calories',
      title: '消耗热量',
      render: (_value: unknown, record: ExerciseRecord) => `${record.calories} kcal`,
    },
    {
      key: 'intensity',
      title: '强度',
      render: (_value: unknown, record: ExerciseRecord) => (
        <span style={{ color: INTENSITY_LEVEL_META[record.intensity].color }}>
          {INTENSITY_LEVEL_META[record.intensity].label}
        </span>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, record: ExerciseRecord) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingRecord(record);
              setEditingForm({
                date: record.date,
                exerciseType: record.exerciseType,
                exerciseName: record.exerciseName,
                duration: String(record.duration),
                calories: String(record.calories),
                intensity: record.intensity,
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
      showToast('请补全运动记录的日期、项目、时长和热量。', 'error');
      return;
    }

    onChangeRecords((previous) => createExerciseRecord(previous, draft));
    setForm(defaultFormState());
    setAiHint('');
    setAiSource(null);
    showToast('运动记录已新增。');
  };

  const handleAiQuery = async () => {
    const exerciseName = form.exerciseName.trim();

    if (!exerciseName) {
      showToast('请先输入运动名称。', 'error');
      return;
    }

    setAiQuerying(true);
    setAiHint('');
    setAiSource(null);

    try {
      const info = await fetchExerciseCalorie(exerciseName);
      const safeDuration = info.suggestedDurationMin > 0 ? info.suggestedDurationMin : 30;
      const totalCalories = Math.round(info.caloriesPerMin * safeDuration);

      setForm((previous) => ({
        ...previous,
        duration: String(safeDuration),
        calories: String(totalCalories),
        intensity: info.suggestedIntensity,
        exerciseType: info.suggestedType,
      }));

      setAiSource(info.source);
      const sourceLabel = info.source === 'cache' ? '命中本地缓存' : 'AI 实时估算';
      setAiHint(`${sourceLabel}：${info.exerciseName} · ${info.caloriesPerMin.toFixed(1)} kcal/分钟 · 建议 ${safeDuration} 分钟 / ${totalCalories} kcal（${INTENSITY_LEVEL_META[info.suggestedIntensity].label}）`);
      showToast(`${exerciseName} 训练参数已自动填入（${sourceLabel}）。`, 'success');
    } catch (error) {
      showToast(buildApiErrorMessage(error, 'AI 运动消耗查询失败，请检查网络或 DEEPSEEK_API_KEY 配置。'), 'error');
    } finally {
      setAiQuerying(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全要保存的运动记录。', 'error');
      return;
    }

    onChangeRecords((previous) => updateExerciseRecord(previous, editingRecord.id, draft));
    setEditingRecord(null);
    setEditingForm(defaultFormState());
    showToast('运动记录已更新。');
  };

  return (
    <SectionCard
      title="运动记录"
      description="记录训练类型、时长、消耗和强度，为净热量和训练频率分析提供数据。"
    >
      <div className="page-stack">
        <form className="form-grid fitness-entry-grid fitness-entry-grid-exercise" onSubmit={(event) => { event.preventDefault(); handleCreate(); }}>
          <DatePickerField
            label="记录日期"
            value={form.date}
            onChange={(value) => setForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
          />
          <SelectField
            label="运动类型"
            value={form.exerciseType}
            onChange={(event) => setForm((previous) => ({ ...previous, exerciseType: event.target.value as ExerciseType }))}
          >
            {Object.entries(EXERCISE_TYPE_META).map(([value, item]) => (
              <option key={value} value={value}>{item.label}</option>
            ))}
          </SelectField>
          <div className="fitness-name-ai-cell">
            <Field
              label="运动名称"
              placeholder="例如：跑步机间歇跑"
              value={form.exerciseName}
              onChange={(event) => setForm((previous) => ({ ...previous, exerciseName: event.target.value }))}
            />
            <Btn
              tone="secondary"
              type="button"
              className="fitness-ai-btn"
              onClick={() => {
                void handleAiQuery();
              }}
              disabled={aiQuerying || !form.exerciseName.trim()}
            >
              {aiQuerying ? 'AI 估算中…' : 'AI 估算消耗'}
            </Btn>
          </div>
          {aiHint ? (
            <div className="fitness-ai-result">
              <span className={`fitness-ai-result-tag ${aiSource === 'cache' ? 'is-cache' : 'is-ai'}`.trim()}>
                {aiSource === 'cache' ? '命中缓存' : 'AI 实时估算'}
              </span>
              <span className="fitness-ai-result-text">{aiHint}</span>
            </div>
          ) : null}
          <Field
            label="训练时长（分钟）"
            type="number"
            min="1"
            value={form.duration}
            onChange={(event) => setForm((previous) => ({ ...previous, duration: event.target.value }))}
          />
          <Field
            label="消耗热量（kcal）"
            type="number"
            min="0"
            value={form.calories}
            onChange={(event) => setForm((previous) => ({ ...previous, calories: event.target.value }))}
          />
          <SelectField
            label="训练强度"
            value={form.intensity}
            onChange={(event) => setForm((previous) => ({ ...previous, intensity: event.target.value as IntensityLevel }))}
          >
            {Object.entries(INTENSITY_LEVEL_META).map(([value, item]) => (
              <option key={value} value={value}>{item.label}</option>
            ))}
          </SelectField>
          <div className="fitness-save-cell">
            <Btn tone="primary" type="submit">新增运动记录</Btn>
          </div>
        </form>

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
            共 {filteredRecords.length} 条运动记录
          </span>
        </div>

        {filteredRecords.length ? (
          <>
            <DataTable columns={columns} data={pageRecords} rowKey="id" />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无运动记录"
            description="先录入一条训练数据，这里会展示可筛选和可编辑的列表。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title="编辑运动记录"
        width={760}
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
            <SelectField
              label="运动类型"
              value={editingForm.exerciseType}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, exerciseType: event.target.value as ExerciseType }))}
            >
              {Object.entries(EXERCISE_TYPE_META).map(([value, item]) => (
                <option key={value} value={value}>{item.label}</option>
              ))}
            </SelectField>
            <Field
              label="运动名称"
              value={editingForm.exerciseName}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, exerciseName: event.target.value }))}
            />
            <Field
              label="训练时长（分钟）"
              type="number"
              min="1"
              value={editingForm.duration}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, duration: event.target.value }))}
            />
            <Field
              label="消耗热量（kcal）"
              type="number"
              min="0"
              value={editingForm.calories}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, calories: event.target.value }))}
            />
            <SelectField
              label="训练强度"
              value={editingForm.intensity}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, intensity: event.target.value as IntensityLevel }))}
            >
              {Object.entries(INTENSITY_LEVEL_META).map(([value, item]) => (
                <option key={value} value={value}>{item.label}</option>
              ))}
            </SelectField>
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

          onChangeRecords((previous) => deleteExerciseRecord(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('运动记录已删除。');
        }}
        title="确认删除这条运动记录？"
      >
        删除后，对应日期的热量消耗和训练频次分析都会同步刷新。
      </DeleteModal>
    </SectionCard>
  );
}
