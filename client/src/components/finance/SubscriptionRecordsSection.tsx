import { useEffect, useMemo, useState } from 'react';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, Checkbox, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag, TextArea } from '../ui';
import {
  SUBSCRIPTION_ALL_CATEGORIES,
  SUBSCRIPTION_PAGE_SIZE,
  calculateSubscriptionDurationText,
  createSubscriptionRecord,
  deleteSubscriptionRecord,
  filterSubscriptionRecords,
  formatSubscriptionAmount,
  getSubscriptionBillingCycleLabel,
  getSubscriptionStatus,
  getSubscriptionStatusLabel,
  updateSubscriptionRecord,
} from '../../services/subscription';
import type {
  SubscriptionCategory,
  SubscriptionPageState,
  SubscriptionRecord,
  SubscriptionRecordDraft,
  SubscriptionStatus,
} from '../../types/subscription';

interface SubscriptionRecordsSectionProps {
  records: SubscriptionRecord[];
  categories: SubscriptionCategory[];
  settings: SubscriptionPageState['settings'];
  onSettingsChange: (patch: Partial<SubscriptionPageState['settings']>) => void;
  onChangeRecords: (updater: (records: SubscriptionRecord[]) => SubscriptionRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface RecordFormState {
  serviceName: string;
  planName: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  cyclePrice: string;
  billingCycle: SubscriptionRecordDraft['billingCycle'];
  autoRenew: boolean;
  notes: string;
}

function createDefaultFormState(categories: SubscriptionCategory[]): RecordFormState {
  return {
    serviceName: '',
    planName: '',
    categoryId: categories[0]?.id ?? '',
    startDate: '',
    endDate: '',
    cyclePrice: '',
    billingCycle: 'monthly',
    autoRenew: true,
    notes: '',
  };
}

function buildFormState(record: SubscriptionRecord): RecordFormState {
  return {
    serviceName: record.serviceName,
    planName: record.planName,
    categoryId: record.categoryId,
    startDate: record.startDate,
    endDate: record.endDate,
    cyclePrice: String(record.cyclePrice),
    billingCycle: record.billingCycle,
    autoRenew: record.autoRenew,
    notes: record.notes,
  };
}

function parseDraft(form: RecordFormState): SubscriptionRecordDraft | null {
  const cyclePrice = Number(form.cyclePrice);

  if (!form.serviceName.trim() || !form.categoryId || !form.startDate || !form.endDate || !Number.isFinite(cyclePrice)) {
    return null;
  }

  return {
    serviceName: form.serviceName.trim(),
    planName: form.planName.trim(),
    categoryId: form.categoryId,
    startDate: form.startDate,
    endDate: form.endDate,
    cyclePrice,
    billingCycle: form.billingCycle,
    autoRenew: form.autoRenew,
    notes: form.notes.trim(),
  };
}

function getStatusTone(status: SubscriptionStatus): 'green' | 'orange' | 'red' {
  if (status === 'active') {
    return 'green';
  }

  if (status === 'upcoming') {
    return 'orange';
  }

  return 'red';
}

export function SubscriptionRecordsSection({
  records,
  categories,
  settings,
  onSettingsChange,
  onChangeRecords,
  showToast,
}: SubscriptionRecordsSectionProps) {
  const [form, setForm] = useState<RecordFormState>(() => createDefaultFormState(categories));
  const [editingRecord, setEditingRecord] = useState<SubscriptionRecord | null>(null);
  const [editingForm, setEditingForm] = useState<RecordFormState>(() => createDefaultFormState(categories));
  const [pendingDelete, setPendingDelete] = useState<SubscriptionRecord | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if ((!form.categoryId || !categories.some((category) => category.id === form.categoryId)) && categories[0]) {
      setForm((current) => ({ ...current, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId]);

  const filteredRecords = useMemo(
    () => filterSubscriptionRecords(records, {
      keyword: settings.recordsKeyword,
      categoryId: settings.recordsCategoryId,
      status: settings.recordsStatus,
      autoRenew: settings.recordsAutoRenewFilter,
      expiryStartDate: settings.recordsExpiryStartDate,
      expiryEndDate: settings.recordsExpiryEndDate,
      leadDays: settings.leadDays,
    }),
    [records, settings],
  );

  useEffect(() => {
    setPage(1);
  }, [
    settings.recordsKeyword,
    settings.recordsCategoryId,
    settings.recordsStatus,
    settings.recordsAutoRenewFilter,
    settings.recordsExpiryStartDate,
    settings.recordsExpiryEndDate,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / SUBSCRIPTION_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * SUBSCRIPTION_PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + SUBSCRIPTION_PAGE_SIZE);
  }, [filteredRecords, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const filteredSummary = useMemo(() => filteredRecords.reduce((summary, record) => {
    summary.total += record.cyclePrice;
    if (record.autoRenew) {
      summary.autoRenew += 1;
    }
    if (getSubscriptionStatus(record, settings.leadDays) === 'upcoming') {
      summary.upcoming += 1;
    }
    return summary;
  }, {
    total: 0,
    autoRenew: 0,
    upcoming: 0,
  }), [filteredRecords, settings.leadDays]);

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请先填写完整的订阅信息，并确保周期金额是有效数字。', 'error');
      return;
    }

    onChangeRecords((current) => createSubscriptionRecord(current, categories, draft));
    setForm(createDefaultFormState(categories));
    showToast('订阅记录已保存。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm);
    if (!draft) {
      showToast('请补齐编辑表单中的必填项。', 'error');
      return;
    }

    onChangeRecords((current) => updateSubscriptionRecord(current, categories, editingRecord.id, draft));
    setEditingRecord(null);
    showToast('订阅记录已更新。');
  };

  const handleDelete = () => {
    if (!pendingDelete) {
      return;
    }

    onChangeRecords((current) => deleteSubscriptionRecord(current, pendingDelete.id));
    setPendingDelete(null);
    showToast('订阅记录已删除。');
  };

  const openEditModal = (record: SubscriptionRecord) => {
    setEditingRecord(record);
    setEditingForm(buildFormState(record));
  };

  const editingCategoryMissing = Boolean(
    editingRecord
      && editingForm.categoryId
      && !categories.some((category) => category.id === editingForm.categoryId),
  );

  return (
    <SectionCard
      title="订阅记录"
      description="用紧凑的后台录入方式统一维护会员、软件和云服务订阅，列表状态会按提醒窗口自动判断。"
      action={<Tag tone="blue">共 {records.length} 条记录</Tag>}
    >
      <div className="page-stack">
        <div className="subscription-entry-grid">
          <Field
            label="服务名称"
            value={form.serviceName}
            onChange={(event) => setForm((current) => ({ ...current, serviceName: event.target.value }))}
            placeholder="例如 ChatGPT"
          />
          <Field
            label="方案名称"
            value={form.planName}
            onChange={(event) => setForm((current) => ({ ...current, planName: event.target.value }))}
            placeholder="例如 Plus"
          />
          <SelectField
            label="分类"
            value={form.categoryId}
            onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </SelectField>
          <DatePickerField
            label="开通时间"
            value={form.startDate}
            onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
          />
          <DatePickerField
            label="到期时间"
            value={form.endDate}
            onChange={(value) => setForm((current) => ({ ...current, endDate: value }))}
          />
          <Field
            label="周期金额"
            type="number"
            min="0"
            step="0.01"
            value={form.cyclePrice}
            onChange={(event) => setForm((current) => ({ ...current, cyclePrice: event.target.value }))}
            placeholder="0.00"
          />
          <SelectField
            label="计费周期"
            value={form.billingCycle}
            onChange={(event) => setForm((current) => ({ ...current, billingCycle: event.target.value as RecordFormState['billingCycle'] }))}
          >
            <option value="monthly">月付</option>
            <option value="quarterly">季付</option>
            <option value="yearly">年付</option>
            <option value="one_time">一次性</option>
          </SelectField>
          <label className="subscription-toggle-field">
            <span className="field-label">续费设置</span>
            <Checkbox
              checked={form.autoRenew}
              onChange={(checked) => setForm((current) => ({ ...current, autoRenew: checked }))}
            >
              自动续费
            </Checkbox>
          </label>
          <div className="subscription-entry-action">
            <Btn tone="primary" onClick={handleCreate}>保存订阅记录</Btn>
          </div>
        </div>

        <TextArea
          label="备注"
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="可记录取消原因、预算备注或替代方案"
        />

        <div className="subscription-filter-grid">
          <Field
            label="关键词"
            value={settings.recordsKeyword}
            onChange={(event) => onSettingsChange({ recordsKeyword: event.target.value })}
            placeholder="搜索服务名、方案名、分类或备注"
          />
          <SelectField
            label="分类筛选"
            value={settings.recordsCategoryId}
            onChange={(event) => onSettingsChange({ recordsCategoryId: event.target.value })}
          >
            <option value={SUBSCRIPTION_ALL_CATEGORIES}>全部分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </SelectField>
          <SelectField
            label="状态"
            value={settings.recordsStatus}
            onChange={(event) => onSettingsChange({ recordsStatus: event.target.value as SubscriptionPageState['settings']['recordsStatus'] })}
          >
            <option value="all">全部状态</option>
            <option value="active">进行中</option>
            <option value="upcoming">即将到期</option>
            <option value="expired">已过期</option>
          </SelectField>
          <SelectField
            label="续费方式"
            value={settings.recordsAutoRenewFilter}
            onChange={(event) => onSettingsChange({ recordsAutoRenewFilter: event.target.value as SubscriptionPageState['settings']['recordsAutoRenewFilter'] })}
          >
            <option value="all">全部</option>
            <option value="auto">自动续费</option>
            <option value="manual">手动续费</option>
          </SelectField>
          <DatePickerField
            label="到期开始"
            value={settings.recordsExpiryStartDate}
            onChange={(value) => onSettingsChange({ recordsExpiryStartDate: value })}
            clearable
          />
          <DatePickerField
            label="到期结束"
            value={settings.recordsExpiryEndDate}
            onChange={(value) => onSettingsChange({ recordsExpiryEndDate: value })}
            clearable
          />
        </div>

        <StatGrid
          className="subscription-records-summary"
          items={[
            { label: '当前筛选结果', value: `${filteredRecords.length} 条` },
            { label: '自动续费数', value: `${filteredSummary.autoRenew} 条` },
            { label: '即将到期数', value: `${filteredSummary.upcoming} 条` },
            { label: '周期金额合计', value: formatSubscriptionAmount(filteredSummary.total) },
          ]}
        />

        {filteredRecords.length ? (
          <>
            <DataTable
              data={pageRecords}
              rowKey="id"
              columns={[
                { key: 'serviceName', title: '服务名称', dataIndex: 'serviceName' },
                { key: 'planName', title: '方案名称', dataIndex: 'planName', render: (value) => String(value || '-') },
                { key: 'categoryName', title: '分类', dataIndex: 'categoryName' },
                { key: 'startDate', title: '开通时间', dataIndex: 'startDate' },
                { key: 'endDate', title: '到期时间', dataIndex: 'endDate' },
                {
                  key: 'duration',
                  title: '开通时长',
                  render: (_, row) => calculateSubscriptionDurationText(row),
                },
                {
                  key: 'cyclePrice',
                  title: '周期金额',
                  align: 'right',
                  render: (_, row) => formatSubscriptionAmount(row.cyclePrice),
                },
                {
                  key: 'billingCycle',
                  title: '计费周期',
                  render: (_, row) => getSubscriptionBillingCycleLabel(row.billingCycle),
                },
                {
                  key: 'autoRenew',
                  title: '自动续费',
                  render: (_, row) => <Tag tone={row.autoRenew ? 'green' : 'default'}>{row.autoRenew ? '自动' : '手动'}</Tag>,
                },
                {
                  key: 'status',
                  title: '当前状态',
                  render: (_, row) => {
                    const status = getSubscriptionStatus(row, settings.leadDays);
                    return <Tag tone={getStatusTone(status)}>{getSubscriptionStatusLabel(status)}</Tag>;
                  },
                },
                {
                  key: 'notes',
                  title: '备注',
                  render: (_, row) => row.notes || '-',
                },
                {
                  key: 'actions',
                  title: '操作',
                  render: (_, row) => (
                    <div className="table-actions">
                      <Btn tone="ghost" onClick={() => openEditModal(row)}>编辑</Btn>
                      <Btn tone="ghost" onClick={() => setPendingDelete(row)}>删除</Btn>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无符合条件的订阅记录"
            description="可以先新增一条订阅，或者放宽筛选条件后再查看。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title={editingRecord ? `编辑订阅：${editingRecord.serviceName}` : '编辑订阅'}
        width={860}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingRecord(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="subscription-modal-grid">
          <Field
            label="服务名称"
            value={editingForm.serviceName}
            onChange={(event) => setEditingForm((current) => ({ ...current, serviceName: event.target.value }))}
          />
          <Field
            label="方案名称"
            value={editingForm.planName}
            onChange={(event) => setEditingForm((current) => ({ ...current, planName: event.target.value }))}
          />
          <SelectField
            label="分类"
            value={editingForm.categoryId}
            onChange={(event) => setEditingForm((current) => ({ ...current, categoryId: event.target.value }))}
          >
            {editingCategoryMissing ? (
              <option value={editingForm.categoryId}>
                {editingRecord?.categoryName ?? '原分类'}
              </option>
            ) : null}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </SelectField>
          <DatePickerField
            label="开通时间"
            value={editingForm.startDate}
            onChange={(value) => setEditingForm((current) => ({ ...current, startDate: value }))}
          />
          <DatePickerField
            label="到期时间"
            value={editingForm.endDate}
            onChange={(value) => setEditingForm((current) => ({ ...current, endDate: value }))}
          />
          <Field
            label="周期金额"
            type="number"
            min="0"
            step="0.01"
            value={editingForm.cyclePrice}
            onChange={(event) => setEditingForm((current) => ({ ...current, cyclePrice: event.target.value }))}
          />
          <SelectField
            label="计费周期"
            value={editingForm.billingCycle}
            onChange={(event) => setEditingForm((current) => ({ ...current, billingCycle: event.target.value as RecordFormState['billingCycle'] }))}
          >
            <option value="monthly">月付</option>
            <option value="quarterly">季付</option>
            <option value="yearly">年付</option>
            <option value="one_time">一次性</option>
          </SelectField>
          <label className="subscription-toggle-field">
            <span className="field-label">续费设置</span>
            <Checkbox
              checked={editingForm.autoRenew}
              onChange={(checked) => setEditingForm((current) => ({ ...current, autoRenew: checked }))}
            >
              自动续费
            </Checkbox>
          </label>
          <div className="subscription-duration-callout callout callout-neutral">
            当前累计开通时长：{editingRecord ? calculateSubscriptionDurationText({
              startDate: editingForm.startDate,
              endDate: editingForm.endDate,
            }) : '0 天'}
          </div>
        </div>

        <TextArea
          label="备注"
          value={editingForm.notes}
          onChange={(event) => setEditingForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="记录续费说明、预算考虑或停用原因"
        />
      </Modal>

      <DeleteModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={pendingDelete ? `删除订阅：${pendingDelete.serviceName}` : '删除订阅'}
      >
        删除后将移除这条订阅记录，但不会影响分类管理中的其他数据。
      </DeleteModal>
    </SectionCard>
  );
}
