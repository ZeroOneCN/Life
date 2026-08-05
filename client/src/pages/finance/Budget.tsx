import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';

import { EmptyState, PageHeader, SectionCard, StatGrid } from '../../components/page';
import {
  PillTabs,
  Btn,
  DataTable,
  DeleteModal,
  Modal,
  Pagination,
  Field,
  SelectField,
  Switch,
  Tag,
  TextArea,
  IconBtn,
  EditIcon,
  DeleteIcon,
  Toast,
  useToastState,
} from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import { budgetApi } from '../../services/budgetApi';
import type {
  Budget,
  BudgetCategory,
  BudgetHistory,
  BudgetPeriodType,
  BudgetProgressOverview,
  BudgetType,
  BudgetYearlyComparison,
} from '../../types/budget';
import type { TableColumn } from '../../types/ui';

type TabKey = 'overview' | 'budgets' | 'comparison' | 'history';

const TAB_OPTIONS = [
  { value: 'overview', label: '预算看板' },
  { value: 'budgets', label: '预算管理' },
  { value: 'comparison', label: '对比分析' },
  { value: 'history', label: '调整历史' },
];

const BUDGET_PAGE_SIZE = 10;
const HISTORY_PAGE_SIZE = 20;

/**
 * 预算管理页面。
 *
 * 4 个 Tab：
 * - 预算看板：当月预算执行总览、各分类进度卡片、状态统计
 * - 预算管理：预算列表、新增/编辑/删除预算、分类管理
 * - 对比分析：年度预算 vs 实际对比趋势图
 * - 调整历史：预算金额调整记录
 */
