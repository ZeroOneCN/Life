import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, TextArea } from '../ui';
import {
  TRAVEL_RECORD_PAGE_SIZE,
  buildTravelBookSummaries,
  buildTravelImportTemplateWorkbook,
  createTravelBook,
  deleteTravelBook,
  deleteTravelExpensesByBookId,
  downloadBlob,
  formatTravelAmount,
  formatTravelDateRange,
  formatTravelDateTime,
  importTravelWorkbook,
  normalizeTravelUserId,
  updateTravelBook,
} from '../../services/travel';
import type { TravelBook, TravelBookDraft, TravelExpenseRecord, TravelImportResult, TravelPayChannel } from '../../types/travel';

interface TravelBooksSectionProps {
  currentUserLabel: string;
  activeUserId: string;
  activeBookId: string;
  books: TravelBook[];
  records: TravelExpenseRecord[];
  payChannels: TravelPayChannel[];
  onActiveBookChange: (bookId: string) => void;
  onChangeBooks: (updater: (books: TravelBook[]) => TravelBook[]) => void;
  onChangeRecords: (updater: (records: TravelExpenseRecord[]) => TravelExpenseRecord[]) => void;
  onChangePayChannels: (updater: (payChannels: TravelPayChannel[]) => TravelPayChannel[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface TravelBookFormState {
  userId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  summary: string;
}

function createDefaultFormState(activeUserId: string): TravelBookFormState {
  return {
    userId: activeUserId,
    name: '',
    description: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    summary: '',
  };
}

function buildFormState(book: TravelBook): TravelBookFormState {
  return {
    userId: book.userId,
    name: book.name,
    description: book.description,
    startDate: book.startDate,
    endDate: book.endDate,
    summary: book.summary,
  };
}

function parseDraft(form: TravelBookFormState): TravelBookDraft | null {
  const userId = normalizeTravelUserId(form.userId);

  if (!userId || !form.name.trim() || !dayjs(form.startDate).isValid()) {
    return null;
  }

  if (form.endDate && !dayjs(form.endDate).isValid()) {
    return null;
  }

  return {
    userId,
    name: form.name.trim(),
    description: form.description.trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    summary: form.summary.trim(),
  };
}

export function TravelBooksSection({
  currentUserLabel,
  activeUserId,
  activeBookId,
  books,
  records,
  payChannels,
  onActiveBookChange,
  onChangeBooks,
  onChangeRecords,
  onChangePayChannels,
  showToast,
}: TravelBooksSectionProps) {
  const [form, setForm] = useState<TravelBookFormState>(() => createDefaultFormState(activeUserId));
  const [editingBook, setEditingBook] = useState<TravelBook | null>(null);
  const [editingForm, setEditingForm] = useState<TravelBookFormState>(() => createDefaultFormState(activeUserId));
  const [pendingDeleteBook, setPendingDeleteBook] = useState<TravelBook | null>(null);
  const [page, setPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<TravelImportResult | null>(null);

  const bookSummaries = useMemo(
    () => buildTravelBookSummaries(books, records, activeUserId),
    [books, records, activeUserId],
  );

  const totalPages = Math.max(1, Math.ceil(bookSummaries.length / TRAVEL_RECORD_PAGE_SIZE));
  const pageBooks = useMemo(() => {
    const startIndex = (page - 1) * TRAVEL_RECORD_PAGE_SIZE;
    return bookSummaries.slice(startIndex, startIndex + TRAVEL_RECORD_PAGE_SIZE);
  }, [bookSummaries, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const columns = useMemo(() => [
    { key: 'name', title: '行程账本', dataIndex: 'bookName' as const },
    { key: 'dateRange', title: '时间范围', dataIndex: 'dateRange' as const },
    {
      key: 'count',
      title: '记录数',
      render: (_value: unknown, row: (typeof pageBooks)[number]) => `${row.totalCount} 条`,
    },
    {
      key: 'paid',
      title: '实付金额',
      render: (_value: unknown, row: (typeof pageBooks)[number]) => formatTravelAmount(row.totalPaidAmount),
    },
    {
      key: 'updatedAt',
      title: '最近更新',
      render: (_value: unknown, row: (typeof pageBooks)[number]) => formatTravelDateTime(row.updatedAt),
    },
    {
      key: 'actions',
      title: '操作',
      render: (_value: unknown, row: (typeof pageBooks)[number]) => (
        <div className="fitness-row-actions">
          <Btn tone={row.bookId === activeBookId ? 'primary' : 'secondary'} onClick={() => onActiveBookChange(row.bookId)}>
            {row.bookId === activeBookId ? '当前账本' : '切换为当前'}
          </Btn>
          <Btn
            tone="secondary"
            onClick={() => {
              const target = books.find((book) => book.id === row.bookId);
              if (!target) {
                return;
              }

              setEditingBook(target);
              setEditingForm(buildFormState(target));
            }}
          >
            编辑
          </Btn>
          <Btn
            tone="danger"
            onClick={() => {
              const target = books.find((book) => book.id === row.bookId) ?? null;
              setPendingDeleteBook(target);
            }}
          >
            删除
          </Btn>
        </div>
      ),
    },
  ], [activeBookId, books, onActiveBookChange, pageBooks]);

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全用户 ID、行程账本名称和开始日期。', 'error');
      return;
    }

    const duplicate = books.some((book) => (
      book.userId === draft.userId && book.name.trim().toLowerCase() === draft.name.trim().toLowerCase()
    ));

    if (duplicate) {
      showToast('该用户下已存在同名行程账本。', 'error');
      return;
    }

    onChangeBooks((previous) => createTravelBook(previous, draft));
    setForm(createDefaultFormState(activeUserId));
    showToast('行程账本已创建。');
  };

  const handleSaveEdit = () => {
    if (!editingBook) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全要保存的行程账本信息。', 'error');
      return;
    }

    const duplicate = books.some((book) => (
      book.id !== editingBook.id
      && book.userId === draft.userId
      && book.name.trim().toLowerCase() === draft.name.trim().toLowerCase()
    ));

    if (duplicate) {
      showToast('该用户下已存在同名行程账本。', 'error');
      return;
    }

    onChangeBooks((previous) => updateTravelBook(previous, editingBook.id, draft));
    setEditingBook(null);
    setEditingForm(createDefaultFormState(activeUserId));
    showToast('行程账本已更新。');
  };

  const handleDownloadTemplate = async () => {
    const blob = await buildTravelImportTemplateWorkbook();
    downloadBlob(blob, '旅行消费导入模板.xlsx');
    showToast('导入模板已生成。');
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);

    try {
      const result = await importTravelWorkbook(file, {
        activeUserId,
        activeBookId,
        books,
        records,
        payChannels,
      });

      setImportResult(result);

      if (result.importedCount > 0 || result.createdBookCount > 0 || result.createdPayChannelCount > 0) {
        onChangeBooks(() => result.nextBooks);
        onChangeRecords(() => result.nextRecords);
        onChangePayChannels(() => result.nextPayChannels);
      }

      showToast(
        result.importedCount > 0
          ? `导入完成，新增 ${result.importedCount} 条旅行消费记录。`
          : '导入完成，但没有新增记录，请检查重复项或无效行。',
        result.importedCount > 0 ? 'success' : 'error',
      );
    } catch (error) {
      showToast(`导入失败：${String(error)}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <SectionCard
      title="行程账本"
      description="统一维护当前用户下的旅行账本，承接导入、账本切换、账本摘要与后续明细录入。"
      action={(
        <div className="inline-row">
          <Btn tone="secondary" onClick={() => void handleDownloadTemplate()}>下载模板</Btn>
          <Btn tone="secondary" onClick={() => setImportOpen(true)}>导入 Excel</Btn>
        </div>
      )}
    >
      <div className="page-stack">
        <div className="callout callout-info">
          当前默认创建用户为 <strong>{currentUserLabel}</strong>。
          切换当前账本后，明细录入、统计看板和报告导出都会联动更新。
        </div>

        <div className="travel-book-form-grid">
          <Field
            label="当前创建用户"
            value={currentUserLabel}
            disabled
          />
          <Field
            label="行程账本名称"
            value={form.name}
            onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
            placeholder="例如：上海周末漫游"
          />
          <DatePickerField
            label="开始日期"
            value={form.startDate}
            onChange={(value) => setForm((previous) => ({ ...previous, startDate: value }))}
            clearable={false}
          />
          <DatePickerField
            label="结束日期"
            value={form.endDate}
            onChange={(value) => setForm((previous) => ({ ...previous, endDate: value }))}
            placeholder="可选"
          />
          <Field
            label="账本描述"
            value={form.description}
            onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="例如：高铁往返 + 城市漫游"
          />
          <div className="travel-inline-action">
            <span className="field-label">保存账本</span>
            <Btn tone="primary" onClick={handleCreate}>新建行程账本</Btn>
          </div>
        </div>

        {bookSummaries.length ? (
          <>
            <DataTable rowKey="bookId" columns={columns} data={pageBooks} />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无行程账本"
            description="先创建一个行程账本，后续消费记录、统计看板和报告导出都会围绕它展开。"
          />
        )}
      </div>

      <Modal
        open={Boolean(editingBook)}
        onClose={() => {
          setEditingBook(null);
          setEditingForm(createDefaultFormState(activeUserId));
        }}
        title={editingBook ? `编辑行程账本：${editingBook.name}` : '编辑行程账本'}
        width={760}
        footer={(
          <>
            <Btn
              tone="secondary"
              onClick={() => {
                setEditingBook(null);
                setEditingForm(createDefaultFormState(activeUserId));
              }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存账本</Btn>
          </>
        )}
      >
        <div className="travel-modal-layout">
          <div className="travel-book-form-grid travel-book-form-grid-modal">
            <Field
              label="当前创建用户"
              value={currentUserLabel}
              disabled
            />
            <Field
              label="行程账本名称"
              value={editingForm.name}
              onChange={(event) => setEditingForm((previous) => ({ ...previous, name: event.target.value }))}
            />
            <div className="travel-book-modal-date-slot">
              <DatePickerField
              label="开始日期"
              value={editingForm.startDate}
              onChange={(value) => setEditingForm((previous) => ({ ...previous, startDate: value }))}
              clearable={false}
            />
            </div>
            <div className="travel-book-modal-date-slot travel-book-modal-date-slot-end">
              <DatePickerField
              label="结束日期"
              value={editingForm.endDate}
              onChange={(value) => setEditingForm((previous) => ({ ...previous, endDate: value }))}
              placeholder="可选"
            />
            </div>
          </div>
          <Field
            label="账本描述"
            value={editingForm.description}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, description: event.target.value }))}
            placeholder="补充这个行程账本的目的、范围或同行背景"
          />
          <TextArea
            label="行程总结"
            value={editingForm.summary}
            onChange={(event) => setEditingForm((previous) => ({ ...previous, summary: event.target.value }))}
            placeholder="可提前填写一版总结，也可以稍后在行程明细页继续补充。"
          />
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDeleteBook)}
        onClose={() => setPendingDeleteBook(null)}
        onConfirm={() => {
          if (!pendingDeleteBook) {
            return;
          }

          const relatedCount = records.filter((record) => record.bookId === pendingDeleteBook.id).length;

          onChangeBooks((previous) => deleteTravelBook(previous, pendingDeleteBook.id));
          onChangeRecords((previous) => deleteTravelExpensesByBookId(previous, pendingDeleteBook.id));

          const nextActiveBook = books.find((book) => book.id !== pendingDeleteBook.id && book.userId === activeUserId);
          if (pendingDeleteBook.id === activeBookId && nextActiveBook) {
            onActiveBookChange(nextActiveBook.id);
          }

          setPendingDeleteBook(null);
          showToast(`行程账本已删除，同时清理了 ${relatedCount} 条关联消费记录。`);
        }}
        title="确认删除这个行程账本？"
      >
        删除账本后，关联的消费记录也会一起移除，排行榜、统计和报告都会同步更新。
      </DeleteModal>

      <Modal
        open={importOpen}
        onClose={() => {
          if (!importing) {
            setImportOpen(false);
          }
        }}
        title="导入旅行消费 Excel"
        width={760}
        footer={<Btn tone="secondary" onClick={() => setImportOpen(false)} disabled={importing}>关闭</Btn>}
      >
        <div className="page-stack">
          <div className="callout callout-info">
            支持列别名：用户ID、行程账本、日期、开始时间、结束时间、时间段、分类、项目、原价、优惠、优惠说明、交通信息、支付方式、备注。
            缺失账本时会自动归属到当前账本，不存在的账本会自动创建。
          </div>

          <label className="field">
            <span className="field-label">选择 Excel 文件</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImportFile(file);
                }
              }}
            />
          </label>

          {importing ? <span className="subtle-text">正在解析旅行消费文件，请稍候…</span> : null}

          {importResult ? (
            <div className="travel-import-result">
              <div className="travel-import-result-grid">
                <div className="stat-card">
                  <span className="stat-label">总行数</span>
                  <strong className="stat-value">{importResult.totalRows}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">成功导入</span>
                  <strong className="stat-value">{importResult.importedCount}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">重复跳过</span>
                  <strong className="stat-value">{importResult.duplicateCount}</strong>
                </div>
                <div className="stat-card">
                  <span className="stat-label">无效行</span>
                  <strong className="stat-value">{importResult.invalidCount}</strong>
                </div>
              </div>
              <div className="travel-import-meta">
                <span className="subtle-text">自动新增账本 {importResult.createdBookCount} 个</span>
                <span className="subtle-text">自动补齐支付渠道 {importResult.createdPayChannelCount} 个</span>
              </div>
              {importResult.invalidRows.length ? (
                <div className="travel-import-errors">
                  <strong>无效行摘要</strong>
                  {importResult.invalidRows.slice(0, 5).map((item) => (
                    <span key={`${item.rowNumber}-${item.reason}`}>第 {item.rowNumber} 行：{item.reason}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>
    </SectionCard>
  );
}
