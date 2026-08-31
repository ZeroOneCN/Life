import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { DatePickerField, DateRangePicker } from '../date';
import { EmptyState, SectionCard, StatGrid } from '../page';
import {
  Btn,
  Checkbox,
  DataTable,
  DeleteModal,
  Field,
  Modal,
  Pagination,
  SelectField,
  Tag,
  TextArea,
} from '../ui';
import {
  FOREX_CAPITAL_PAGE_SIZE,
  FOREX_CAPITAL_TYPE_OPTIONS,
  createForexCapitalFlow,
  deleteForexCapitalFlow,
  filterForexCapitalFlows,
  formatForexMoney,
  getForexCapitalTypeLabel,
  updateForexCapitalFlow,
} from '../../services/forex';
import type {
  ForexCapitalFlow,
  ForexCapitalFlowDraft,
  ForexCapitalFlowType,
} from '../../types/forex';

interface ForexCapitalSectionProps {
  capitalFlows: ForexCapitalFlow[];
  onChangeCapitalFlows: (updater: (records: ForexCapitalFlow[]) => ForexCapitalFlow[]) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

interface CapitalFormState {
  flowDate: string;
  flowType: ForexCapitalFlowType;
  amount: string;
  remark: string;
  isBonus: boolean;
}

function createDefaultFormState(): CapitalFormState {
  return {
    flowDate: dayjs().format('YYYY-MM-DD'),
    flowType: 'deposit',
    amount: '',
    remark: '',
    isBonus: false,
  };
}

function buildFormState(record: ForexCapitalFlow): CapitalFormState {
  return {
    flowDate: record.flowDate,
    flowType: record.flowType,
    amount: String(record.amount),
    remark: record.remark,
    isBonus: Boolean(record.isBonus),
  };
}

function parseDraft(form: CapitalFormState): ForexCapitalFlowDraft | null {
  const amount = Number(form.amount);

  if (!dayjs(form.flowDate).isValid() || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return {
    flowDate: form.flowDate,
    flowType: form.flowType,
    amount,
    remark: form.remark.trim(),
    isBonus: form.flowType === 'deposit' ? form.isBonus : false,
  };
}

/** 判断当前类型是否需要显示体验金复选框（仅入金类型需要） */
function shouldShowBonusCheckbox(flowType: ForexCapitalFlowType) {
  return flowType === 'deposit';
}

/** 获取流水类型的标签色调 */
function getFlowTypeTone(flowType: ForexCapitalFlowType): 'green' | 'red' | 'orange' {
  if (flowType === 'deposit') return 'green';
  if (flowType === 'withdrawal') return 'red';
  if (flowType === 'bonus_loss') return 'red';
  return 'orange';
}

export function ForexCapitalSection({
  capitalFlows,
  onChangeCapitalFlows,
  showToast,
}: ForexCapitalSectionProps) {
  const [form, setForm] = useState<CapitalFormState>(() => createDefaultFormState());
  const [editingRecord, setEditingRecord] = useState<ForexCapitalFlow | null>(null);
  const [editingForm, setEditingForm] = useState<CapitalFormState>(() => createDefaultFormState());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [flowTypeFilter, setFlowTypeFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const filteredFlows = useMemo(
    () =>
      filterForexCapitalFlows(capitalFlows, {
        flowType: flowTypeFilter,
        startDate: startDateFilter,
        endDate: endDateFilter,
        keyword,
      }),
    [capitalFlows, startDateFilter, endDateFilter, flowTypeFilter, keyword],
  );

  useEffect(() => {
    setPage(1);
  }, [startDateFilter, endDateFilter, flowTypeFilter, keyword]);

  const totalPages = Math.max(1, Math.ceil(filteredFlows.length / FOREX_CAPITAL_PAGE_SIZE));
  const pageRecords = useMemo(() => {
    const startIndex = (page - 1) * FOREX_CAPITAL_PAGE_SIZE;
    return filteredFlows.slice(startIndex, startIndex + FOREX_CAPITAL_PAGE_SIZE);
  }, [filteredFlows, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const totalDeposit = filteredFlows
      .filter((record) => record.flowType === 'deposit' && !record.isBonus)
      .reduce((sum, record) => sum + record.amount, 0);
    const totalBonusDeposit = filteredFlows
      .filter((record) => record.flowType === 'deposit' && record.isBonus)
      .reduce((sum, record) => sum + record.amount, 0);
    const totalWithdrawal = filteredFlows
      .filter((record) => record.flowType === 'withdrawal')
      .reduce((sum, record) => sum + record.amount, 0);
    const totalBonusExpired = filteredFlows
      .filter((record) => record.flowType === 'bonus_expired')
      .reduce((sum, record) => sum + record.amount, 0);
    const totalBonusLoss = filteredFlows
      .filter((record) => record.flowType === 'bonus_loss')
      .reduce((sum, record) => sum + record.amount, 0);
    const remainingBonus = Math.max(0, totalBonusDeposit - totalBonusExpired - totalBonusLoss);

    return {
      count: filteredFlows.length,
      totalDeposit,
      totalBonusDeposit,
      totalWithdrawal,
      totalBonusExpired,
      totalBonusLoss,
      remainingBonus,
      netCapital: totalDeposit + totalBonusExpired - totalWithdrawal,
    };
  }, [filteredFlows]);

  const columns = useMemo(
    () => [
      { key: 'flowDate', title: '日期', dataIndex: 'flowDate' as const },
      {
        key: 'flowType',
        title: '类型',
        render: (_value: unknown, row: ForexCapitalFlow) => (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Tag tone={getFlowTypeTone(row.flowType)}>{getForexCapitalTypeLabel(row.flowType)}</Tag>
            {row.flowType === 'deposit' && row.isBonus && <Tag tone="blue">体验金</Tag>}
          </div>
        ),
      },
      {
        key: 'amount',
        title: '金额',
        render: (_value: unknown, row: ForexCapitalFlow) => {
          if (row.flowType === 'bonus_expired') {
            return (
              <strong style={{ color: 'var(--color-ink-subtle)' }}>
                {formatForexMoney(row.amount)}
              </strong>
            );
          }
          const isDeposit = row.flowType === 'deposit';
          return (
            <strong style={{ color: isDeposit ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {`${isDeposit ? '+' : '-'}${formatForexMoney(row.amount)}`}
            </strong>
          );
        },
      },
      {
        key: 'remark',
        title: '备注',
        width: 160,
        render: (_value: unknown, row: ForexCapitalFlow) => {
          if (!row.remark) return '-';
          return (
            <span
              title={row.remark}
              style={{
                display: 'inline-block',
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                verticalAlign: 'middle',
                cursor: 'default',
              }}
            >
              {row.remark}
            </span>
          );
        },
      },
      {
        key: 'actions',
        title: '操作',
        render: (_value: unknown, row: ForexCapitalFlow) => (
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
            <Btn tone="danger" onClick={() => setPendingDeleteId(row.id)}>
              删除
            </Btn>
          </div>
        ),
      },
    ],
    [],
  );

  const handleCreate = () => {
    const draft = parseDraft(form);

    if (!draft) {
      showToast('请补全出入金日期和金额。', 'error');
      return;
    }

    onChangeCapitalFlows((current) => createForexCapitalFlow(current, draft));
    setForm(createDefaultFormState());
    showToast('出入金记录已保存。');
  };

  const handleUpdate = () => {
    if (!editingRecord) {
      return;
    }

    const draft = parseDraft(editingForm);

    if (!draft) {
      showToast('请补全编辑中的出入金字段。', 'error');
      return;
    }

    onChangeCapitalFlows((current) => updateForexCapitalFlow(current, editingRecord.id, draft));
    setEditingRecord(null);
    setEditingForm(createDefaultFormState());
    showToast('出入金记录已更新。');
  };

  return (
    <SectionCard title="出入金" description="管理账户资本流，支持日期范围筛选与统计。">
      <div className="page-stack">
        {/* 表单区 */}
        <form
          className="forex-capital-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleCreate();
          }}
        >
          <div className="forex-capital-form-grid">
            <DatePickerField
              label="日期"
              value={form.flowDate}
              onChange={(value) => setForm((current) => ({ ...current, flowDate: value }))}
              placeholder="选择日期"
            />
            <SelectField
              label="类型"
              value={form.flowType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  flowType: event.target.value as ForexCapitalFlowType,
                  isBonus: event.target.value === 'deposit' ? current.isBonus : false,
                }))
              }
            >
              {FOREX_CAPITAL_TYPE_OPTIONS.map((flowType) => (
                <option key={flowType} value={flowType}>
                  {getForexCapitalTypeLabel(flowType)}
                </option>
              ))}
            </SelectField>
            <Field
              label="金额"
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
              placeholder="5000"
            />
            <Field
              label="备注"
              value={form.remark}
              onChange={(event) =>
                setForm((current) => ({ ...current, remark: event.target.value }))
              }
              placeholder="例如：初始入金"
            />
          </div>
          <div className="forex-capital-form-actions">
            {shouldShowBonusCheckbox(form.flowType) ? (
              <Checkbox
                checked={form.isBonus}
                onChange={(checked) => setForm((current) => ({ ...current, isBonus: checked }))}
              >
                体验金
              </Checkbox>
            ) : null}
            <Btn tone="primary" type="submit">
              保存
            </Btn>
          </div>
        </form>

        {/* 统计卡片 - 精简为6个核心指标 */}
        <StatGrid
          items={[
            { label: '记录数', value: `${summary.count} 条` },
            {
              label: '累计入金',
              value: formatForexMoney(summary.totalDeposit),
              accent: 'var(--color-success)',
            },
            {
              label: '累计出金',
              value: formatForexMoney(summary.totalWithdrawal),
              accent: 'var(--color-danger)',
            },
            {
              label: '净入金',
              value: formatForexMoney(summary.netCapital),
              accent: summary.netCapital >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            },
            {
              label: '体验金入金',
              value: formatForexMoney(summary.totalBonusDeposit),
              accent: '#3b82f6',
            },
            {
              label: '剩余体验金',
              value: formatForexMoney(summary.remainingBonus),
              accent: '#8b5cf6',
            },
          ]}
        />

        {/* 筛选区 - 日期范围 + 类型 + 关键词 */}
        <div className="forex-filter-grid">
          <DateRangePicker
            startDate={startDateFilter}
            endDate={endDateFilter}
            onChange={(start, end) => {
              setStartDateFilter(start);
              setEndDateFilter(end);
            }}
            placeholder="日期范围"
          />
          <SelectField
            label="类型"
            value={flowTypeFilter}
            onChange={(event) => setFlowTypeFilter(event.target.value)}
          >
            <option value="">全部类型</option>
            {FOREX_CAPITAL_TYPE_OPTIONS.map((flowType) => (
              <option key={flowType} value={flowType}>
                {getForexCapitalTypeLabel(flowType)}
              </option>
            ))}
          </SelectField>
          <Field
            label="关键词"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索备注"
          />
        </div>

        {/* 数据表格 */}
        {pageRecords.length ? (
          <>
            <DataTable
              columns={columns}
              data={pageRecords}
              rowKey="id"
              className="forex-capital-table"
            />
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        ) : (
          <EmptyState
            title="暂无出入金记录"
            description="保存一条入金或出金记录，这里会开始形成账户资本流。"
          />
        )}

        {/* 编辑弹窗 */}
        <Modal
          open={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          title="编辑出入金记录"
          width={760}
          footer={
            <>
              <Btn tone="secondary" onClick={() => setEditingRecord(null)}>
                取消
              </Btn>
              <Btn tone="primary" onClick={handleUpdate}>
                保存修改
              </Btn>
            </>
          }
        >
          <div className="forex-modal-grid forex-modal-grid-capital">
            <DatePickerField
              label="日期"
              value={editingForm.flowDate}
              onChange={(value) => setEditingForm((current) => ({ ...current, flowDate: value }))}
              placeholder="选择日期"
            />
            <SelectField
              label="类型"
              value={editingForm.flowType}
              onChange={(event) =>
                setEditingForm((current) => ({
                  ...current,
                  flowType: event.target.value as ForexCapitalFlowType,
                  isBonus: event.target.value === 'deposit' ? current.isBonus : false,
                }))
              }
            >
              {FOREX_CAPITAL_TYPE_OPTIONS.map((flowType) => (
                <option key={flowType} value={flowType}>
                  {getForexCapitalTypeLabel(flowType)}
                </option>
              ))}
            </SelectField>
            <Field
              label="金额"
              value={editingForm.amount}
              onChange={(event) =>
                setEditingForm((current) => ({ ...current, amount: event.target.value }))
              }
            />
            <TextArea
              label="备注"
              value={editingForm.remark}
              onChange={(event) =>
                setEditingForm((current) => ({ ...current, remark: event.target.value }))
              }
              rows={4}
              placeholder="记录这笔出入金的上下文"
            />
            {shouldShowBonusCheckbox(editingForm.flowType) ? (
              <div className="forex-capital-modal-bonus">
                <Checkbox
                  checked={editingForm.isBonus}
                  onChange={(checked) =>
                    setEditingForm((current) => ({ ...current, isBonus: checked }))
                  }
                >
                  体验金
                </Checkbox>
              </div>
            ) : null}
          </div>
        </Modal>

        {/* 删除确认 */}
        <DeleteModal
          open={Boolean(pendingDeleteId)}
          onClose={() => setPendingDeleteId(null)}
          title="删除出入金记录"
          onConfirm={() => {
            if (!pendingDeleteId) {
              return;
            }

            onChangeCapitalFlows((current) => deleteForexCapitalFlow(current, pendingDeleteId));
            setPendingDeleteId(null);
            showToast('出入金记录已删除。');
          }}
        >
          删除后净入金、净值和 ROI 都会同步重算。
        </DeleteModal>
      </div>
    </SectionCard>
  );
}
