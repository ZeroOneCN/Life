import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { EmptyState, PageHeader, SectionCard, StatGrid } from '../../components/page';
import {
  Btn,
  Checkbox,
  DataTable,
  EyeIcon,
  Field,
  IconBtn,
  Modal,
  PillTabs,
  SelectField,
  Switch,
  Tag,
  Toast,
  useToastState,
} from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { billApi } from '../../services/billApi';
import type { UnifiedBill, BillSummary, BillReminderSetting, BillType, BillStatus } from '../../types/bill';
import { BILL_TYPE_LABELS, BILL_STATUS_LABELS } from '../../types/bill';
import type { TableColumn } from '../../types/ui';

type ViewMode = 'calendar' | 'list';
type TabKey = 'all' | 'pending' | 'paid' | 'overdue';

const TAB_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待支付' },
  { value: 'paid', label: '已支付' },
  { value: 'overdue', label: '已逾期' },
];

const VIEW_OPTIONS = [
  { value: 'calendar', label: '日历视图' },
  { value: 'list', label: '列表视图' },
];

const STATUS_COLOR: Record<BillStatus, 'red' | 'green' | 'orange'> = {
  pending: 'orange',
  paid: 'green',
  overdue: 'red',
};

const TYPE_COLOR: Record<BillType, 'blue' | 'pink' | 'green'> = {
  loan: 'blue',
  subscription: 'pink',
  rent: 'green',
};

/**
 * 账单提醒页面。
 *
 * 提供统一账单日历视图，聚合贷款、订阅、房租等账单数据，
 * 支持月历视图和列表视图切换，以及账单支付状态标记。
 */