export default function BudgetPage({ embedded = false }: { embedded?: boolean }) {
  const { toast, showToast } = useToastState();
  const [activeTab, setActiveTab] = usePageTab<TabKey>('overview', ['overview', 'budgets', 'comparison', 'history'], 'budgetTab');
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedYear, setSelectedYear] = useState(dayjs().year());

  // 概览看板
  const [progressOverview, setProgressOverview] = useState<BudgetProgressOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // 预算列表
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetsTotal, setBudgetsTotal] = useState(0);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetPage, setBudgetPage] = useState(1);
  const [budgetFilterType, setBudgetFilterType] = useState('all');
  const [budgetFilterPeriod, setBudgetFilterPeriod] = useState('all');
  const [budgetFilterActive, setBudgetFilterActive] = useState('all');
  const [budgetKeyword, setBudgetKeyword] = useState('');

  // 分类列表
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // 年度对比
  const [yearlyComparison, setYearlyComparison] = useState<BudgetYearlyComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(true);

  // 历史记录
  const [history, setHistory] = useState<BudgetHistory[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);

  // 预算编辑弹窗
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // 删除确认
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);

  // 分类管理弹窗
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  /**
   * 加载预算执行进度总览。
   */
  const loadOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      const data = await budgetApi.getProgress(selectedMonth, selectedYear);
      setProgressOverview(data);
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    } finally {
      setOverviewLoading(false);
    }
  }, [selectedMonth, selectedYear, showToast]);

  /**
   * 加载预算列表。
   */
  const loadBudgets = useCallback(async () => {
    try {
      setBudgetsLoading(true);
      const data = await budgetApi.listBudgets({
        page: budgetPage,
        pageSize: BUDGET_PAGE_SIZE,
        type: budgetFilterType,
        periodType: budgetFilterPeriod,
        active: budgetFilterActive,
        keyword: budgetKeyword || undefined,
      });
      setBudgets(data.items);
      setBudgetsTotal(data.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    } finally {
      setBudgetsLoading(false);
    }
  }, [budgetPage, budgetFilterType, budgetFilterPeriod, budgetFilterActive, budgetKeyword, showToast]);

  /**
   * 加载预算分类。
   */
  const loadCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const data = await budgetApi.getCategories();
      setCategories(data.items);
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    } finally {
      setCategoriesLoading(false);
    }
  }, [showToast]);

  /**
   * 加载年度对比数据。
   */
  const loadComparison = useCallback(async () => {
    try {
      setComparisonLoading(true);
      const data = await budgetApi.getYearlyComparison(selectedYear);
      setYearlyComparison(data);
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    } finally {
      setComparisonLoading(false);
    }
  }, [selectedYear, showToast]);

  /**
   * 加载调整历史。
   */
  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const data = await budgetApi.listHistory({
        page: historyPage,
        pageSize: HISTORY_PAGE_SIZE,
      });
      setHistory(data.items);
      setHistoryTotal(data.total);
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, showToast]);

  function handleAddBudget() {
    setEditingBudget(null);
    setBudgetModalOpen(true);
  }

  function handleEditBudget(budget: Budget) {
    setEditingBudget(budget);
    setBudgetModalOpen(true);
  }

  async function handleSaveBudget(data: BudgetFormData) {
    try {
      if (editingBudget) {
        await budgetApi.updateBudget(editingBudget.id, data);
        showToast('预算已更新', 'success');
      } else {
        await budgetApi.createBudget(data);
        showToast('预算已创建', 'success');
      }
      setBudgetModalOpen(false);
      void loadOverview();
      void loadBudgets();
      void loadComparison();
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    }
  }

  function handleDeleteBudget(budget: Budget) {
    setDeletingBudget(budget);
    setDeleteModalOpen(true);
  }

  async function confirmDeleteBudget() {
    if (!deletingBudget) return;
    try {
      await budgetApi.deleteBudget(deletingBudget.id);
      showToast('预算已删除', 'success');
      setDeleteModalOpen(false);
      setDeletingBudget(null);
      void loadOverview();
      void loadBudgets();
      void loadComparison();
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    }
  }

  async function handleTriggerAlerts() {
    try {
      const data = await budgetApi.triggerAlerts();
      showToast(`已触发 ${data.count} 条预警通知`, 'success');
      void loadOverview();
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    }
  }

  useEffect(() => {
    if (activeTab === 'overview') void loadOverview();
  }, [activeTab, loadOverview]);

  useEffect(() => {
    if (activeTab === 'budgets') {
      void loadBudgets();
      void loadCategories();
    }
  }, [activeTab, loadBudgets, loadCategories]);

  useEffect(() => {
    if (activeTab === 'comparison') void loadComparison();
  }, [activeTab, loadComparison]);

  useEffect(() => {
    if (activeTab === 'history') void loadHistory();
  }, [activeTab, loadHistory]);

  const overviewCards = progressOverview
    ? [
        { label: '当月预算总额', value: `¥${progressOverview.totalBudget.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
        { label: '已支出', value: `¥${progressOverview.totalActual.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`, helper: `进度 ${progressOverview.overallPercent.toFixed(1)}%` },
        {
          label: '剩余预算',
          value: `¥${progressOverview.totalRemaining.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`,
          accent: progressOverview.totalRemaining >= 0 ? 'var(--color-success-strong)' : 'var(--color-danger-strong)',
        },
      ]
    : [];

  return (
    <div className="page-stack">
      {embedded ? (
        <div className="merged-toolbar">
          <PillTabs
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={(value) => setActiveTab(value as TabKey)}
          />
          <Btn tone="secondary" onClick={handleTriggerAlerts}>检查预警</Btn>
          <Btn tone="primary" onClick={handleAddBudget}>新增预算</Btn>
        </div>
      ) : (
        <PageHeader
          title="预算管理"
          subtitle="设定月度预算，跟踪支出对比与调整记录"
          actions={
            <>
              <PillTabs
                options={TAB_OPTIONS}
                value={activeTab}
                onChange={(value) => setActiveTab(value as TabKey)}
              />
              <Btn tone="secondary" onClick={handleTriggerAlerts}>检查预警</Btn>
              <Btn tone="primary" onClick={handleAddBudget}>新增预算</Btn>
            </>
          }
        />
      )}

      {activeTab === 'overview' && progressOverview && (
        <StatGrid items={overviewCards} />
      )}

      {(activeTab === 'overview' || activeTab === 'budgets') ? (
        <div className="context-bar">
          <Field
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: 'auto' }}
          />
        </div>
      ) : activeTab === 'comparison' ? (
        <div className="context-bar">
          <SelectField
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ width: 'auto' }}
          >
            {Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i).map((y) => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </SelectField>
        </div>
      ) : null}

      {activeTab === 'overview' && progressOverview && (
        <BudgetOverviewSection overview={progressOverview} loading={overviewLoading} />
      )}

      {activeTab === 'budgets' && (
        <BudgetListSection
          budgets={budgets}
          total={budgetsTotal}
          loading={budgetsLoading}
          page={budgetPage}
          filterType={budgetFilterType}
          filterPeriod={budgetFilterPeriod}
          filterActive={budgetFilterActive}
          keyword={budgetKeyword}
          categories={categories}
          onPageChange={setBudgetPage}
          onFilterTypeChange={(v) => { setBudgetFilterType(v); setBudgetPage(1); }}
          onFilterPeriodChange={(v) => { setBudgetFilterPeriod(v); setBudgetPage(1); }}
          onFilterActiveChange={(v) => { setBudgetFilterActive(v); setBudgetPage(1); }}
          onKeywordChange={(v) => { setBudgetKeyword(v); setBudgetPage(1); }}
          onEdit={handleEditBudget}
          onDelete={handleDeleteBudget}
          onManageCategories={() => setCategoryModalOpen(true)}
        />
      )}

      {activeTab === 'comparison' && yearlyComparison && (
        <BudgetComparisonSection comparison={yearlyComparison} loading={comparisonLoading} />
      )}

      {activeTab === 'history' && (
        <BudgetHistorySection
          history={history}
          total={historyTotal}
          loading={historyLoading}
          page={historyPage}
          onPageChange={setHistoryPage}
        />
      )}

      {budgetModalOpen && (
        <BudgetEditModal
          budget={editingBudget}
          categories={categories}
          onClose={() => setBudgetModalOpen(false)}
          onSave={handleSaveBudget}
        />
      )}

      <DeleteModal
        open={deleteModalOpen}
        title={`删除「${deletingBudget?.name ?? ''}」`}
        confirmLabel="确认删除"
        confirmTone="danger-fill"
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteBudget}
      >
        删除后该预算的执行进度数据将无法恢复，确定要删除吗？
      </DeleteModal>

      {categoryModalOpen && (
        <CategoryManageModal
          categories={categories}
          loading={categoriesLoading}
          onClose={() => setCategoryModalOpen(false)}
          onChanged={() => {
            void loadCategories();
            void loadBudgets();
          }}
          showToast={showToast}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

// ===== 预算看板 =====

function BudgetOverviewSection({ overview, loading }: { overview: BudgetProgressOverview; loading: boolean }) {
  const statusTags = [
    { label: '正常', count: overview.onTrackCount, tone: 'green' as const },
    { label: '预警', count: overview.warningCount, tone: 'orange' as const },
    { label: '超支', count: overview.overBudgetCount, tone: 'red' as const },
  ];

  return (
    <SectionCard
      title="各分类预算执行"
      description={`${overview.month ?? ''} 预算执行明细，进度条按实际支出占比填充。`}
      action={
        <div style={{ display: 'flex', gap: 8 }}>
          {statusTags.map((tag) => (
            <Tag key={tag.label} tone={tag.tone}>{tag.label} {tag.count}</Tag>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="empty-state">正在加载预算执行数据...</div>
      ) : overview.items.length === 0 ? (
        <EmptyState title="暂无预算" description="点击右上角「新增预算」开始设置分类预算。" />
      ) : (
        <div className="page-stack">
          {overview.items.map((item) => {
            const barColor = item.status === 'over_budget'
              ? 'var(--color-danger)'
              : item.status === 'warning'
                ? 'var(--color-warning)'
                : 'var(--color-success)';
            const barWidth = Math.min(item.progressPercent, 100);
            return (
              <div key={item.budgetId} className="budget-progress-row">
                <div className="budget-progress-header">
                  <span className="budget-progress-name">{item.budgetName}</span>
                  <span className="subtle-text">
                    ¥{item.actualAmount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                    {' / '}
                    ¥{item.budgetAmount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="budget-progress-track">
                  <div
                    className="budget-progress-fill"
                    style={{ width: `${barWidth}%`, background: barColor }}
                  />
                </div>
                <div className="budget-progress-percent subtle-text">
                  {item.progressPercent.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

// ===== 预算管理 =====

function BudgetListSection(props: {
  budgets: Budget[];
  total: number;
  loading: boolean;
  page: number;
  filterType: string;
  filterPeriod: string;
  filterActive: string;
  keyword: string;
  categories: BudgetCategory[];
  onPageChange: (page: number) => void;
  onFilterTypeChange: (value: string) => void;
  onFilterPeriodChange: (value: string) => void;
  onFilterActiveChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
  onManageCategories: () => void;
}) {
  const {
    budgets, total, loading, page,
    filterType, filterPeriod, filterActive, keyword, categories,
    onPageChange, onFilterTypeChange, onFilterPeriodChange, onFilterActiveChange, onKeywordChange,
    onEdit, onDelete, onManageCategories,
  } = props;

  const totalPages = Math.max(1, Math.ceil(total / BUDGET_PAGE_SIZE));

  const columns: TableColumn<Budget>[] = [
    {
      key: 'name', title: '预算名称', dataIndex: 'name',
      render: (_value, row) => <strong>{row.name}</strong>,
    },
    {
      key: 'category', title: '分类', dataIndex: 'categoryName',
    },
    {
      key: 'amount', title: '金额', dataIndex: 'amount', align: 'right',
      render: (_value, row) => `¥${row.amount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`,
    },
    {
      key: 'period', title: '周期', align: 'center',
      render: (_value, row) => (
        <Tag tone="default">
          {row.periodType === 'monthly' ? '月度' : row.periodType === 'yearly' ? '年度' : '自定义'}
        </Tag>
      ),
    },
    {
      key: 'threshold', title: '预警阈值', align: 'center',
      render: (_value, row) => `${row.warningThresholdPercent}%`,
    },
    {
      key: 'status', title: '状态', align: 'center',
      render: (_value, row) => (
        <Tag tone={row.isActive ? 'green' : 'default'}>
          {row.isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      key: 'actions', title: '操作', align: 'right',
      render: (_value, row) => (
        <div className="table-actions">
          <IconBtn icon={<EditIcon />} title="编辑" tone="secondary" onClick={() => onEdit(row)} />
          <IconBtn icon={<DeleteIcon />} title="删除" tone="danger" onClick={() => onDelete(row)} />
        </div>
      ),
    },
  ];

  return (
    <>
      <SectionCard
        title="预算列表"
        description="管理所有预算项，支持按类型、周期、状态筛选。"
        action={<Btn tone="ghost" onClick={onManageCategories}>管理分类</Btn>}
      >
        <div className="page-stack">
          <div className="filter-grid">
            <Field
              label="关键词"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="搜索预算名称..."
            />
            <SelectField label="类型" value={filterType} onChange={(e) => onFilterTypeChange(e.target.value)}>
              <option value="all">全部类型</option>
              <option value="expense">支出</option>
              <option value="income">收入</option>
            </SelectField>
            <SelectField label="周期" value={filterPeriod} onChange={(e) => onFilterPeriodChange(e.target.value)}>
              <option value="all">全部周期</option>
              <option value="monthly">月度</option>
              <option value="yearly">年度</option>
              <option value="custom">自定义</option>
            </SelectField>
            <SelectField label="状态" value={filterActive} onChange={(e) => onFilterActiveChange(e.target.value)}>
              <option value="all">全部状态</option>
              <option value="active">启用中</option>
              <option value="inactive">已停用</option>
            </SelectField>
          </div>

          <div style={{ opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
            <DataTable
              columns={columns}
              data={budgets}
              rowKey="id"
              emptyText="暂无预算数据"
            />
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      </SectionCard>

      {categories.length > 0 && budgets.length > 0 && (
        <span className="subtle-text">共 {categories.length} 个预算分类</span>
      )}
    </>
  );
}

// ===== 对比分析 =====

function BudgetComparisonSection({ comparison, loading }: { comparison: BudgetYearlyComparison; loading: boolean }) {
  const summaryCards = [
    { label: '年度预算', value: `¥${comparison.totalBudgeted.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
    { label: '实际支出', value: `¥${comparison.totalActual.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}` },
    {
      label: '年度差额',
      value: `${comparison.totalDifference >= 0 ? '+' : ''}¥${comparison.totalDifference.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`,
      accent: comparison.totalDifference >= 0 ? 'var(--color-success-strong)' : 'var(--color-danger-strong)',
    },
    {
      label: '执行率',
      value: `${comparison.totalBudgeted > 0 ? ((comparison.totalActual / comparison.totalBudgeted) * 100).toFixed(1) : 0}%`,
    },
  ];

  const maxVal = Math.max(...comparison.monthly.map((x) => Math.max(x.budgeted, x.actual)), 1);

  return (
    <>
      <StatGrid items={summaryCards} />

      <SectionCard
        title="月度预算 vs 实际支出"
        description={`${comparison.year} 年逐月对比，蓝色为预算，绿色/红色为实际支出。`}
      >
        {loading ? (
          <div className="empty-state">正在加载对比数据...</div>
        ) : (
          <div className="page-stack">
            <div className="budget-chart-row">
              {comparison.monthly.map((m) => {
                const budgetHeight = (m.budgeted / maxVal) * 100;
                const actualHeight = (m.actual / maxVal) * 100;
                const monthLabel = m.month.split('-')[1];
                return (
                  <div key={m.month} className="budget-chart-col">
                    <div className="budget-chart-bars">
                      <div
                        className="budget-chart-bar budget-chart-bar-budget"
                        style={{ height: `${budgetHeight}%` }}
                        title={`预算: ¥${m.budgeted.toFixed(2)}`}
                      />
                      <div
                        className="budget-chart-bar budget-chart-bar-actual"
                        style={{
                          height: `${actualHeight}%`,
                          background: m.actual > m.budgeted ? 'var(--color-danger)' : 'var(--color-success)',
                        }}
                        title={`实际: ¥${m.actual.toFixed(2)}`}
                      />
                    </div>
                    <span className="budget-chart-label">{monthLabel}月</span>
                  </div>
                );
              })}
            </div>
            <div className="budget-chart-legend">
              <span className="budget-chart-legend-item">
                <span className="budget-chart-legend-dot" style={{ background: 'var(--color-primary-soft)' }} />
                预算
              </span>
              <span className="budget-chart-legend-item">
                <span className="budget-chart-legend-dot" style={{ background: 'var(--color-success)' }} />
                实际支出
              </span>
            </div>
          </div>
        )}
      </SectionCard>
    </>
  );
}

// ===== 调整历史 =====

function BudgetHistorySection(props: {
  history: BudgetHistory[];
  total: number;
  loading: boolean;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { history, total, loading, page, onPageChange } = props;
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  const columns: TableColumn<BudgetHistory>[] = [
    {
      key: 'date', title: '生效日期', dataIndex: 'effectiveDate',
    },
    {
      key: 'name', title: '预算名称', dataIndex: 'budgetName',
      render: (_value, row) => <strong>{row.budgetName}</strong>,
    },
    {
      key: 'category', title: '分类', dataIndex: 'categoryName',
    },
    {
      key: 'prev', title: '调整前', align: 'right',
      render: (_value, row) => `¥${row.previousAmount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`,
    },
    {
      key: 'next', title: '调整后', align: 'right',
      render: (_value, row) => `¥${row.newAmount.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`,
    },
    {
      key: 'diff', title: '变化', align: 'right',
      render: (_value, row) => {
        const diff = row.newAmount - row.previousAmount;
        return (
          <Tag tone={diff >= 0 ? 'red' : 'green'}>
            {diff >= 0 ? '+' : ''}¥{diff.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}
          </Tag>
        );
      },
    },
    {
      key: 'reason', title: '原因', dataIndex: 'changeReason',
      render: (value) => String(value ?? '-'),
    },
  ];

  return (
    <SectionCard
      title="预算调整历史"
      description="每次预算金额变更都会记录在此，便于追溯。"
    >
      <div style={{ opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }}>
        <DataTable
          columns={columns}
          data={history}
          rowKey="id"
          emptyText="暂无调整记录"
        />
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </SectionCard>
  );
}

// ===== 预算编辑弹窗 =====

interface BudgetFormData {
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  periodType: BudgetPeriodType;
  type: BudgetType;
  startDate: string;
  endDate: string;
  warningThresholdPercent: number;
  isActive: boolean;
  alertEnabled: boolean;
  changeReason?: string;
}

function BudgetEditModal(props: {
  budget: Budget | null;
  categories: BudgetCategory[];
  onClose: () => void;
  onSave: (data: BudgetFormData) => Promise<void>;
}) {
  const { budget, categories, onClose, onSave } = props;
  const isEdit = !!budget;

  const [name, setName] = useState(budget?.name ?? '');
  const [description, setDescription] = useState(budget?.description ?? '');
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? (categories[0]?.id ?? ''));
  const [amount, setAmount] = useState(budget?.amount?.toString() ?? '');
  const [periodType, setPeriodType] = useState<BudgetPeriodType>(budget?.periodType ?? 'monthly');
  const [type, setType] = useState<BudgetType>(budget?.type ?? 'expense');
  const [warningThresholdPercent, setWarningThresholdPercent] = useState(budget?.warningThresholdPercent?.toString() ?? '80');
  const [isActive, setIsActive] = useState(budget?.isActive ?? true);
  const [alertEnabled, setAlertEnabled] = useState(budget?.alertEnabled ?? true);
  const [changeReason, setChangeReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !categoryId) return;
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) return;
    const threshold = Number(warningThresholdPercent);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 200) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        categoryId,
        categoryName: categories.find((c) => c.id === categoryId)?.name ?? '',
        amount: numAmount,
        periodType,
        type,
        startDate: '',
        endDate: '',
        warningThresholdPercent: threshold,
        isActive,
        alertEnabled,
        changeReason: isEdit ? changeReason : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? '编辑预算' : '新增预算'}
      width={560}
      footer={
        <>
          <Btn tone="secondary" onClick={onClose}>取消</Btn>
          <Btn tone="primary" onClick={handleSubmit} disabled={saving || !name.trim() || !categoryId}>
            {isEdit ? '保存修改' : '创建预算'}
          </Btn>
        </>
      }
    >
      <div className="page-stack">
        <Field
          label="预算名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：餐饮月度预算"
        />

        <div className="form-grid-2">
          <SelectField label="预算类型" value={type} onChange={(e) => setType(e.target.value as BudgetType)}>
            <option value="expense">支出预算</option>
            <option value="income">收入预算</option>
          </SelectField>
          <SelectField label="周期类型" value={periodType} onChange={(e) => setPeriodType(e.target.value as BudgetPeriodType)}>
            <option value="monthly">月度</option>
            <option value="yearly">年度</option>
            <option value="custom">自定义</option>
          </SelectField>
        </div>

        <div className="form-grid-2">
          <SelectField label="分类" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.length === 0 && <option value="">请先创建分类</option>}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
          <Field
            label="预算金额"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="form-grid-2">
          <Field
            label="预警阈值 (%)"
            type="number"
            min={0}
            max={200}
            value={warningThresholdPercent}
            onChange={(e) => setWarningThresholdPercent(e.target.value)}
          />
          <div className="field">
            <span className="field-label">开关</span>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <Switch checked={isActive} onChange={setIsActive} label="启用" />
              <Switch checked={alertEnabled} onChange={setAlertEnabled} label="预警通知" />
            </div>
          </div>
        </div>

        {isEdit && (
          <Field
            label="调整原因"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="选填，记录本次调整原因"
          />
        )}

        <TextArea
          label="备注"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="选填"
        />
      </div>
    </Modal>
  );
}

