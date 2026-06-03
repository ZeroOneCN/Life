import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';

import { MonthPickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, TextArea } from '../ui';
import {
  CARD_ALL_BILL_CARDS,
  CARD_ALL_CARRIERS,
  CARD_ALL_MONTHS,
  CARD_PAGE_SIZE,
  createLifeCardBill,
  deleteLifeCardBill,
  filterLifeCardBills,
  formatLifeCardMoney,
  importLifeCardBillsFromCsv,
  updateLifeCardBill,
} from '../../services/card';
import type { LifeCardBillDraft, LifeCardBillRecord, LifeCardImportResult, LifeCardRecord } from '../../types/card';

interface CardBillsSectionProps {
  cards: LifeCardRecord[];
  bills: LifeCardBillRecord[];
  onChangeBills: (updater: (records: LifeCardBillRecord[]) => LifeCardBillRecord[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface BillFormState {
  simId: string;
  billingMonth: string;
  monthlyFee: string;
  actualFee: string;
  extraCharges: string;
  totalFee: string;
  note: string;
}

function createDefaultBillForm(cards: LifeCardRecord[]): BillFormState {
  const selected = cards[0];
  return {
    simId: selected?.id ?? '',
    billingMonth: dayjs().format('YYYY-MM'),
    monthlyFee: selected ? String(selected.monthlyFee) : '',
    actualFee: selected ? String(selected.monthlyFee) : '',
    extraCharges: '0',
    totalFee: selected ? String(selected.monthlyFee) : '',
    note: '',
  };
}

function buildBillForm(record: LifeCardBillRecord): BillFormState {
  return {
    simId: record.simId,
    billingMonth: record.billingMonth,
    monthlyFee: String(record.monthlyFee),
    actualFee: String(record.actualFee),
    extraCharges: String(record.extraCharges),
    totalFee: String(record.totalFee),
    note: record.note,
  };
}

function parseBillDraft(form: BillFormState, cards: LifeCardRecord[]): LifeCardBillDraft | null {
  const matchedCard = cards.find((card) => card.id === form.simId);
  if (!matchedCard || !form.billingMonth) {
    return null;
  }

  return {
    simId: matchedCard.id,
    phoneNumber: matchedCard.phoneNumber,
    carrierName: matchedCard.carrierName,
    billingMonth: form.billingMonth,
    monthlyFee: Number(form.monthlyFee || 0),
    actualFee: Number(form.actualFee || 0),
    extraCharges: Number(form.extraCharges || 0),
    totalFee: Number(form.totalFee || 0),
    note: form.note.trim(),
  };
}

function syncBillTotals(form: BillFormState) {
  const actualFee = Number(form.actualFee || 0);
  const extraCharges = Number(form.extraCharges || 0);
  const totalFee = Number((actualFee + extraCharges).toFixed(2));

  return {
    ...form,
    totalFee: String(totalFee),
  };
}

export function CardBillsSection({
  cards,
  bills,
  onChangeBills,
  showToast,
}: CardBillsSectionProps) {
  const [form, setForm] = useState<BillFormState>(() => createDefaultBillForm(cards));
  const [cardFilter, setCardFilter] = useState(CARD_ALL_BILL_CARDS);
  const [carrierFilter, setCarrierFilter] = useState(CARD_ALL_CARRIERS);
  const [monthFilter, setMonthFilter] = useState(CARD_ALL_MONTHS);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<LifeCardBillRecord | null>(null);
  const [editingForm, setEditingForm] = useState<BillFormState>(() => createDefaultBillForm(cards));
  const [pendingDelete, setPendingDelete] = useState<LifeCardBillRecord | null>(null);
  const [importResult, setImportResult] = useState<LifeCardImportResult | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if ((!form.simId || !cards.some((card) => card.id === form.simId)) && cards[0]) {
      setForm(createDefaultBillForm(cards));
    }
  }, [cards, form.simId]);

  const filteredBills = useMemo(
    () => filterLifeCardBills(bills, {
      simId: cardFilter,
      carrierName: carrierFilter,
      billingMonth: monthFilter,
      keyword,
    }),
    [bills, cardFilter, carrierFilter, keyword, monthFilter],
  );

  useEffect(() => {
    setPage(1);
  }, [cardFilter, carrierFilter, monthFilter, keyword]);

  const totalPages = Math.max(1, Math.ceil(filteredBills.length / CARD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * CARD_PAGE_SIZE;
    return filteredBills.slice(startIndex, startIndex + CARD_PAGE_SIZE);
  }, [filteredBills, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const filteredSummary = useMemo(() => filteredBills.reduce((summary, bill) => {
    summary.totalFee += bill.totalFee;
    summary.actualFee += bill.actualFee;
    summary.extraCharges += bill.extraCharges;
    return summary;
  }, {
    totalFee: 0,
    actualFee: 0,
    extraCharges: 0,
  }), [filteredBills]);

  const monthOptions = useMemo(
    () => Array.from(new Set(bills.map((bill) => bill.billingMonth))).sort((left, right) => right.localeCompare(left)),
    [bills],
  );

  const handleCreate = () => {
    const draft = parseBillDraft(form, cards);
    if (!draft) {
      showToast('请先选择号卡并补全账单月份。', 'error');
      return;
    }

    onChangeBills((current) => createLifeCardBill(current, cards, draft));
    setForm(createDefaultBillForm(cards));
    showToast('账单记录已保存。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseBillDraft(editingForm, cards);
    if (!draft) {
      showToast('请补全编辑账单中的必填项。', 'error');
      return;
    }

    onChangeBills((current) => updateLifeCardBill(current, cards, editingRecord.id, draft));
    setEditingRecord(null);
    showToast('账单记录已更新。');
  };

  const handleDelete = () => {
    if (!pendingDelete) {
      return;
    }

    onChangeBills((current) => deleteLifeCardBill(current, pendingDelete.id));
    setPendingDelete(null);
    showToast('账单记录已删除。');
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const result = importLifeCardBillsFromCsv(text, cards);
    setImportResult(result);

    if (!result.records.length) {
      showToast('没有解析出可导入的账单记录。', 'error');
      return;
    }

    onChangeBills((current) => {
      const existingKeys = new Set(
        current.map((record) => [record.phoneNumber, record.billingMonth, record.totalFee, record.note].join('::')),
      );
      const merged = [...current];

      result.records.forEach((record) => {
        const key = [record.phoneNumber, record.billingMonth, record.totalFee, record.note].join('::');
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          merged.unshift(record);
        }
      });

      return merged;
    });

    showToast(`账单导入完成，新增 ${result.importedCount} 条，重复 ${result.duplicateCount} 条，无效 ${result.invalidCount} 条。`);
  };

  const handleDownloadTemplate = () => {
    const headers = ['月份', '电话号码', '月租', '实际扣费', '额外费用', '总费用', '备注'];
    const exampleRows = cards.slice(0, 2).map((card) => [
      dayjs().format('YYYY-MM'),
      card.phoneNumber,
      String(card.monthlyFee),
      String(card.monthlyFee),
      '0',
      String(card.monthlyFee),
      '标准月租',
    ]);
    const csvContent = [headers.join(','), ...exampleRows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '号卡账单导入模板.csv';
    link.click();
  };

  return (
    <SectionCard
      title="账单管理"
      description="按号卡维护月度扣费记录，支持单条录入、CSV 导入和统一的账单统计。"
      action={(
        <div className="inline-row">
          <Btn tone="secondary" onClick={handleDownloadTemplate}>下载模板</Btn>
          <Btn tone="primary" onClick={() => setImportModalOpen(true)}>CSV 导入</Btn>
        </div>
      )}
    >
      <div className="page-stack">
        <div className="card-bill-entry-grid">
          <SelectField
            label="号卡"
            value={form.simId}
            onChange={(event) => {
              const nextCard = cards.find((card) => card.id === event.target.value);
              setForm((current) => syncBillTotals({
                ...current,
                simId: event.target.value,
                monthlyFee: nextCard ? String(nextCard.monthlyFee) : current.monthlyFee,
                actualFee: nextCard ? String(nextCard.monthlyFee) : current.actualFee,
              }));
            }}
          >
            {cards.map((card) => (
              <option key={card.id} value={card.id}>{card.phoneNumber} / {card.carrierName}</option>
            ))}
          </SelectField>
          <MonthPickerField
            label="账单月份"
            value={form.billingMonth}
            onChange={(value) => setForm((current) => ({ ...current, billingMonth: value }))}
            clearable={false}
          />
          <Field
            label="月租"
            type="number"
            min="0"
            step="0.01"
            value={form.monthlyFee}
            onChange={(event) => setForm((current) => ({ ...current, monthlyFee: event.target.value }))}
          />
          <Field
            label="实际扣费"
            type="number"
            min="0"
            step="0.01"
            value={form.actualFee}
            onChange={(event) => setForm((current) => syncBillTotals({ ...current, actualFee: event.target.value }))}
          />
          <Field
            label="额外费用"
            type="number"
            min="0"
            step="0.01"
            value={form.extraCharges}
            onChange={(event) => setForm((current) => syncBillTotals({ ...current, extraCharges: event.target.value }))}
          />
          <Field
            label="总费用"
            type="number"
            min="0"
            step="0.01"
            value={form.totalFee}
            onChange={(event) => setForm((current) => ({ ...current, totalFee: event.target.value }))}
          />
          <div className="card-entry-action">
            <Btn tone="primary" onClick={handleCreate}>保存账单记录</Btn>
          </div>
        </div>

        <TextArea
          label="备注"
          value={form.note}
          onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
          placeholder="例如 套餐外流量、语音超额、活动优惠说明等"
        />

        <div className="card-bill-filter-grid">
          <SelectField
            label="号卡筛选"
            value={cardFilter}
            onChange={(event) => setCardFilter(event.target.value)}
          >
            <option value={CARD_ALL_BILL_CARDS}>全部号卡</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>{card.phoneNumber}</option>
            ))}
          </SelectField>
          <SelectField
            label="运营商筛选"
            value={carrierFilter}
            onChange={(event) => setCarrierFilter(event.target.value)}
          >
            <option value={CARD_ALL_CARRIERS}>全部运营商</option>
            {Array.from(new Set(cards.map((card) => card.carrierName))).map((carrierName) => (
              <option key={carrierName} value={carrierName}>{carrierName}</option>
            ))}
          </SelectField>
          <SelectField
            label="账单月份"
            value={monthFilter}
            onChange={(event) => setMonthFilter(event.target.value)}
          >
            <option value={CARD_ALL_MONTHS}>全部月份</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </SelectField>
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索号码、运营商、月份或备注"
          />
        </div>

        <StatGrid
          className="card-records-summary"
          items={[
            { label: '当前筛选结果', value: `${filteredBills.length} 条` },
            { label: '实际扣费合计', value: formatLifeCardMoney(filteredSummary.actualFee) },
            { label: '额外费用合计', value: formatLifeCardMoney(filteredSummary.extraCharges) },
            { label: '总费用合计', value: formatLifeCardMoney(filteredSummary.totalFee) },
          ]}
        />

        {filteredBills.length ? (
          <>
            <DataTable
              rowKey="id"
              data={pageRecords}
              columns={[
                { key: 'billingMonth', title: '月份', dataIndex: 'billingMonth', width: 100 },
                { key: 'phoneNumber', title: '电话号码', dataIndex: 'phoneNumber', width: 150 },
                { key: 'carrierName', title: '运营商', dataIndex: 'carrierName', width: 110 },
                {
                  key: 'monthlyFee',
                  title: '月租',
                  width: 110,
                  align: 'right',
                  render: (_, row) => formatLifeCardMoney(row.monthlyFee),
                },
                {
                  key: 'actualFee',
                  title: '实际扣费',
                  width: 110,
                  align: 'right',
                  render: (_, row) => formatLifeCardMoney(row.actualFee),
                },
                {
                  key: 'extraCharges',
                  title: '额外费用',
                  width: 110,
                  align: 'right',
                  render: (_, row) => formatLifeCardMoney(row.extraCharges),
                },
                {
                  key: 'totalFee',
                  title: '总费用',
                  width: 110,
                  align: 'right',
                  render: (_, row) => formatLifeCardMoney(row.totalFee),
                },
                { key: 'note', title: '备注', render: (_, row) => row.note || '-', width: 220 },
                {
                  key: 'actions',
                  title: '操作',
                  width: 160,
                  render: (_, row) => (
                    <div className="table-actions">
                      <Btn tone="ghost" onClick={() => {
                        setEditingRecord(row);
                        setEditingForm(buildBillForm(row));
                      }}
                      >
                        编辑
                      </Btn>
                      <Btn tone="ghost" onClick={() => setPendingDelete(row)}>删除</Btn>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="暂无符合条件的账单记录" description="可以先录入本月账单，或通过 CSV 导入历史账单。" />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title={editingRecord ? `编辑账单：${editingRecord.phoneNumber} / ${editingRecord.billingMonth}` : '编辑账单'}
        width={860}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingRecord(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="card-bill-modal-grid">
          <SelectField
            label="号卡"
            value={editingForm.simId}
            onChange={(event) => {
              const nextCard = cards.find((card) => card.id === event.target.value);
              setEditingForm((current) => syncBillTotals({
                ...current,
                simId: event.target.value,
                monthlyFee: nextCard ? String(nextCard.monthlyFee) : current.monthlyFee,
                actualFee: nextCard ? String(nextCard.monthlyFee) : current.actualFee,
              }));
            }}
          >
            {cards.map((card) => (
              <option key={card.id} value={card.id}>{card.phoneNumber} / {card.carrierName}</option>
            ))}
          </SelectField>
          <MonthPickerField
            label="账单月份"
            value={editingForm.billingMonth}
            onChange={(value) => setEditingForm((current) => ({ ...current, billingMonth: value }))}
            clearable={false}
          />
          <Field
            label="月租"
            type="number"
            min="0"
            step="0.01"
            value={editingForm.monthlyFee}
            onChange={(event) => setEditingForm((current) => ({ ...current, monthlyFee: event.target.value }))}
          />
          <Field
            label="实际扣费"
            type="number"
            min="0"
            step="0.01"
            value={editingForm.actualFee}
            onChange={(event) => setEditingForm((current) => syncBillTotals({ ...current, actualFee: event.target.value }))}
          />
          <Field
            label="额外费用"
            type="number"
            min="0"
            step="0.01"
            value={editingForm.extraCharges}
            onChange={(event) => setEditingForm((current) => syncBillTotals({ ...current, extraCharges: event.target.value }))}
          />
          <Field
            label="总费用"
            type="number"
            min="0"
            step="0.01"
            value={editingForm.totalFee}
            onChange={(event) => setEditingForm((current) => ({ ...current, totalFee: event.target.value }))}
          />
        </div>
        <TextArea
          label="备注"
          value={editingForm.note}
          onChange={(event) => setEditingForm((current) => ({ ...current, note: event.target.value }))}
          placeholder="记录扣费原因、套餐变更或补充说明"
        />
      </Modal>

      <Modal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="CSV 导入账单"
        width={760}
        footer={<Btn tone="secondary" onClick={() => setImportModalOpen(false)}>关闭</Btn>}
      >
        <div className="page-stack">
          <div className="callout callout-neutral">
            模板表头固定为：月份、电话号码、月租、实际扣费、额外费用、总费用、备注。
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }

              await handleImportFile(file);
              event.target.value = '';
            }}
          />
          <div className="card-import-actions">
            <Btn tone="primary" onClick={() => fileInputRef.current?.click()}>选择 CSV 文件</Btn>
            <Btn tone="secondary" onClick={handleDownloadTemplate}>重新下载模板</Btn>
          </div>
          {importResult ? (
            <StatGrid
              className="card-records-summary"
              items={[
                { label: '总行数', value: `${importResult.totalRows}` },
                { label: '成功导入', value: `${importResult.importedCount}` },
                { label: '重复跳过', value: `${importResult.duplicateCount}` },
                { label: '无效行数', value: `${importResult.invalidCount}` },
              ]}
            />
          ) : null}
        </div>
      </Modal>

      <DeleteModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={pendingDelete ? `删除账单：${pendingDelete.phoneNumber} / ${pendingDelete.billingMonth}` : '删除账单'}
      >
        删除后这条账单不会再参与趋势和支出统计，请确认是否继续。
      </DeleteModal>
    </SectionCard>
  );
}
