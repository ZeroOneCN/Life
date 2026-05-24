import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, Tag, TextArea } from '../ui';
import {
  TRAVEL_ALL_BOOKS,
  TRAVEL_RECORD_PAGE_SIZE,
  TRAVEL_TIME_OPTIONS,
  calculateTravelDurationMinutes,
  createTravelExpense,
  deleteTravelExpense,
  filterTravelRecords,
  formatTravelAmount,
  formatTravelDuration,
  getTravelCategoryLabel,
  getTravelPayChannelLabel,
  normalizeTravelUserId,
  updateTravelBook,
  updateTravelExpense,
} from '../../services/travel';
import type { TravelBook, TravelCategory, TravelExpenseDraft, TravelExpenseRecord, TravelPayChannel } from '../../types/travel';

interface TravelDetailsSectionProps {
  activeUserId: string;
  activeBookId: string;
  detailsBookId: string;
  books: TravelBook[];
  records: TravelExpenseRecord[];
  payChannels: TravelPayChannel[];
  onDetailsBookIdChange: (bookId: string) => void;
  onChangeBooks: (updater: (books: TravelBook[]) => TravelBook[]) => void;
  onChangeRecords: (updater: (records: TravelExpenseRecord[]) => TravelExpenseRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface TravelExpenseFormState {
  userId: string;
  bookId: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  category: TravelCategory;
  title: string;
  amount: string;
  discountAmount: string;
  discountNote: string;
  vehicleInfo: string;
  payChannel: string;
  remark: string;
}

const CATEGORY_OPTIONS: TravelCategory[] = ['transport', 'hotel', 'food', 'ticket', 'shopping', 'other'];

function createDefaultFormState(activeUserId: string, activeBookId: string, payChannels: TravelPayChannel[]): TravelExpenseFormState {
  return {
    userId: activeUserId,
    bookId: activeBookId,
    date: dayjs().format('YYYY-MM-DD'),
    timeStart: '09:00',
    timeEnd: '10:00',
    category: 'transport',
    title: '',
    amount: '',
    discountAmount: '',
    discountNote: '',
    vehicleInfo: '',
    payChannel: payChannels[0]?.value ?? 'ALIPAY',
    remark: '',
  };
}

function buildFormState(record: TravelExpenseRecord): TravelExpenseFormState {
  return {
    userId: record.userId,
    bookId: record.bookId,
    date: record.date,
    timeStart: record.timeStart,
    timeEnd: record.timeEnd,
    category: record.category,
    title: record.title,
    amount: String(record.amount),
    discountAmount: record.discountAmount ? String(record.discountAmount) : '',
    discountNote: record.discountNote,
    vehicleInfo: record.vehicleInfo,
    payChannel: record.payChannel,
    remark: record.remark,
  };
}

function parseDraft(form: TravelExpenseFormState): TravelExpenseDraft | null {
  const userId = normalizeTravelUserId(form.userId);
  const amount = Number(form.amount);
  const discountAmount = form.discountAmount ? Number(form.discountAmount) : 0;

  if (!userId || !form.bookId || !dayjs(form.date).isValid() || !form.title.trim()) {
    return null;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (form.discountAmount && (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > amount)) {
    return null;
  }

  return {
    userId,
    bookId: form.bookId,
    date: form.date,
    timeStart: form.timeStart,
    timeEnd: form.timeEnd,
    category: form.category,
    title: form.title.trim(),
    amount,
    discountAmount,
    discountNote: form.discountNote.trim(),
    vehicleInfo: form.vehicleInfo.trim(),
    payChannel: form.payChannel,
    remark: form.remark.trim(),
  };
}

export function TravelDetailsSection({
  activeUserId,
  activeBookId,
  detailsBookId,
  books,
  records,
  payChannels,
  onDetailsBookIdChange,
  onChangeBooks,
  onChangeRecords,
  showToast,
}: TravelDetailsSectionProps) {
  const [form, setForm] = useState<TravelExpenseFormState>(() => createDefaultFormState(activeUserId, activeBookId, payChannels));
  const [editingRecord, setEditingRecord] = useState<TravelExpenseRecord | null>(null);
  const [editingForm, setEditingForm] = useState<TravelExpenseFormState>(() => createDefaultFormState(activeUserId, activeBookId, payChannels));
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [payChannelFilter, setPayChannelFilter] = useState('');
  const [summaryDraft, setSummaryDraft] = useState('');

  useEffect(() => {
    setForm((previous) => ({
      ...previous,
      userId: activeUserId,
      bookId: activeBookId,
      payChannel: previous.payChannel || payChannels[0]?.value || 'ALIPAY',
    }));
  }, [activeBookId, activeUserId, payChannels]);

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId) ?? null,
    [books, activeBookId],
  );

  const selectedBook = useMemo(
    () => books.find((book) => book.id === detailsBookId) ?? null,
    [books, detailsBookId],
  );

  useEffect(() => {
    setSummaryDraft(selectedBook?.summary ?? '');
  }, [selectedBook]);

  const filteredRecords = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return filterTravelRecords(records, activeUserId, detailsBookId)
      .filter((record) => (!startDate || !dayjs(record.date).isBefore(startDate, 'day')))
      .filter((record) => (!endDate || !dayjs(record.date).isAfter(endDate, 'day')))
      .filter((record) => (!categoryFilter || record.category === categoryFilter))
      .filter((record) => (!payChannelFilter || record.payChannel === payChannelFilter))
      .filter((record) => {
        if (!normalizedKeyword) {
          return true;
        }

        return [
          record.title,
          record.discountNote,
          record.vehicleInfo,
          record.remark,
          getTravelPayChannelLabel(record.payChannel, payChannels),
        ].some((value) => value.toLowerCase().includes(normalizedKeyword));
      });
  }, [records, activeUserId, detailsBookId, startDate, endDate, categoryFilter, payChannelFilter, keyword, payChannels]);

  useEffect(() => {
    setPage(1);
  }, [detailsBookId, startDate, endDate, categoryFilter, payChannelFilter, keyword]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / TRAVEL_RECORD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * TRAVEL_RECORD_PAGE_SIZE;
    return filteredRecords.slice(startIndex, startIndex + TRAVEL_RECORD_PAGE_SIZE);
  }, [filteredRecords, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const totalAmount = filteredRecords.reduce((sum, record) => sum + record.amount, 0);
    const totalSaved = filteredRecords.reduce((sum, record) => sum + record.discountAmount, 0);

    return {
      count: filteredRecords.length,
      totalAmount,
      totalSaved,
      totalPaidAmount: totalAmount - totalSaved < 0 ? 0 : totalAmount - totalSaved,
    };
  }, [filteredRecords]);

  const columns = useMemo(() => [
    { key: 'date', title: '日期', dataIndex: 'date' as const },
    {
      key: 'timeRange',
      title: '时间段',
      render: (_value: unknown, row: TravelExpenseRecord) => `${row.timeStart} - ${row.timeEnd}`,
    },
    {
      key: 'duration',
      title: '时长',
      render: (_value: unknown, row: TravelExpenseRecord) => formatTravelDuration(row.durationMinutes),
    },
    {
      key: 'category',
      title: '分类',
      render: (_value: unknown, row: TravelExpenseRecord) => getTravelCategoryLabel(row.category),
    },
    { key: 'title', title: '项目', dataIndex: 'title' as const },
    {
      key: 'amount',
      title: '原价 / 实付 / 优惠',
      render: (_value: unknown, row: TravelExpenseRecord) => (
        <div className="travel-amount-stack">
          <strong>{formatTravelAmount(row.amount - row.discountAmount < 0 ? 0 : row.amount - row.discountAmount)}</strong>
          <span>{formatTravelAmount(row.amount)} / 优惠 {formatTravelAmount(row.discountAmount)}</span>
        </div>
      ),
    },
    {
      key: 'vehicleInfo',
      title: '交通信息',
      render: (_value: unknown, row: TravelExpenseRecord) => row.vehicleInfo || '-',
    },
    {
      key: 'payChannel',
      title: '支付方式',
      render: (_value: unknown, row: TravelExpenseRecord) => getTravelPayChannelLabel(row.payChannel, payChannels),
    },
    {
      key: 'remark',
      title: '备注',
      render: (_value: unknown, row: TravelExpenseRecord) => row.remark || '-',
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: TravelExpenseRecord) => (
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
  ], [payChannels]);

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全用户 ID、账本、日期、时间段、项目和金额。', 'error');
      return;
    }

    onChangeRecords((previous) => createTravelExpense(previous, draft));
    setForm(createDefaultFormState(activeUserId, activeBookId, payChannels));
    showToast('旅行消费记录已保存。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全要保存的旅行消费信息。', 'error');
      return;
    }

    onChangeRecords((previous) => updateTravelExpense(previous, editingRecord.id, draft));
    setEditingRecord(null);
    setEditingForm(createDefaultFormState(activeUserId, activeBookId, payChannels));
    showToast('旅行消费记录已更新。');
  };

  const handleSaveSummary = () => {
    if (!selectedBook) {
      showToast('请先选择一个具体行程账本，再保存总结。', 'error');
      return;
    }

    onChangeBooks((previous) => updateTravelBook(previous, selectedBook.id, {
      userId: selectedBook.userId,
      name: selectedBook.name,
      description: selectedBook.description,
      startDate: selectedBook.startDate,
      endDate: selectedBook.endDate,
      summary: summaryDraft,
    }));
    showToast('行程总结已保存。');
  };

  return (
    <SectionCard
      title="行程明细"
      description="围绕当前用户和选中账本维护旅行消费明细，并把行程总结收敛到同一处完成。"
      action={<Tag tone="blue">{activeBook?.name ?? '未选择当前账本'}</Tag>}
    >
      <div className="page-stack">
        <div className="callout callout-info">
          新增记录默认写入 <strong>{normalizeTravelUserId(activeUserId) || '未设置用户'}</strong> / <strong>{activeBook?.name ?? '未选择账本'}</strong>。
          明细筛选账本可单独切换，不影响顶部当前账本上下文。
        </div>

        <div className="travel-record-entry-grid">
          <DatePickerField
            label="日期"
            value={form.date}
            onChange={(value) => setForm((previous) => ({ ...previous, date: value }))}
            clearable={false}
          />
          <SelectField
            label="开始时间"
            value={form.timeStart}
            onChange={(event) => setForm((previous) => ({ ...previous, timeStart: event.target.value }))}
          >
            {TRAVEL_TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </SelectField>
          <SelectField
            label="结束时间"
            value={form.timeEnd}
            onChange={(event) => setForm((previous) => ({ ...previous, timeEnd: event.target.value }))}
          >
            {TRAVEL_TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </SelectField>
          <SelectField
            label="分类"
            value={form.category}
            onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value as TravelCategory }))}
          >
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>{getTravelCategoryLabel(category)}</option>
            ))}
          </SelectField>
          <Field
            label="项目"
            value={form.title}
            onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
            placeholder="例如：高铁去程"
          />
          <Field
            label="原价"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm((previous) => ({ ...previous, amount: event.target.value }))}
            placeholder="例如：299"
          />
          <Field
            label="优惠"
            type="number"
            min="0"
            step="0.01"
            value={form.discountAmount}
            onChange={(event) => setForm((previous) => ({ ...previous, discountAmount: event.target.value }))}
            placeholder="可选"
          />
          <SelectField
            label="支付方式"
            value={form.payChannel}
            onChange={(event) => setForm((previous) => ({ ...previous, payChannel: event.target.value }))}
          >
            {payChannels.map((channel) => (
              <option key={channel.id} value={channel.value}>{channel.label}</option>
            ))}
          </SelectField>
          <Field
            label="交通信息"
            value={form.vehicleInfo}
            onChange={(event) => setForm((previous) => ({ ...previous, vehicleInfo: event.target.value }))}
            placeholder="例如：G7152 / 景区接驳车"
          />
          <Field
            label="优惠说明"
            value={form.discountNote}
            onChange={(event) => setForm((previous) => ({ ...previous, discountNote: event.target.value }))}
            placeholder="例如：早鸟票优惠"
          />
          <Field
            label="备注"
            value={form.remark}
            onChange={(event) => setForm((previous) => ({ ...previous, remark: event.target.value }))}
            placeholder="补充消费背景"
          />
          <div className="travel-inline-action">
            <span className="field-label">保存记录</span>
            <Btn tone="primary" onClick={handleCreate}>保存旅行消费</Btn>
          </div>
        </div>

        <div className="travel-duration-card">
          <strong>自动计算时长</strong>
          <span>{formatTravelDuration(calculateTravelDurationMinutes(form.timeStart, form.timeEnd))}</span>
        </div>

        <div className="travel-summary-card">
          <div className="travel-summary-card-head">
            <strong>行程总结</strong>
            <span>{selectedBook ? `当前正在编辑：${selectedBook.name}` : '请先切换到具体账本再编辑总结'}</span>
          </div>
          <TextArea
            value={summaryDraft}
            onChange={(event) => setSummaryDraft(event.target.value)}
            placeholder="记录这次旅行里值得保留的安排、预算偏差和下次优化点。"
            disabled={!selectedBook}
          />
          <div className="travel-summary-actions">
            <Btn tone="secondary" disabled={!selectedBook} onClick={() => setSummaryDraft(selectedBook?.summary ?? '')}>重置</Btn>
            <Btn tone="primary" disabled={!selectedBook} onClick={handleSaveSummary}>保存总结</Btn>
          </div>
        </div>

        <div className="travel-filter-grid">
          <SelectField label="筛选账本" value={detailsBookId} onChange={(event) => onDetailsBookIdChange(event.target.value)}>
            <option value={TRAVEL_ALL_BOOKS}>全部行程账本</option>
            {books
              .filter((book) => book.userId === activeUserId)
              .map((book) => (
                <option key={book.id} value={book.id}>{book.name}</option>
              ))}
          </SelectField>
          <DatePickerField label="开始日期" value={startDate} onChange={setStartDate} placeholder="不限" />
          <DatePickerField label="结束日期" value={endDate} onChange={setEndDate} placeholder="不限" />
          <SelectField label="分类筛选" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">全部分类</option>
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>{getTravelCategoryLabel(category)}</option>
            ))}
          </SelectField>
          <SelectField label="支付方式" value={payChannelFilter} onChange={(event) => setPayChannelFilter(event.target.value)}>
            <option value="">全部方式</option>
            {payChannels.map((channel) => (
              <option key={channel.id} value={channel.value}>{channel.label}</option>
            ))}
          </SelectField>
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索项目、交通信息、优惠说明或备注"
          />
        </div>

        <div className="travel-summary-bar">
          <span className="subtle-text">共 {summary.count} 条记录</span>
          <span className="subtle-text">原价 {formatTravelAmount(summary.totalAmount)}</span>
          <span className="subtle-text">优惠 {formatTravelAmount(summary.totalSaved)}</span>
          <span className="subtle-text">实付 {formatTravelAmount(summary.totalPaidAmount)}</span>
        </div>

        {filteredRecords.length ? (
          <>
            <DataTable rowKey="id" columns={columns} data={pageRecords} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无旅行消费记录"
            description="先补一条旅行消费记录，或者调整筛选账本、日期、分类和支付方式条件。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => {
          setEditingRecord(null);
          setEditingForm(createDefaultFormState(activeUserId, activeBookId, payChannels));
        }}
        title={editingRecord ? `编辑旅行消费：${editingRecord.title}` : '编辑旅行消费'}
        width={980}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingRecord(null);
                setEditingForm(createDefaultFormState(activeUserId, activeBookId, payChannels));
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="travel-modal-layout">
          <div className="travel-record-entry-grid">
            <Field
              label="用户 ID"
              value={editingForm.userId}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, userId: event.target.value }))}
            />
            <SelectField
              label="所属账本"
              value={editingForm.bookId}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, bookId: event.target.value }))}
            >
              {books
                .filter((book) => book.userId === editingForm.userId || book.userId === activeUserId)
                .map((book) => (
                  <option key={book.id} value={book.id}>{book.name}</option>
                ))}
            </SelectField>
            <DatePickerField
              label="日期"
              value={editingForm.date}
              onChange={(value) => setEditingForm((previous) => ({ ...previous, date: value }))}
              clearable={false}
            />
            <SelectField
              label="开始时间"
              value={editingForm.timeStart}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, timeStart: event.target.value }))}
            >
              {TRAVEL_TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </SelectField>
            <SelectField
              label="结束时间"
              value={editingForm.timeEnd}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, timeEnd: event.target.value }))}
            >
              {TRAVEL_TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </SelectField>
            <SelectField
              label="分类"
              value={editingForm.category}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, category: event.target.value as TravelCategory }))}
            >
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>{getTravelCategoryLabel(category)}</option>
              ))}
            </SelectField>
            <Field
              label="项目"
              value={editingForm.title}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, title: event.target.value }))}
            />
            <Field
              label="原价"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.amount}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, amount: event.target.value }))}
            />
            <Field
              label="优惠"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.discountAmount}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, discountAmount: event.target.value }))}
            />
            <SelectField
              label="支付方式"
              value={editingForm.payChannel}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, payChannel: event.target.value }))}
            >
              {payChannels.map((channel) => (
                <option key={channel.id} value={channel.value}>{channel.label}</option>
              ))}
            </SelectField>
            <Field
              label="交通信息"
              value={editingForm.vehicleInfo}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, vehicleInfo: event.target.value }))}
            />
            <Field
              label="优惠说明"
              value={editingForm.discountNote}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, discountNote: event.target.value }))}
            />
          </div>
          <TextArea
            label="备注"
            value={editingForm.remark}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, remark: event.target.value }))}
            placeholder="补充背景、同行信息或复盘备注"
          />
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (!pendingDeleteId) {
            return;
          }

          onChangeRecords((previous) => deleteTravelExpense(previous, pendingDeleteId));
          setPendingDeleteId(null);
          showToast('旅行消费记录已删除。');
        }}
        title="确认删除这条旅行消费记录？"
      >
        删除后，这条记录将不再参与当前账本的统计、排行和报告导出。
      </DeleteModal>
    </SectionCard>
  );
}