// ===== 分类管理弹窗 =====

function CategoryManageModal(props: {
  categories: BudgetCategory[];
  loading: boolean;
  onClose: () => void;
  onChanged: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}) {
  const { categories, onClose, onChanged, showToast } = props;
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await budgetApi.createCategory({ name: name.trim(), type });
      setName('');
      showToast('分类已创建', 'success');
      onChanged();
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await budgetApi.deleteCategory(id);
      showToast('分类已删除', 'success');
      onChanged();
    } catch (error) {
      showToast(buildApiErrorMessage(error), 'error');
    }
  }

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');

  return (
    <Modal
      open
      onClose={onClose}
      title="管理预算分类"
      width={480}
      footer={<Btn tone="secondary" onClick={onClose}>关闭</Btn>}
    >
      <div className="page-stack">
        <div className="category-add-row">
          <Field
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="新分类名称"
          />
          <SelectField
            value={type}
            onChange={(e) => setType(e.target.value as 'income' | 'expense')}
          >
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </SelectField>
          <Btn tone="primary" onClick={handleAdd} disabled={adding || !name.trim()}>添加</Btn>
        </div>

        {expenseCats.length > 0 && (
          <div className="page-stack">
            <span className="field-label">支出分类</span>
            {expenseCats.map((cat) => (
              <div key={cat.id} className="category-item-row">
                <span>{cat.name}</span>
                <IconBtn icon={<DeleteIcon />} title="删除" tone="danger" onClick={() => handleDelete(cat.id)} />
              </div>
            ))}
          </div>
        )}

        {incomeCats.length > 0 && (
          <div className="page-stack">
            <span className="field-label">收入分类</span>
            {incomeCats.map((cat) => (
              <div key={cat.id} className="category-item-row">
                <span>{cat.name}</span>
                <IconBtn icon={<DeleteIcon />} title="删除" tone="danger" onClick={() => handleDelete(cat.id)} />
              </div>
            ))}
          </div>
        )}

        {categories.length === 0 && (
          <EmptyState title="暂无分类" description="请先添加预算分类。" />
        )}
      </div>
    </Modal>
  );
}