export default function BillPage() {
  const { toast, showToast } = useToastState();
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedType, setSelectedType] = useState<string>('all');

  const [bills, setBills] = useState<UnifiedBill[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [summary, setSummary] = useState<BillSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [setting, setSetting] = useState<BillReminderSetting | null>(null);
  const [settingModalOpen, setSettingModalOpen] = useState(false);
  const [settingForm, setSettingForm] = useState<Partial<BillReminderSetting>>({});
  const [settingSaving, setSettingSaving] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<UnifiedBill | null>(null);

  const loadSummary = useCallback(async (month: string) => {
    setSummaryLoading(true);
    try {
      const data = await billApi.getSummary(month);
      setSummary(data);
    } catch (err) {
      showToast(`加载统计失败：${buildApiErrorMessage(err)}`, 'error');
    } finally {
      setSummaryLoading(false);
    }
  }, [showToast]);

  const loadBills = useCallback(async (month: string, typeFilter: string) => {
    setBillsLoading(true);
    try {
      const types = typeFilter === 'all' ? undefined : [typeFilter as BillType];
      const data = await billApi.getCalendar(month, types);
      setBills(data);
    } catch (err) {
      showToast(`加载账单失败：${buildApiErrorMessage(err)}`, 'error');
    } finally {
      setBillsLoading(false);
    }
  }, [showToast]);

  const loadSetting = useCallback(async () => {
    try {
      const data = await billApi.getSetting();
      setSetting(data);
    } catch (err) {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    void loadSummary(selectedMonth);
    void loadBills(selectedMonth, selectedType);
    void loadSetting();
  }, [selectedMonth, selectedType, loadSummary, loadBills, loadSetting]);

  const filteredBills = useMemo(() => {
    if (activeTab === 'all') return bills;
    return bills.filter((b) => b.status === activeTab);
  }, [bills, activeTab]);

  const calendarDays = useMemo(() => {
    const monthMoment = dayjs(`${selectedMonth}-01`);
    const startDay = monthMoment.startOf('month').startOf('week');
    const endDay = monthMoment.endOf('month').endOf('week');
    const days: Array<{
      date: string;
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      bills: UnifiedBill[];
    }> = [];

    let current = startDay;
    while (current.isBefore(endDay) || current.isSame(endDay, 'day')) {
      const dateStr = current.format('YYYY-MM-DD');
      const dayBills = filteredBills.filter((b) => dayjs(b.due_date).isSame(current, 'day'));
      days.push({
        date: dateStr,
        day: current.date(),
        isCurrentMonth: current.month() === monthMoment.month(),
        isToday: current.isSame(dayjs(), 'day'),
        bills: dayBills,
      });
      current = current.add(1, 'day');
    }
    return days;
  }, [selectedMonth, filteredBills]);

  const handlePrevMonth = () => {
    setSelectedMonth(dayjs(`${selectedMonth}-01`).subtract(1, 'month').format('YYYY-MM'));
  };

  const handleNextMonth = () => {
    setSelectedMonth(dayjs(`${selectedMonth}-01`).add(1, 'month').format('YYYY-MM'));
  };

  const handleToday = () => {
    setSelectedMonth(dayjs().format('YYYY-MM'));
  };

  const handleOpenSetting = () => {
    if (setting) {
      setSettingForm({
        reminder_enabled: setting.reminder_enabled,
        lead_days: setting.lead_days,
        enabled_types: setting.enabled_types,
        reminder_time: setting.reminder_time,
        notes: setting.notes,
      });
    }
    setSettingModalOpen(true);
  };

  const handleSaveSetting = async () => {
    setSettingSaving(true);
    try {
      const data = await billApi.updateSetting(settingForm);
      setSetting(data);
      setSettingModalOpen(false);
      showToast('提醒设置已保存', 'success');
    } catch (err) {
      showToast(`保存失败：${buildApiErrorMessage(err)}`, 'error');
    } finally {
      setSettingSaving(false);
    }
  };

  const handleViewDetail = (bill: UnifiedBill) => {
    setSelectedBill(bill);
    setDetailModalOpen(true);
  };

  const handleMarkPaid = async (bill: UnifiedBill) => {
    try {
      if (bill.type !== 'loan') {
        showToast('该账单类型暂不支持手动标记', 'warning');
        return;
      }
      const sourceId = bill.id.replace('loan_', '');
      await billApi.markPaid('loan', sourceId);
      showToast('已标记为已支付', 'success');
      void loadBills(selectedMonth, selectedType);
      void loadSummary(selectedMonth);
      setDetailModalOpen(false);
    } catch (err) {
      showToast(`操作失败：${buildApiErrorMessage(err)}`, 'error');
    }
  };

  const statItems = useMemo(() => {
    if (!summary) return [];
    return [
      { label: '账单总数', value: String(summary.total_count), helper: `¥${summary.total_amount.toFixed(2)}` },
      { label: '待支付', value: String(summary.pending_count), helper: `¥${summary.pending_amount.toFixed(2)}`, accent: '#f59e0b' },
      { label: '已支付', value: String(summary.paid_count), helper: `¥${summary.paid_amount.toFixed(2)}`, accent: '#10b981' },
      { label: '已逾期', value: String(summary.overdue_count), helper: `¥${summary.overdue_amount.toFixed(2)}`, accent: '#ef4444' },
    ];
  }, [summary]);

  const tableColumns: TableColumn<UnifiedBill>[] = [
    {
      key: 'title',
      title: '账单名称',
      render: (_value, row) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontWeight: 500 }}>{row.title}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <Tag tone={TYPE_COLOR[row.type]} size="sm">{BILL_TYPE_LABELS[row.type]}</Tag>
            <Tag tone={STATUS_COLOR[row.status]} size="sm">{BILL_STATUS_LABELS[row.status]}</Tag>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      title: '金额',
      align: 'right',
      render: (_value, row) => <span style={{ fontWeight: 600 }}>¥{row.amount.toFixed(2)}</span>,
    },
    {
      key: 'due_date',
      title: '到期日',
      render: (_value, row) => <span>{row.due_date}</span>,
    },
    {
      key: 'category',
      title: '分类',
      render: (_value, row) => <span style={{ color: 'var(--color-ink-mute)' }}>{row.category}</span>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 60,
      align: 'right',
      render: (_value, row) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IconBtn icon={<EyeIcon />} title="查看详情" onClick={() => handleViewDetail(row)} />
        </div>
      ),
    },
  ];

  const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="page-stack">
      <PageHeader
        title="账单提醒"
        subtitle="统一管理贷款、订阅、房租等账单，避免逾期"
        actions={
          <Btn tone="ghost" onClick={handleOpenSetting}>
            提醒设置
          </Btn>
        }
      />

      <StatGrid items={statItems} />

      <SectionCard
        title="账单日历"
        description={`${dayjs(selectedMonth).format('YYYY年M月')} 共 ${filteredBills.length} 笔账单`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SelectField
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              style={{ width: 120 }}
            >
              <option value="all">全部类型</option>
              <option value="loan">贷款还款</option>
              <option value="subscription">服务订阅</option>
              <option value="rent">房租水电</option>
            </SelectField>
            <PillTabs
              value={viewMode}
              onChange={(v) => setViewMode(v as ViewMode)}
              options={VIEW_OPTIONS}
            />
          </div>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Btn tone="ghost" onClick={handlePrevMonth}>上月</Btn>
            <Btn tone="ghost" onClick={handleToday}>今天</Btn>
            <Btn tone="ghost" onClick={handleNextMonth}>下月</Btn>
          </div>
          <PillTabs
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabKey)}
            options={TAB_OPTIONS}
          />
        </div>

        {viewMode === 'calendar' ? (
          <div className="bill-calendar">
            <div className="bill-calendar-header">
              {WEEK_DAYS.map((d) => (
                <div key={d} className="bill-calendar-weekday">{d}</div>
              ))}
            </div>
            <div className="bill-calendar-grid">
              {calendarDays.map((day) => (
                <div
                  key={day.date}
                  className={`bill-calendar-day ${!day.isCurrentMonth ? 'is-other-month' : ''} ${day.isToday ? 'is-today' : ''}`}
                >
                  <div className="bill-calendar-day-num">{day.day}</div>
                  <div className="bill-calendar-day-bills">
                    {day.bills.slice(0, 3).map((bill) => (
                      <div
                        key={bill.id}
                        className={`bill-calendar-item bill-type-${bill.type} bill-status-${bill.status}`}
                        onClick={() => handleViewDetail(bill)}
                        title={`${bill.title} - ¥${bill.amount.toFixed(2)}`}
                      >
                        <span className="bill-calendar-item-title">{bill.title}</span>
                        <span className="bill-calendar-item-amount">¥{bill.amount.toFixed(0)}</span>
                      </div>
                    ))}
                    {day.bills.length > 3 && (
                      <div className="bill-calendar-more">+{day.bills.length - 3} 更多</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <DataTable
            columns={tableColumns}
            data={filteredBills}
            rowKey="id"
            emptyText="暂无账单记录"
          />
        )}

        {filteredBills.length === 0 && !billsLoading && (
          <EmptyState title="暂无账单" description="当前筛选条件下没有账单记录" />
        )}
      </SectionCard>

      {/* 账单详情弹窗 */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title="账单详情"
        width={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn tone="ghost" onClick={() => setDetailModalOpen(false)}>关闭</Btn>
            {selectedBill?.status === 'pending' && selectedBill?.type === 'loan' && (
              <Btn tone="primary" onClick={() => handleMarkPaid(selectedBill)}>标记已支付</Btn>
            )}
          </div>
        }
      >
        {selectedBill && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{selectedBill.title}</h3>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <Tag tone={TYPE_COLOR[selectedBill.type]}>{BILL_TYPE_LABELS[selectedBill.type]}</Tag>
                  <Tag tone={STATUS_COLOR[selectedBill.status]}>{BILL_STATUS_LABELS[selectedBill.status]}</Tag>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 24, fontWeight: 700 }}>¥{selectedBill.amount.toFixed(2)}</div>
                <div style={{ fontSize: 13, color: 'var(--color-ink-mute)' }}>到期金额</div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px 24px',
                paddingTop: 16,
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: 'var(--color-ink-mute)', marginBottom: 4 }}>到期日</div>
                <div style={{ fontWeight: 500 }}>{selectedBill.due_date}</div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--color-ink-mute)', marginBottom: 4 }}>来源</div>
                <div style={{ fontWeight: 500 }}>{selectedBill.source_name}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 13, color: 'var(--color-ink-mute)', marginBottom: 4 }}>分类</div>
                <div style={{ fontWeight: 500 }}>{selectedBill.category}</div>
              </div>
              {selectedBill.notes && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 13, color: 'var(--color-ink-mute)', marginBottom: 4 }}>备注</div>
                  <div>{selectedBill.notes}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 提醒设置弹窗 */}
      <Modal
        open={settingModalOpen}
        onClose={() => setSettingModalOpen(false)}
        title="账单提醒设置"
        width={480}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn tone="ghost" onClick={() => setSettingModalOpen(false)}>取消</Btn>
            <Btn tone="primary" onClick={handleSaveSetting} disabled={settingSaving}>
              {settingSaving ? '保存中...' : '保存'}
            </Btn>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Switch
            label="开启账单提醒"
            checked={settingForm.reminder_enabled ?? true}
            onChange={(v) => setSettingForm({ ...settingForm, reminder_enabled: v })}
          />

          <SelectField
            label="提前提醒天数"
            value={String(settingForm.lead_days ?? 7)}
            onChange={(e) => setSettingForm({ ...settingForm, lead_days: Number(e.target.value) })}
          >
            <option value="1">提前 1 天</option>
            <option value="3">提前 3 天</option>
            <option value="7">提前 7 天</option>
            <option value="14">提前 14 天</option>
            <option value="30">提前 30 天</option>
          </SelectField>

          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>提醒的账单类型</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {(['loan', 'subscription', 'rent'] as BillType[]).map((type) => {
                const types = (settingForm.enabled_types ?? 'loan,subscription,rent').split(',').filter(Boolean);
                const checked = types.includes(type);
                return (
                  <Checkbox
                    key={type}
                    checked={checked}
                    onChange={(v) => {
                      const current = (settingForm.enabled_types ?? 'loan,subscription,rent').split(',').filter(Boolean);
                      if (v) {
                        setSettingForm({ ...settingForm, enabled_types: [...current, type].join(',') });
                      } else {
                        setSettingForm({ ...settingForm, enabled_types: current.filter((t) => t !== type).join(',') });
                      }
                    }}
                  >
                    {BILL_TYPE_LABELS[type]}
                  </Checkbox>
                );
              })}
            </div>
          </div>

          <SelectField
            label="每日提醒时间"
            value={settingForm.reminder_time ?? '09:00'}
            onChange={(e) => setSettingForm({ ...settingForm, reminder_time: e.target.value })}
          >
            <option value="07:00">07:00</option>
            <option value="08:00">08:00</option>
            <option value="09:00">09:00</option>
            <option value="10:00">10:00</option>
            <option value="12:00">12:00</option>
            <option value="18:00">18:00</option>
            <option value="20:00">20:00</option>
            <option value="21:00">21:00</option>
          </SelectField>

          <div
            style={{
              fontSize: 12,
              color: 'var(--color-ink-mute)',
              paddingTop: 12,
              borderTop: '1px solid var(--color-border)',
            }}
          >
            提醒渠道、模板等高级配置请前往 <strong>通知中心</strong> 设置。
          </div>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
