import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import { Btn, DataTable, DeleteModal, Field, Modal, Pagination, SelectField, TextArea } from '../ui';
import {
  CARD_ALL_CARRIERS,
  CARD_PAGE_SIZE,
  createLifeCard,
  createLifeCardRecharge,
  deleteLifeCard,
  filterLifeCards,
  formatLifeCardMoney,
  updateLifeCard,
} from '../../services/card';
import type {
  LifeCardCarrier,
  LifeCardDraft,
  LifeCardPageState,
  LifeCardRecord,
  LifeCardRechargeDraft,
} from '../../types/card';

interface CardCardsSectionProps {
  cards: LifeCardRecord[];
  carriers: LifeCardCarrier[];
  settings: LifeCardPageState['settings'];
  onChangeCards: (updater: (records: LifeCardRecord[]) => LifeCardRecord[]) => void;
  onRecharge: (
    updater: (
      current: { cards: LifeCardRecord[]; recharges: LifeCardPageState['recharges'] },
    ) => { cards: LifeCardRecord[]; recharges: LifeCardPageState['recharges'] },
  ) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface CardFormState {
  phoneNumber: string;
  carrierId: string;
  location: string;
  balance: string;
  monthlyFee: string;
  billingDay: string;
  dataPlan: string;
  callMinutes: string;
  smsCount: string;
  activationDate: string;
  notes: string;
}

interface RechargeFormState {
  simId: string;
  amount: string;
  rechargeDate: string;
  note: string;
}

function createDefaultCardForm(carriers: LifeCardCarrier[]): CardFormState {
  return {
    phoneNumber: '',
    carrierId: carriers[0]?.id ?? '',
    location: '',
    balance: '',
    monthlyFee: '',
    billingDay: '1',
    dataPlan: '',
    callMinutes: '',
    smsCount: '',
    activationDate: dayjs().format('YYYY-MM-DD'),
    notes: '',
  };
}

function buildCardForm(record: LifeCardRecord, carriers: LifeCardCarrier[]): CardFormState {
  const matchedById = carriers.find((c) => c.id === record.carrierId);
  const matchedByName = carriers.find((c) => c.name === record.carrierName);
  const resolvedCarrier = matchedById ?? matchedByName;

  return {
    phoneNumber: record.phoneNumber,
    carrierId: resolvedCarrier?.id ?? record.carrierId,
    location: record.location,
    balance: String(record.balance),
    monthlyFee: String(record.monthlyFee),
    billingDay: String(record.billingDay),
    dataPlan: record.dataPlan,
    callMinutes: record.callMinutes,
    smsCount: record.smsCount,
    activationDate: record.activationDate,
    notes: record.notes,
  };
}

function parseCardDraft(form: CardFormState): LifeCardDraft | null {
  if (!form.phoneNumber.trim() || !form.carrierId.trim()) {
    return null;
  }

  return {
    phoneNumber: form.phoneNumber.trim(),
    carrierId: form.carrierId,
    location: form.location.trim(),
    balance: Number(form.balance || 0),
    monthlyFee: Number(form.monthlyFee || 0),
    billingDay: Number(form.billingDay || 1),
    dataPlan: form.dataPlan.trim(),
    callMinutes: form.callMinutes.trim(),
    smsCount: form.smsCount.trim(),
    activationDate: form.activationDate,
    notes: form.notes.trim(),
  };
}

function createDefaultRechargeForm(): RechargeFormState {
  return {
    simId: '',
    amount: '',
    rechargeDate: dayjs().format('YYYY-MM-DD'),
    note: '',
  };
}

function parseRechargeDraft(form: RechargeFormState): LifeCardRechargeDraft | null {
  const amount = Number(form.amount);
  if (!form.simId || !Number.isFinite(amount) || amount <= 0 || !dayjs(form.rechargeDate).isValid()) {
    return null;
  }

  return {
    simId: form.simId,
    amount,
    rechargeDate: form.rechargeDate,
    note: form.note.trim(),
  };
}

export function CardCardsSection({
  cards,
  carriers,
  settings,
  onChangeCards,
  onRecharge,
  showToast,
}: CardCardsSectionProps) {
  const [form, setForm] = useState<CardFormState>(() => createDefaultCardForm(carriers));
  const [keyword, setKeyword] = useState('');
  const [carrierFilter, setCarrierFilter] = useState(CARD_ALL_CARRIERS);
  const [locationFilter, setLocationFilter] = useState('');
  const [minBalance, setMinBalance] = useState('');
  const [maxBalance, setMaxBalance] = useState('');
  const [page, setPage] = useState(1);
  const [editingRecord, setEditingRecord] = useState<LifeCardRecord | null>(null);
  const [editingForm, setEditingForm] = useState<CardFormState>(() => createDefaultCardForm(carriers));
  const [rechargeRecord, setRechargeRecord] = useState<LifeCardRecord | null>(null);
  const [rechargeForm, setRechargeForm] = useState<RechargeFormState>(createDefaultRechargeForm);
  const [pendingDelete, setPendingDelete] = useState<LifeCardRecord | null>(null);

  useEffect(() => {
    if ((!form.carrierId || !carriers.some((carrier) => carrier.id === form.carrierId)) && carriers[0]) {
      setForm((current) => ({ ...current, carrierId: carriers[0].id }));
    }
  }, [carriers, form.carrierId]);

  const filteredCards = useMemo(
    () => filterLifeCards(cards, carriers, {
      keyword,
      carrierId: carrierFilter,
      location: locationFilter,
      minBalance,
      maxBalance,
    }),
    [cards, carriers, carrierFilter, keyword, locationFilter, maxBalance, minBalance],
  );

  useEffect(() => {
    setPage(1);
  }, [keyword, carrierFilter, locationFilter, minBalance, maxBalance]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / CARD_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * CARD_PAGE_SIZE;
    return filteredCards.slice(startIndex, startIndex + CARD_PAGE_SIZE);
  }, [filteredCards, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const filteredSummary = useMemo(() => filteredCards.reduce((summary, card) => {
    summary.totalBalance += card.balance;
    summary.totalMonthlyFee += card.monthlyFee;
    if (card.balance <= settings.balanceThreshold) {
      summary.lowBalanceCount += 1;
    }
    return summary;
  }, {
    totalBalance: 0,
    totalMonthlyFee: 0,
    lowBalanceCount: 0,
  }), [filteredCards, settings.balanceThreshold]);

  const handleCreate = () => {
    const draft = parseCardDraft(form);
    if (!draft) {
      showToast('请先补全号码和运营商信息。', 'error');
      return;
    }

    onChangeCards((current) => createLifeCard(current, carriers, draft));
    setForm(createDefaultCardForm(carriers));
    showToast('号卡记录已保存。');
  };

  const handleSaveEdit = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseCardDraft(editingForm);
    if (!draft) {
      showToast('请补全编辑表单中的必填项。', 'error');
      return;
    }

    onChangeCards((current) => updateLifeCard(current, carriers, editingRecord.id, draft));
    setEditingRecord(null);
    showToast('号卡记录已更新。');
  };

  const handleRecharge = () => {
    const draft = parseRechargeDraft(rechargeForm);
    if (!draft) {
      showToast('请填写有效的充值金额和充值日期。', 'error');
      return;
    }

    onRecharge((current) => createLifeCardRecharge(current.cards, current.recharges, draft));
    setRechargeRecord(null);
    setRechargeForm(createDefaultRechargeForm());
    showToast('充值记录已保存，余额已同步更新。');
  };

  const handleDelete = () => {
    if (!pendingDelete) {
      return;
    }

    onChangeCards((current) => deleteLifeCard(current, pendingDelete.id));
    setPendingDelete(null);
    showToast('号卡记录已删除。');
  };

  return (
    <SectionCard
      title="号卡列表"
      description="集中维护手机号卡、套餐、余额和账单日，充值与低余额关注也统一收口到这块。"
      action={<Btn tone="secondary" onClick={() => {
        setKeyword('');
        setCarrierFilter(CARD_ALL_CARRIERS);
        setLocationFilter('');
        setMinBalance('');
        setMaxBalance('');
      }}>重置筛选</Btn>}
    >
      <div className="page-stack">
        <div className="callout callout-info">
          低余额阈值当前为 {formatLifeCardMoney(settings.balanceThreshold)}，账单日前提醒窗口为 {settings.notificationDaysBefore} 天。
        </div>

        <form className="card-entry-grid-compact" onSubmit={(event) => { event.preventDefault(); handleCreate(); }}>
          <Field
            label="电话号码"
            value={form.phoneNumber}
            onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))}
            placeholder="例如 13800138000"
          />
          <SelectField
            label="运营商"
            value={form.carrierId}
            onChange={(event) => setForm((current) => ({ ...current, carrierId: event.target.value }))}
          >
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
            ))}
          </SelectField>
          <Field
            label="归属地"
            value={form.location}
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
            placeholder="上海"
          />
          <Field
            label="余额"
            type="number"
            min="0"
            step="0.01"
            value={form.balance}
            onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))}
            placeholder="0.00"
          />
          <Field
            label="月租"
            type="number"
            min="0"
            step="0.01"
            value={form.monthlyFee}
            onChange={(event) => setForm((current) => ({ ...current, monthlyFee: event.target.value }))}
            placeholder="0.00"
          />
          <Field
            label="账单日"
            type="number"
            min="1"
            max="31"
            value={form.billingDay}
            onChange={(event) => setForm((current) => ({ ...current, billingDay: event.target.value }))}
          />
          <Field
            label="流量套餐"
            value={form.dataPlan}
            onChange={(event) => setForm((current) => ({ ...current, dataPlan: event.target.value }))}
            placeholder="30GB/月"
          />
          <Field
            label="通话/短信"
            value={`${form.callMinutes || ''}${form.callMinutes && form.smsCount ? '/' : ''}${form.smsCount || ''}`}
            onChange={(event) => {
              const val = event.target.value;
              const [call, sms] = val.split('/').map((s) => s.trim());
              setForm((current) => ({
                ...current,
                callMinutes: call ?? '',
                smsCount: sms ?? '',
              }));
            }}
            placeholder="100分钟/100条"
          />
          <DatePickerField
            label="开卡时间"
            value={form.activationDate}
            onChange={(value) => setForm((current) => ({ ...current, activationDate: value }))}
            clearable={false}
          />
          <Field
            label="备注"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="主力号等"
          />
          <Btn tone="primary" type="submit">保存</Btn>
        </form>

        <div className="card-filter-grid">
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索号码、运营商、套餐或备注"
          />
          <SelectField
            label="运营商筛选"
            value={carrierFilter}
            onChange={(event) => setCarrierFilter(event.target.value)}
          >
            <option value={CARD_ALL_CARRIERS}>全部运营商</option>
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
            ))}
          </SelectField>
          <Field
            label="归属地筛选"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            placeholder="例如 上海"
          />
          <Field
            label="最小余额"
            type="number"
            min="0"
            step="0.01"
            value={minBalance}
            onChange={(event) => setMinBalance(event.target.value)}
            placeholder="不限"
          />
          <Field
            label="最大余额"
            type="number"
            min="0"
            step="0.01"
            value={maxBalance}
            onChange={(event) => setMaxBalance(event.target.value)}
            placeholder="不限"
          />
        </div>

        <StatGrid
          className="card-records-summary"
          items={[
            { label: '当前筛选结果', value: `${filteredCards.length} 张` },
            { label: '低余额数量', value: `${filteredSummary.lowBalanceCount} 张`, helper: `阈值 ${formatLifeCardMoney(settings.balanceThreshold)}` },
            { label: '余额合计', value: formatLifeCardMoney(filteredSummary.totalBalance) },
            { label: '月租合计', value: formatLifeCardMoney(filteredSummary.totalMonthlyFee) },
          ]}
        />

        {filteredCards.length ? (
          <>
            <DataTable
              rowKey="id"
              data={pageRecords}
              columns={[
                { key: 'phoneNumber', title: '电话号码', dataIndex: 'phoneNumber', width: 120 },
                { key: 'carrierName', title: '运营商', dataIndex: 'carrierName', width: 84 },
                { key: 'location', title: '归属地', dataIndex: 'location', width: 68, render: (value) => String(value || '-') },
                {
                  key: 'balance',
                  title: '余额',
                  width: 70,
                  align: 'right',
                  render: (_, row) => formatLifeCardMoney(row.balance),
                },
                {
                  key: 'monthlyFee',
                  title: '月租',
                  width: 66,
                  align: 'right',
                  render: (_, row) => formatLifeCardMoney(row.monthlyFee),
                },
                {
                  key: 'billingDay',
                  title: '账单日',
                  width: 58,
                  render: (_, row) => `${row.billingDay} 日`,
                },
                { key: 'dataPlan', title: '流量套餐', dataIndex: 'dataPlan', width: 86, render: (value) => String(value || '-') },
                {
                  key: 'callSms',
                  title: '通话/短信',
                  width: 108,
                  render: (_, row) => {
                    const call = row.callMinutes || '';
                    const sms = row.smsCount || '';
                    if (!call && !sms) return '-';
                    return [call, sms].filter(Boolean).join(' / ');
                  },
                },
                {
                  key: 'activationDate',
                  title: '开卡时间',
                  width: 120,
                  render: (_, row) => {
                    if (!dayjs(row.activationDate).isValid()) return '-';
                    const d = dayjs(row.activationDate);
                    const now = dayjs();
                    const years = now.diff(d, 'year');
                    const months = now.diff(d.add(years, 'year'), 'month');
                    return (
                      <span style={{ whiteSpace: 'nowrap' }}>
                        {`${d.format('YYYY-MM-DD')} (${years}年${months}月)`}
                      </span>
                    );
                  },
                },
                { key: 'notes', title: '备注', render: (_, row) => row.notes || '-', width: 80 },
                {
                  key: 'actions',
                  title: '操作',
                  width: 154,
                  render: (_, row) => (
                    <div className="table-actions">
                      <Btn tone="secondary" onClick={() => {
                        setEditingRecord(row);
                        setEditingForm(buildCardForm(row, carriers));
                      }}
                      >
                        编辑
                      </Btn>
                      <Btn tone="secondary" onClick={() => {
                        setRechargeRecord(row);
                        setRechargeForm({
                          simId: row.id,
                          amount: '',
                          rechargeDate: dayjs().format('YYYY-MM-DD'),
                          note: '',
                        });
                      }}
                      >
                        充值
                      </Btn>
                      <Btn tone="danger" onClick={() => setPendingDelete(row)}>删除</Btn>
                    </div>
                  ),
                },
              ]}
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState title="暂无符合条件的号卡记录" description="可以先新增一张号卡，或放宽筛选条件后再查看。" />
        )}
      </div>

      <Modal
        open={Boolean(editingRecord)}
        onClose={() => setEditingRecord(null)}
        title={editingRecord ? `编辑号卡：${editingRecord.phoneNumber}` : '编辑号卡'}
        width={920}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setEditingRecord(null)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveEdit}>保存修改</Btn>
          </>
        )}
      >
        <div className="card-edit-section">
          <div className="card-edit-section-label">基本信息</div>
          <div className="card-modal-grid card-modal-grid-date-friendly">
            <Field
              label="电话号码"
              value={editingForm.phoneNumber}
              onChange={(event) => setEditingForm((current) => ({ ...current, phoneNumber: event.target.value }))}
            />
            <SelectField
              label="运营商"
              value={editingForm.carrierId}
              onChange={(event) => setEditingForm((current) => ({ ...current, carrierId: event.target.value }))}
            >
              {carriers.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>{carrier.name}</option>
              ))}
            </SelectField>
            <Field
              label="归属地"
              value={editingForm.location}
              onChange={(event) => setEditingForm((current) => ({ ...current, location: event.target.value }))}
            />
            <DatePickerField
              label="开卡时间"
              value={editingForm.activationDate}
              onChange={(value) => setEditingForm((current) => ({ ...current, activationDate: value }))}
              clearable={false}
            />
          </div>
        </div>

        <div className="card-edit-section">
          <div className="card-edit-section-label">费用信息</div>
          <div className="card-modal-grid card-modal-grid-financial">
            <Field
              label="当前余额（元）"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.balance}
              onChange={(event) => setEditingForm((current) => ({ ...current, balance: event.target.value }))}
            />
            <Field
              label="月租（元）"
              type="number"
              min="0"
              step="0.01"
              value={editingForm.monthlyFee}
              onChange={(event) => setEditingForm((current) => ({ ...current, monthlyFee: event.target.value }))}
            />
            <Field
              label="账单日（每月几号）"
              type="number"
              min="1"
              max="31"
              value={editingForm.billingDay}
              onChange={(event) => setEditingForm((current) => ({ ...current, billingDay: event.target.value }))}
            />
          </div>
        </div>

        <div className="card-edit-section">
          <div className="card-edit-section-label">套餐详情</div>
          <div className="card-modal-grid card-modal-grid-plan">
            <Field
              label="流量套餐"
              value={editingForm.dataPlan}
              onChange={(event) => setEditingForm((current) => ({ ...current, dataPlan: event.target.value }))}
              placeholder="如 70GB/月"
            />
            <Field
              label="通话分钟"
              value={editingForm.callMinutes}
              onChange={(event) => setEditingForm((current) => ({ ...current, callMinutes: event.target.value }))}
              placeholder="如 100分钟/月"
            />
            <Field
              label="短信条数"
              value={editingForm.smsCount}
              onChange={(event) => setEditingForm((current) => ({ ...current, smsCount: event.target.value }))}
              placeholder="如 50条/月"
            />
          </div>
        </div>

        <TextArea
          label="备注"
          value={editingForm.notes}
          onChange={(event) => setEditingForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="记录号卡用途、套餐变更或重要说明"
        />
      </Modal>

      <Modal
        open={Boolean(rechargeRecord)}
        onClose={() => {
          setRechargeRecord(null);
          setRechargeForm(createDefaultRechargeForm());
        }}
        title={rechargeRecord ? `充值：${rechargeRecord.phoneNumber}` : '充值'}
        width={640}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => {
              setRechargeRecord(null);
              setRechargeForm(createDefaultRechargeForm());
            }}
            >
              取消
            </Btn>
            <Btn tone="primary" onClick={handleRecharge}>保存充值</Btn>
          </>
        )}
      >
        <div className="card-recharge-grid">
          <Field label="当前号码" value={rechargeRecord?.phoneNumber ?? ''} disabled />
          <Field
            label="充值金额"
            type="number"
            min="0"
            step="0.01"
            value={rechargeForm.amount}
            onChange={(event) => setRechargeForm((current) => ({ ...current, amount: event.target.value }))}
            placeholder="0.00"
          />
          <DatePickerField
            label="充值日期"
            value={rechargeForm.rechargeDate}
            onChange={(value) => setRechargeForm((current) => ({ ...current, rechargeDate: value }))}
            clearable={false}
          />
        </div>
        <TextArea
          label="备注"
          value={rechargeForm.note}
          onChange={(event) => setRechargeForm((current) => ({ ...current, note: event.target.value }))}
          placeholder="例如 活动充值、自动充值、线下缴费等"
        />
      </Modal>

      <DeleteModal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={pendingDelete ? `删除号卡：${pendingDelete.phoneNumber}` : '删除号卡'}
      >
        删除后不会自动清理已录入的账单和充值历史，请确认是否继续。
      </DeleteModal>
    </SectionCard>
  );
}
