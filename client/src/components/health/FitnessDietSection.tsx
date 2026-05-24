import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { DataTable, Btn, DeleteModal, Field, Modal, Pagination, SelectField } from '../ui';
import { EmptyState, SectionCard } from '../page';
import {
  FITNESS_RECORD_PAGE_SIZE,
  MEAL_TYPE_META,
  createDietRecord,
  deleteDietRecord,
  filterRecordsByUserId,
  normalizeFitnessUserId,
  updateDietRecord,
} from '../../services/fitness';
import type { DietRecord, DietRecordDraft, MealType } from '../../types/fitness';

interface FitnessDietSectionProps {
  activeUserId: string;
  filterUserId: string;
  records: DietRecord[];
  onFilterUserIdChange: (value: string) => void;
  onChangeRecords: (updater: (records: DietRecord[]) => DietRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface DietFormState {
  date: string;
  mealType: MealType;
  foodName: string;
  grams: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

const defaultFormState = (): DietFormState => ({
  date: dayjs().format('YYYY-MM-DD'),
  mealType: 'breakfast',
  foodName: '',
  grams: '100',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
});

function parseDraft(form: DietFormState, userId: string): DietRecordDraft | null {
  const normalizedUserId = normalizeFitnessUserId(userId);
  const grams = Number(form.grams);
  const calories = Number(form.calories);
  const protein = Number(form.protein || 0);
  const carbs = Number(form.carbs || 0);
  const fat = Number(form.fat || 0);

  if (!normalizedUserId || !form.foodName.trim() || !dayjs(form.date).isValid()) {
    return null;
  }

  if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(calories) || calories <= 0) {
    return null;
  }

  return {
    userId: normalizedUserId,
    date: form.date,
    mealType: form.mealType,
    foodName: form.foodName.trim(),
    grams,
    calories,
    protein: Number.isFinite(protein) ? protein : 0,
    carbs: Number.isFinite(carbs) ? carbs : 0,
    fat: Number.isFinite(fat) ? fat : 0,
  };
}

export function FitnessDietSection({
  activeUserId,
  filterUserId,
  records,
  onFilterUserIdChange,
  onChangeRecords,
  showToast,
}: FitnessDietSectionProps) {
  const [form, setForm] = useState<DietFormState>(defaultFormState);
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<DietRecord | null>(null);
  const [editingForm, setEditingForm] = useState<DietFormState>(defaultFormState);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
    {
      key: 'date',
      title: '日期',
      dataIndex: 'date' as const,
    },
    {
      key: 'mealType',
      title: '餐别',
      render: (_value: unknown, record: DietRecord) => (
        <span style={{ color: MEAL_TYPE_META[record.mealType].color }}>{MEAL_TYPE_META[record.mealType].label}</span>
      ),
    },
    {
      key: 'foodName',
      title: '食物名称',
      dataIndex: 'foodName' as const,
    },
    {
      key: 'grams',
      title: '重量',
      render: (_value: unknown, record: DietRecord) => `${record.grams} g`,
    },
    {
      key: 'calories',
      title: '热量',
      render: (_value: unknown, record: DietRecord) => `${record.calories} kcal`,
    },
    {
      key: 'protein',
      title: '蛋白质',
      render: (_value: unknown, record: DietRecord) => `${record.protein} g`,
    },
    {
      key: 'carbs',
      title: '碳水',
      render: (_value: unknown, record: DietRecord) => `${record.carbs} g`,
    },
    {
      key: 'fat',
      title: '脂肪',
      render: (_value: unknown, record: DietRecord) => `${record.fat} g`,
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, record: DietRecord) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingRecord(record);
              setEditingForm({
                date: record.date,
                mealType: record.mealType,
                foodName: record.foodName,
                grams: String(record.grams),
                calories: String(record.calories),
                protein: String(record.protein),
                carbs: String(record.carbs),
                fat: String(record.fat),
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
      showToast('请补全饮食记录的用户、日期、食物、重量和热量。', 'error');
      return;
    }

    onChangeRecords((previous) => createDietRecord(previous, draft));
    setForm(defaultFormState());
    showToast('饮食记录已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm, editingRecord.userId);

    if (!draft) {
      showToast('请补全要保存的饮食记录。', 'error');
      return;
    }

    onChangeRecords((previous) => updateDietRecord(previous, editingRecord.id, draft));
    setEditingRecord(null);
    setEditingForm(defaultFormState());
    showToast('饮食记录已更新。');
  };

  return (
    <SectionCard
      title="饮食记录"
      description="记录每日进食结构、热量和三大营养素，用于看板和健康建议分析。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          当前新增用户：<strong>{normalizeFitnessUserId(activeUserId) || '未设置'}</strong>。如需切换记账对象，请先在页面顶部修改当前用户 ID。
        </div>

        <div className="form-grid fitness-entry-grid fitness-entry-grid-diet">
          <DatePickerField
            label="记录日期"
            value={form.date}
            onChange={(value) => setForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
          />
          <SelectField
            label="餐别"
            value={form.mealType}
            onChange={(event) => setForm((previous) => ({ ...previous, mealType: event.target.value as MealType }))}
          >
            {Object.entries(MEAL_TYPE_META).map(([value, item]) => (
              <option key={value} value={value}>{item.label}</option>
            ))}
          </SelectField>
          <Field
            label="食物名称"
            placeholder="例如：鸡胸肉沙拉"
            value={form.foodName}
            onChange={(event) => setForm((previous) => ({ ...previous, foodName: event.target.value }))}
          />
          <Field
            label="重量（g）"
            type="number"
            min="1"
            value={form.grams}
            onChange={(event) => setForm((previous) => ({ ...previous, grams: event.target.value }))}
          />
          <Field
            label="热量（kcal）"
            type="number"
            min="0"
            value={form.calories}
            onChange={(event) => setForm((previous) => ({ ...previous, calories: event.target.value }))}
          />
          <Field
            label="蛋白质（g）"
            type="number"
            min="0"
            step="0.1"
            value={form.protein}
            onChange={(event) => setForm((previous) => ({ ...previous, protein: event.target.value }))}
          />
          <Field
            label="碳水（g）"
            type="number"
            min="0"
            step="0.1"
            value={form.carbs}
            onChange={(event) => setForm((previous) => ({ ...previous, carbs: event.target.value }))}
          />
          <Field
            label="脂肪（g）"
            type="number"
            min="0"
            step="0.1"
            value={form.fat}
            onChange={(event) => setForm((previous) => ({ ...previous, fat: event.target.value }))}
          />
        </div>

        <div className="fitness-form-actions">
          <Btn tone="primary" onClick={handleCreate}>新增饮食记录</Btn>
          <span className="subtle-text">这一页不再依赖食物数据库或 AI 查询，请直接录入你需要的营养数据。</span>
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
            hint="留空时显示该用户的全部饮食记录。"
          />
        </div>

        <div className="fitness-section-summary">
          <span className="subtle-text">
            共 {filteredRecords.length} 条饮食记录
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
            title="暂无饮食记录"
            description="先录入一条饮食数据，这里会展示可筛选和可编辑的列表。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title="编辑饮食记录"
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
              label="餐别"
              value={editingForm.mealType}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, mealType: event.target.value as MealType }))}
            >
              {Object.entries(MEAL_TYPE_META).map(([value, item]) => (
                <option key={value} value={value}>{item.label}</option>
              ))}
            </SelectField>
            <Field
              label="食物名称"
              value={editingForm.foodName}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, foodName: event.target.value }))}
            />
            <Field
              label="重量（g）"
              type="number"
              min="1"
              value={editingForm.grams}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, grams: event.target.value }))}
            />
            <Field
              label="热量（kcal）"
              type="number"
              min="0"
              value={editingForm.calories}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, calories: event.target.value }))}
            />
            <Field
              label="蛋白质（g）"
              type="number"
              min="0"
              step="0.1"
              value={editingForm.protein}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, protein: event.target.value }))}
            />
            <Field
              label="碳水（g）"
              type="number"
              min="0"
              step="0.1"
              value={editingForm.carbs}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, carbs: event.target.value }))}
            />
            <Field
              label="脂肪（g）"
              type="number"
              min="0"
              step="0.1"
              value={editingForm.fat}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, fat: event.target.value }))}
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

          onChangeRecords((previous) => deleteDietRecord(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('饮食记录已删除。');
        }}
        title="确认删除这条饮食记录？"
      >
        删除后，对应日期的热量统计、营养占比和成本分析都会同步刷新。
      </DeleteModal>
    </SectionCard>
  );
}
