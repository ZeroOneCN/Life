import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag, TextArea } from '../ui';
import {
  CHECKUP_RECORD_PAGE_SIZE,
  CHECKUP_STATUS_META,
  buildCheckupTrend,
  filterCheckupRecordsByUserId,
  normalizeCheckupUserId,
} from '../../services/checkup';
import type { CheckupRecord, CheckupRecordDraft, CheckupStatus } from '../../types/checkup';

interface CheckupRecordsSectionProps {
  currentUserLabel: string;
  activeUserId: string;
  filterUserId: string;
  trendUserId: string;
  records: CheckupRecord[];
  onFilterUserIdChange: (value: string) => void;
  onTrendUserIdChange: (value: string) => void;
  onCreateRecord: (draft: CheckupRecordDraft) => void;
  onUpdateRecord: (id: string, draft: CheckupRecordDraft) => void;
  onDeleteRecord: (id: string) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface RecordFormState {
  testDate: string;
  testType: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  followUpDate: string;
  status: '' | CheckupStatus;
  notes: string;
}

const tooltipStyle = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

function createDefaultFormState(): RecordFormState {
  return {
    testDate: dayjs().format('YYYY-MM-DD'),
    testType: '生化检查',
    testName: '',
    value: '',
    unit: 'mmol/L',
    referenceRange: '',
    followUpDate: '',
    status: '',
    notes: '',
  };
}

function buildFormState(record: CheckupRecord): RecordFormState {
  return {
    testDate: record.testDate,
    testType: record.testType,
    testName: record.testName,
    value: String(record.value),
    unit: record.unit,
    referenceRange: record.referenceRange,
    followUpDate: record.followUpDate ?? '',
    status: record.status,
    notes: record.notes,
  };
}

function parseDraft(form: RecordFormState, userId: string): CheckupRecordDraft | null {
  const normalizedUserId = normalizeCheckupUserId(userId);
  const numericValue = Number(form.value);

  if (!normalizedUserId || !form.testName.trim() || !form.testType.trim() || !dayjs(form.testDate).isValid()) {
    return null;
  }

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  if (form.followUpDate && !dayjs(form.followUpDate).isValid()) {
    return null;
  }

  return {
    userId: normalizedUserId,
    testDate: form.testDate,
    testType: form.testType.trim(),
    testName: form.testName.trim(),
    value: numericValue,
    unit: form.unit.trim(),
    referenceRange: form.referenceRange.trim(),
    followUpDate: form.followUpDate || '',
    status: form.status,
    notes: form.notes.trim(),
  };
}

export function CheckupRecordsSection({
  currentUserLabel,
  activeUserId,
  filterUserId,
  trendUserId,
  records,
  onFilterUserIdChange,
  onTrendUserIdChange,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord,
  showToast,
}: CheckupRecordsSectionProps) {
  const [form, setForm] = useState<RecordFormState>(createDefaultFormState);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CheckupStatus>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<CheckupRecord | null>(null);
  const [editingForm, setEditingForm] = useState<RecordFormState>(createDefaultFormState);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [trendTestName, setTrendTestName] = useState('');
  const [trendStartDate, setTrendStartDate] = useState('');
  const [trendEndDate, setTrendEndDate] = useState('');

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return filterCheckupRecordsByUserId(records, filterUserId)
      .filter((record) => statusFilter === 'all' || record.status === statusFilter)
      .filter((record) => (!startDate || record.testDate >= startDate))
      .filter((record) => (!endDate || record.testDate <= endDate))
      .filter((record) => {
        if (!normalizedKeyword) {
          return true;
        }

        return [
          record.userId,
          record.testType,
          record.testName,
          record.notes,
          record.referenceRange,
        ].some((value) => value.toLowerCase().includes(normalizedKeyword));
      });
  }, [endDate, filterUserId, keyword, records, startDate, statusFilter]);

  const trendTestOptions = useMemo(() => {
    const sourceRecords = filterCheckupRecordsByUserId(records, trendUserId);
    return Array.from(new Set(sourceRecords.map((record) => record.testName))).filter(Boolean);
  }, [records, trendUserId]);

  useEffect(() => {
    if (!trendTestOptions.length) {
      setTrendTestName('');
      return;
    }

    if (!trendTestName || !trendTestOptions.includes(trendTestName)) {
      setTrendTestName(trendTestOptions[0]);
    }
  }, [trendTestName, trendTestOptions]);

  useEffect(() => {
    setPage(1);
  }, [endDate, filterUserId, keyword, startDate, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / CHECKUP_RECORD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * CHECKUP_RECORD_PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + CHECKUP_RECORD_PAGE_SIZE);
  }, [filteredRecords, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const trendData = useMemo(() => buildCheckupTrend(records, {
    userId: trendUserId,
    testName: trendTestName,
    startDate: trendStartDate,
    endDate: trendEndDate,
  }), [records, trendEndDate, trendStartDate, trendTestName, trendUserId]);

  const columns = useMemo(() => [
    {
      key: 'testDate',
      title: '检查日期',
      dataIndex: 'testDate' as const,
    },
    {
      key: 'testType',
      title: '检查类型',
      dataIndex: 'testType' as const,
    },
    {
      key: 'testName',
      title: '项目',
      dataIndex: 'testName' as const,
    },
    {
      key: 'value',
      title: '结果',
      render: (_value: unknown, record: CheckupRecord) => `${record.value} ${record.unit}`.trim(),
    },
    {
      key: 'referenceRange',
      title: '参考范围',
      dataIndex: 'referenceRange' as const,
    },
    {
      key: 'status',
      title: '状态',
      render: (_value: unknown, record: CheckupRecord) => (
        <Tag tone={CHECKUP_STATUS_META[record.status].tone}>{CHECKUP_STATUS_META[record.status].label}</Tag>
      ),
    },
    {
      key: 'followUpDate',
      title: '复查日期',
      render: (_value: unknown, record: CheckupRecord) => record.followUpDate || '-',
    },
    {
      key: 'notes',
      title: '备注',
      render: (_value: unknown, record: CheckupRecord) => record.notes || '-',
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, record: CheckupRecord) => (
        <div className="fitness-row-actions">
          <Btn
            tone="secondary"
            onClick={() => {
              setEditingRecord(record);
              setEditingForm(buildFormState(record));
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
      showToast('请补全检查日期、检查类型、项目和结果数值。', 'error');
      return;
    }

    onCreateRecord(draft);
    setForm(createDefaultFormState());
    showToast('体检指标已新增。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm, editingRecord.userId);

    if (!draft) {
      showToast('请补全要保存的指标记录。', 'error');
      return;
    }

    onUpdateRecord(editingRecord.id, draft);
    setEditingRecord(null);
    setEditingForm(createDefaultFormState());
    showToast('体检指标已更新。');
  };

  return (
    <SectionCard
      title="指标记录"
      description="记录单条检查结果，支持按用户、状态、日期和关键词筛选，并查看单指标历史走势。"
    >
      <div className="page-stack">
        <div className="callout callout-info">
          当前录入用户为 <strong>{currentUserLabel}</strong>。新的体检指标会默认归属当前登录用户。
        </div>

        <form id="checkup-create-form" className="checkup-entry-grid" onSubmit={(event) => { event.preventDefault(); handleCreate(); }}>
          <DatePickerField
            label="检查日期"
            value={form.testDate}
            onChange={(value) => setForm((previous) => ({ ...previous, testDate: value }))}
            clearable={false}
          />
          <Field
            label="检查类型"
            value={form.testType}
            onChange={(event) => setForm((previous) => ({ ...previous, testType: event.target.value }))}
            placeholder="例如：年度体检"
          />
          <Field
            label="项目"
            value={form.testName}
            onChange={(event) => setForm((previous) => ({ ...previous, testName: event.target.value }))}
            placeholder="例如：空腹血糖"
          />
          <Field
            label="结果"
            type="number"
            step="0.01"
            value={form.value}
            onChange={(event) => setForm((previous) => ({ ...previous, value: event.target.value }))}
            placeholder="输入数值"
          />
          <Field
            label="单位"
            value={form.unit}
            onChange={(event) => setForm((previous) => ({ ...previous, unit: event.target.value }))}
            placeholder="例如：mmol/L"
          />
          <Field
            label="参考范围"
            value={form.referenceRange}
            onChange={(event) => setForm((previous) => ({ ...previous, referenceRange: event.target.value }))}
            placeholder="例如：3.9-6.1"
          />
          <DatePickerField
            label="复查日期"
            value={form.followUpDate}
            onChange={(value) => setForm((previous) => ({ ...previous, followUpDate: value }))}
            placeholder="可选"
          />
          <SelectField
            label="状态覆盖"
            value={form.status}
            onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value as '' | CheckupStatus }))}
          >
            <option value="">自动判断</option>
            <option value="normal">正常</option>
            <option value="attention">关注</option>
            <option value="abnormal">异常</option>
            <option value="unknown">待判断</option>
          </SelectField>
        </form>

        <div className="checkup-entry-footer">
          <TextArea
            label="备注"
            value={form.notes}
            onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
            placeholder="例如：医生建议三个月后复查"
          />
          <div className="fitness-form-actions">
            <span className="subtle-text">支持填写自动判定无法识别的自定义状态，并可补充复查日期。</span>
            <Btn tone="primary" type="submit" form="checkup-create-form">保存指标记录</Btn>
          </div>
        </div>

        <div className="checkup-filter-grid">
          <Field
            label="记录用户 ID"
            value={filterUserId}
            onChange={(event) => onFilterUserIdChange(event.target.value)}
            placeholder="留空查看全部用户"
          />
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索项目、类型、备注"
          />
          <SelectField
            label="状态筛选"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | CheckupStatus)}
          >
            <option value="all">全部状态</option>
            <option value="normal">正常</option>
            <option value="attention">关注</option>
            <option value="abnormal">异常</option>
            <option value="unknown">待判断</option>
          </SelectField>
          <DatePickerField label="开始日期" value={startDate} onChange={setStartDate} placeholder="不限" />
          <DatePickerField label="结束日期" value={endDate} onChange={setEndDate} placeholder="不限" />
        </div>

        <div className="step-records-toolbar">
          <span className="subtle-text">
            共 {filteredRecords.length} 条记录
            {filterUserId.trim() ? `，当前筛选用户：${filterUserId.trim()}` : '，当前显示全部用户'}
          </span>
        </div>

        {filteredRecords.length ? (
          <>
            <DataTable columns={columns} data={pageRecords} rowKey="id" />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无指标记录"
            description="先录入一条体检或化验结果，后续筛选、趋势和提醒才会生效。"
          />
        )}

        <div className="fitness-chart-card">
          <div className="fitness-chart-header">
            <strong>单指标趋势</strong>
            <span>按用户、项目和日期范围查看历史变化。</span>
          </div>
          <div className="checkup-filter-grid">
            <Field
              label="趋势用户 ID"
              value={trendUserId}
              onChange={(event) => onTrendUserIdChange(event.target.value)}
              placeholder="留空查看全部用户"
            />
            <SelectField
              label="指标项目"
              value={trendTestName}
              onChange={(event) => setTrendTestName(event.target.value)}
              disabled={!trendTestOptions.length}
            >
              {trendTestOptions.length ? trendTestOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              )) : <option value="">暂无可选项目</option>}
            </SelectField>
            <DatePickerField label="趋势开始日期" value={trendStartDate} onChange={setTrendStartDate} placeholder="不限" />
            <DatePickerField label="趋势结束日期" value={trendEndDate} onChange={setTrendEndDate} placeholder="不限" />
          </div>

          {trendData.length ? (
            <div className="fitness-chart-shell">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, _name, payload) => {
                      const point = payload?.payload as { status?: CheckupStatus } | undefined;
                      const statusLabel = point?.status ? CHECKUP_STATUS_META[point.status].label : '未知';
                      return [`${Number(value ?? 0).toFixed(2)}`, `状态：${statusLabel}`];
                    }}
                    labelFormatter={(label) => `日期：${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--color-primary)' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="暂无趋势数据"
              description="请选择存在记录的指标项目，或调整趋势筛选范围。"
            />
          )}
        </div>
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => {
          setEditingRecord(null);
          setEditingForm(createDefaultFormState());
        }}
        title={editingRecord ? `编辑指标：${editingRecord.testName}` : '编辑指标'}
        width={880}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => {
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
        <div className="checkup-entry-grid">
          <DatePickerField
            label="检查日期"
            value={editingForm.testDate}
            onChange={(value) => setEditingForm((previous) => ({ ...previous, testDate: value }))}
            clearable={false}
          />
          <Field
            label="检查类型"
            value={editingForm.testType}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, testType: event.target.value }))}
          />
          <Field
            label="项目"
            value={editingForm.testName}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, testName: event.target.value }))}
          />
          <Field
            label="结果"
            type="number"
            step="0.01"
            value={editingForm.value}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, value: event.target.value }))}
          />
          <Field
            label="单位"
            value={editingForm.unit}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, unit: event.target.value }))}
          />
          <Field
            label="参考范围"
            value={editingForm.referenceRange}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, referenceRange: event.target.value }))}
          />
          <DatePickerField
            label="复查日期"
            value={editingForm.followUpDate}
            onChange={(value) => setEditingForm((previous) => ({ ...previous, followUpDate: value }))}
            placeholder="可选"
          />
          <SelectField
            label="状态覆盖"
            value={editingForm.status}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, status: event.target.value as '' | CheckupStatus }))}
          >
            <option value="">自动判断</option>
            <option value="normal">正常</option>
            <option value="attention">关注</option>
            <option value="abnormal">异常</option>
            <option value="unknown">待判断</option>
          </SelectField>
        </div>
        <TextArea
          label="备注"
          value={editingForm.notes}
          onChange={(event) => setEditingForm((previous) => ({ ...previous, notes: event.target.value }))}
          placeholder="补充复查建议或结论摘要"
        />
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
          showToast('体检指标已删除。');
        }}
        title="删除这条指标记录？"
      >
        删除后将无法恢复，该条记录关联的趋势和提醒判断也会同步失效。
      </DeleteModal>
    </SectionCard>
  );
}
