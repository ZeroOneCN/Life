import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';

import { EmptyState, PageHeader, SectionCard, StatGrid } from '../../components/page';
import {
  Btn,
  DeleteIcon,
  EditIcon,
  EyeIcon,
  Field,
  IconBtn,
  Modal,
  PillTabs,
  SelectField,
  Switch,
  Tag,
  TextArea,
  Toast,
  useToastState,
} from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { goalApi } from '../../services/goalApi';
import { usePageTab } from '../../hooks/usePageTab';
import type {
  FinanceGoal,
  GoalSummary,
  GoalDraft,
  GoalContribution,
  GoalStatus,
  GoalType,
  ContributionType,
} from '../../types/goal';
import {
  GOAL_TYPE_LABELS,
  GOAL_STATUS_LABELS,
  CONTRIBUTION_TYPE_LABELS,
} from '../../types/goal';

type TabKey = 'all' | 'active' | 'completed';

const TAB_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
];

const TargetIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const PlusIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ArrowRightIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const ArrowLeftIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

/**
 * 财务目标/储蓄计划页面。
 *
 * 提供储蓄目标管理、进度追踪、自动储蓄计算等功能，
 * 支持多目标并行管理和贡献记录追踪。
 */
export default function GoalPage({ embedded = false }: { embedded?: boolean }) {
  const { toast, showToast } = useToastState();
  const [activeTab, setActiveTab] = usePageTab<TabKey>('all', ['all', 'active', 'completed'], 'goalTab');

  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [summary, setSummary] = useState<GoalSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinanceGoal | null>(null);
  const [goalForm, setGoalForm] = useState<Partial<GoalDraft>>({});
  const [goalSaving, setGoalSaving] = useState(false);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<FinanceGoal | null>(null);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [contributionsLoading, setContributionsLoading] = useState(false);

  const [contribModalOpen, setContribModalOpen] = useState(false);
  const [contribForm, setContribForm] = useState<{
    goalId: string;
    amount: number;
    type: ContributionType;
    contributionDate: string;
    description: string;
  }>({
    goalId: '',
    amount: 0,
    type: 'deposit',
    contributionDate: dayjs().format('YYYY-MM-DD'),
    description: '',
  });
  const [contribSaving, setContribSaving] = useState(false);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinanceGoal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await goalApi.getSummary();
      setSummary(data);
    } catch (err) {
      showToast(`加载概览失败：${buildApiErrorMessage(err)}`, 'error');
    } finally {
      setSummaryLoading(false);
    }
  }, [showToast]);

  const loadGoals = useCallback(async (status: TabKey) => {
    setGoalsLoading(true);
    try {
      const statusParam = status === 'all' ? 'all' : status as GoalStatus;
      const data = await goalApi.list({ status: statusParam, pageSize: 100 });
      setGoals(data.items);
    } catch (err) {
      showToast(`加载目标失败：${buildApiErrorMessage(err)}`, 'error');
    } finally {
      setGoalsLoading(false);
    }
  }, [showToast]);

  const loadContributions = useCallback(async (goalId: string) => {
    setContributionsLoading(true);
    try {
      const data = await goalApi.listContributions(goalId, { pageSize: 50 });
      setContributions(data.items);
    } catch (err) {
      showToast(`加载记录失败：${buildApiErrorMessage(err)}`, 'error');
    } finally {
      setContributionsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadGoals(activeTab);
  }, [activeTab, loadGoals]);

  const statItems = useMemo(() => {
    if (!summary) return [];
    return [
      { label: '目标总数', value: String(summary.totalGoals) },
      { label: '进行中', value: String(summary.activeGoals), accent: '#3b82f6' },
      { label: '已完成', value: String(summary.completedGoals), accent: '#10b981' },
      { label: '本月存入', value: `¥${summary.thisMonthSaved.toFixed(2)}`, accent: '#f59e0b' },
    ];
  }, [summary]);

  const handleCreateGoal = () => {
    setEditingGoal(null);
    setGoalForm({
      name: '',
      description: '',
      type: 'saving',
      targetAmount: 0,
      currentAmount: 0,
      targetDate: dayjs().add(1, 'year').format('YYYY-MM-DD'),
      color: '#3b82f6',
      warningThresholdPercent: 80,
      alertEnabled: true,
    });
    setGoalModalOpen(true);
  };

  const handleEditGoal = (goal: FinanceGoal) => {
    setEditingGoal(goal);
    setGoalForm({
      name: goal.name,
      description: goal.description,
      type: goal.type,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      targetDate: goal.targetDate,
      startDate: goal.startDate,
      color: goal.color,
      icon: goal.icon,
      warningThresholdPercent: goal.warningThresholdPercent,
      alertEnabled: goal.alertEnabled,
      status: goal.status,
      notes: goal.notes ?? '',
    });
    setGoalModalOpen(true);
  };

  const handleSaveGoal = async () => {
    if (!goalForm.name?.trim()) {
      showToast('请输入目标名称', 'error');
      return;
    }
    if (!goalForm.targetAmount || goalForm.targetAmount <= 0) {
      showToast('请输入目标金额', 'error');
      return;
    }
    if (!goalForm.targetDate) {
      showToast('请选择目标日期', 'error');
      return;
    }

    setGoalSaving(true);
    try {
      if (editingGoal) {
        const updated = await goalApi.update(editingGoal.id, goalForm);
        setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        showToast('目标已更新', 'success');
      } else {
        const created = await goalApi.create(goalForm as GoalDraft);
        setGoals((prev) => [created, ...prev]);
        showToast('目标已创建', 'success');
      }
      setGoalModalOpen(false);
      loadSummary();
    } catch (err) {
      showToast(`保存失败：${buildApiErrorMessage(err)}`, 'error');
    } finally {
      setGoalSaving(false);
    }
  };

  const handleViewDetail = (goal: FinanceGoal) => {
    setSelectedGoal(goal);
    setDetailModalOpen(true);
    loadContributions(goal.id);
  };

  const handleDeleteClick = (goal: FinanceGoal) => {
    setDeleteTarget(goal);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await goalApi.remove(deleteTarget.id);
      setGoals((prev) => prev.filter((g) => g.id !== deleteTarget.id));
      showToast('目标已删除', 'success');
      setConfirmDeleteOpen(false);
      setDeleteTarget(null);
      loadSummary();
    } catch (err) {
      showToast(`删除失败：${buildApiErrorMessage(err)}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenContrib = (goal: FinanceGoal) => {
    setContribForm({
      goalId: goal.id,
      amount: 0,
      type: 'deposit',
      contributionDate: dayjs().format('YYYY-MM-DD'),
      description: '',
    });
    setContribModalOpen(true);
  };

  const handleSaveContrib = async () => {
    if (!contribForm.amount || contribForm.amount <= 0) {
      showToast('请输入金额', 'error');
      return;
    }

    setContribSaving(true);
    try {
      const result = await goalApi.addContribution(contribForm);
      setGoals((prev) => prev.map((g) => (g.id === result.goal.id ? result.goal : g)));
      if (selectedGoal && selectedGoal.id === result.goal.id) {
        setSelectedGoal(result.goal);
      }
      showToast(contribForm.type === 'deposit' ? '存入成功' : '取出成功', 'success');
      setContribModalOpen(false);
      if (selectedGoal) {
        loadContributions(selectedGoal.id);
      }
      loadSummary();
    } catch (err) {
      showToast(`保存失败：${buildApiErrorMessage(err)}`, 'error');
    } finally {
      setContribSaving(false);
    }
  };

  return (
    <div className="page-stack">
      {embedded ? (
        <div className="merged-toolbar">
          <Btn tone="primary" onClick={handleCreateGoal}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <PlusIcon size={16} />
              新建目标
            </span>
          </Btn>
        </div>
      ) : (
        <PageHeader
          title="储蓄目标"
          subtitle="设定储蓄目标，跟踪达成进度与建议"
          actions={
            <Btn tone="primary" onClick={handleCreateGoal}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <PlusIcon size={16} />
                新建目标
              </span>
            </Btn>
          }
        />
      )}

      <StatGrid items={statItems} />

      <SectionCard
        title="我的目标"
        description={`共 ${goals.length} 个目标`}
        action={
          <PillTabs
            options={TAB_OPTIONS}
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabKey)}
          />
        }
      >
        {goalsLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-ink-mute)' }}>
            加载中...
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            title="暂无目标"
            description="创建你的第一个储蓄目标，开始存钱之旅吧！"
          />
        ) : (
          <div className="goal-grid">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="goal-card"
                style={{ borderLeftColor: goal.color }}
                onClick={() => handleViewDetail(goal)}
              >
                <div className="goal-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      className="goal-icon"
                      style={{ background: goal.color + '20', color: goal.color }}
                    >
                      <TargetIcon />
                    </span>
                    <div>
                      <h4 className="goal-name">{goal.name}</h4>
                      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                        <Tag tone="blue" size="sm">{GOAL_TYPE_LABELS[goal.type]}</Tag>
                        <Tag
                          tone={goal.status === 'completed' ? 'green' : goal.status === 'paused' ? 'orange' : 'blue'}
                          size="sm"
                        >
                          {GOAL_STATUS_LABELS[goal.status]}
                        </Tag>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <IconBtn
                      icon={<EditIcon />}
                      title="编辑"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditGoal(goal);
                      }}
                    />
                    <IconBtn
                      icon={<DeleteIcon />}
                      title="删除"
                      tone="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(goal);
                      }}
                    />
                  </div>
                </div>

                <div className="goal-amounts">
                  <div>
                    <span className="goal-amount-label">已存</span>
                    <span className="goal-amount-current">¥{goal.currentAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="goal-amount-label">目标</span>
                    <span className="goal-amount-target">¥{goal.targetAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="goal-progress-container">
                  <div className="goal-progress-bar">
                    <div
                      className="goal-progress-fill"
                      style={{
                        width: `${Math.min(100, goal.progressPercent)}%`,
                        background: goal.color,
                      }}
                    />
                  </div>
                  <div className="goal-progress-info">
                    <span>{goal.progressPercent.toFixed(1)}%</span>
                    <span>剩余 {goal.daysRemaining} 天</span>
                  </div>
                </div>

                <div className="goal-footer">
                  <div style={{ fontSize: 13, color: 'var(--color-ink-mute)' }}>
                    每月需存 <span style={{ fontWeight: 600, color: goal.color }}>
                      ¥{goal.monthlySavingsNeeded.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    {goal.isOnTrack ? (
                      <Tag tone="green" size="sm">进度正常</Tag>
                    ) : goal.isWarning ? (
                      <Tag tone="orange" size="sm">进度偏慢</Tag>
                    ) : (
                      <Tag tone="red" size="sm">严重落后</Tag>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 目标编辑弹窗 */}
      <Modal
        open={goalModalOpen}
        title={editingGoal ? '编辑目标' : '新建目标'}
        onClose={() => setGoalModalOpen(false)}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn tone="ghost" onClick={() => setGoalModalOpen(false)}>取消</Btn>
            <Btn tone="primary" disabled={goalSaving} onClick={handleSaveGoal}>
              {editingGoal ? '保存修改' : '创建目标'}
            </Btn>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field
            label="目标名称"
            type="text"
            value={goalForm.name ?? ''}
            onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
            placeholder="例如：旅行基金"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SelectField
              label="目标类型"
              value={goalForm.type ?? 'saving'}
              onChange={(e) => setGoalForm({ ...goalForm, type: e.target.value as GoalType })}
            >
              {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectField>
            <SelectField
              label="目标状态"
              value={goalForm.status ?? 'active'}
              onChange={(e) => setGoalForm({ ...goalForm, status: e.target.value as GoalStatus })}
            >
              {Object.entries(GOAL_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field
              label="目标金额 (¥)"
              type="number"
              value={goalForm.targetAmount ?? ''}
              onChange={(e) => setGoalForm({ ...goalForm, targetAmount: Number(e.target.value) })}
              min={0}
              step={0.01}
            />
            <Field
              label="已存金额 (¥)"
              type="number"
              value={goalForm.currentAmount ?? ''}
              onChange={(e) => setGoalForm({ ...goalForm, currentAmount: Number(e.target.value) })}
              min={0}
              step={0.01}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Field
              label="开始日期"
              type="date"
              value={goalForm.startDate ?? ''}
              onChange={(e) => setGoalForm({ ...goalForm, startDate: e.target.value })}
            />
            <Field
              label="目标日期"
              type="date"
              value={goalForm.targetDate ?? ''}
              onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
            />
          </div>

          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>主题颜色</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                style={{ width: 40, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer' }}
                value={goalForm.color ?? '#3b82f6'}
                onChange={(e) => setGoalForm({ ...goalForm, color: e.target.value })}
              />
              <span style={{ color: 'var(--color-ink-mute)', fontSize: 13 }}>
                {goalForm.color ?? '#3b82f6'}
              </span>
            </div>
          </div>

          <Field
            label="预警阈值 (%)"
            type="number"
            value={goalForm.warningThresholdPercent ?? 80}
            onChange={(e) => setGoalForm({ ...goalForm, warningThresholdPercent: Number(e.target.value) })}
            min={0}
            max={200}
          />

          <TextArea
            label="目标描述"
            value={goalForm.description ?? ''}
            onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
            placeholder="描述一下这个目标..."
            style={{ minHeight: 80, resize: 'vertical' }}
          />

          <Switch
            label="开启提醒通知"
            checked={goalForm.alertEnabled ?? true}
            onChange={(v) => setGoalForm({ ...goalForm, alertEnabled: v })}
          />
        </div>
      </Modal>

      {/* 目标详情弹窗 */}
      <Modal
        open={detailModalOpen}
        title="目标详情"
        onClose={() => setDetailModalOpen(false)}
        width={560}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn tone="ghost" onClick={() => setDetailModalOpen(false)}>关闭</Btn>
            {selectedGoal && selectedGoal.status !== 'completed' && (
              <Btn tone="primary" onClick={() => handleOpenContrib(selectedGoal)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <PlusIcon size={16} />
                  存入/取出
                </span>
              </Btn>
            )}
          </div>
        }
      >
        {selectedGoal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                className="goal-icon goal-icon-lg"
                style={{ background: selectedGoal.color + '20', color: selectedGoal.color }}
              >
                <TargetIcon />
              </span>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>{selectedGoal.name}</h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <Tag tone="blue" size="sm">{GOAL_TYPE_LABELS[selectedGoal.type]}</Tag>
                  <Tag
                    tone={selectedGoal.status === 'completed' ? 'green' : selectedGoal.status === 'paused' ? 'orange' : 'blue'}
                    size="sm"
                  >
                    {GOAL_STATUS_LABELS[selectedGoal.status]}
                  </Tag>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="detail-stat-card">
                <span className="detail-stat-label">已存</span>
                <span className="detail-stat-value">¥{selectedGoal.currentAmount.toFixed(2)}</span>
              </div>
              <div className="detail-stat-card">
                <span className="detail-stat-label">目标</span>
                <span className="detail-stat-value">¥{selectedGoal.targetAmount.toFixed(2)}</span>
              </div>
              <div className="detail-stat-card">
                <span className="detail-stat-label">剩余</span>
                <span className="detail-stat-value">¥{selectedGoal.remainingAmount.toFixed(2)}</span>
              </div>
            </div>

            <div>
              <div className="goal-progress-container">
                <div className="goal-progress-bar" style={{ height: 10 }}>
                  <div
                    className="goal-progress-fill"
                    style={{
                      width: `${Math.min(100, selectedGoal.progressPercent)}%`,
                      background: selectedGoal.color,
                    }}
                  />
                </div>
                <div className="goal-progress-info">
                  <span style={{ fontWeight: 600 }}>{selectedGoal.progressPercent.toFixed(1)}%</span>
                  <span>剩余 {selectedGoal.daysRemaining} 天</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-ink-mute)' }}>每月需存</span>
                <span style={{ fontWeight: 600, color: selectedGoal.color }}>
                  ¥{selectedGoal.monthlySavingsNeeded.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-ink-mute)' }}>进度状态</span>
                {selectedGoal.isOnTrack ? (
                  <Tag tone="green" size="sm">进度正常</Tag>
                ) : selectedGoal.isWarning ? (
                  <Tag tone="orange" size="sm">进度偏慢</Tag>
                ) : (
                  <Tag tone="red" size="sm">严重落后</Tag>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-ink-mute)' }}>开始日期</span>
                <span>{selectedGoal.startDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-ink-mute)' }}>目标日期</span>
                <span>{selectedGoal.targetDate}</span>
              </div>
            </div>

            {selectedGoal.description && (
              <div>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>目标描述</div>
                <div style={{ color: 'var(--color-ink-mute)', lineHeight: 1.6, fontSize: 14 }}>
                  {selectedGoal.description}
                </div>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontWeight: 500 }}>存入/取出记录</div>
                <span style={{ fontSize: 13, color: 'var(--color-ink-mute)' }}>
                  共 {contributions.length} 条
                </span>
              </div>
              {contributionsLoading ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-ink-mute)' }}>
                  加载中...
                </div>
              ) : contributions.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-ink-mute)', fontSize: 13 }}>
                  暂无记录
                </div>
              ) : (
                <div className="contrib-list">
                  {contributions.slice(0, 10).map((item) => (
                    <div key={item.id} className="contrib-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`contrib-icon contrib-${item.type}`}>
                          {item.type === 'deposit' ? <ArrowRightIcon /> : <ArrowLeftIcon />}
                        </span>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>
                            {CONTRIBUTION_TYPE_LABELS[item.type]}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-ink-mute)' }}>
                            {item.contributionDate}
                            {item.description && ` · ${item.description}`}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontWeight: 600,
                        color: item.type === 'deposit' ? '#10b981' : '#ef4444',
                      }}>
                        {item.type === 'deposit' ? '+' : '-'}¥{item.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 存入/取出弹窗 */}
      <Modal
        open={contribModalOpen}
        title={contribForm.type === 'deposit' ? '存入金额' : '取出金额'}
        onClose={() => setContribModalOpen(false)}
        width={420}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn tone="ghost" onClick={() => setContribModalOpen(false)}>取消</Btn>
            <Btn tone="primary" disabled={contribSaving} onClick={handleSaveContrib}>
              确认
            </Btn>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>操作类型</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn
                tone={contribForm.type === 'deposit' ? 'primary' : 'ghost'}
                style={{ flex: 1 }}
                onClick={() => setContribForm({ ...contribForm, type: 'deposit' })}
                type="button"
              >
                存入
              </Btn>
              <Btn
                tone={contribForm.type === 'withdrawal' ? 'danger' : 'ghost'}
                style={{ flex: 1 }}
                onClick={() => setContribForm({ ...contribForm, type: 'withdrawal' })}
                type="button"
              >
                取出
              </Btn>
            </div>
          </div>

          <Field
            label="金额 (¥)"
            type="number"
            value={contribForm.amount || ''}
            onChange={(e) => setContribForm({ ...contribForm, amount: Number(e.target.value) })}
            min={0}
            step={0.01}
            placeholder="请输入金额"
            autoFocus
          />

          <Field
            label="日期"
            type="date"
            value={contribForm.contributionDate}
            onChange={(e) => setContribForm({ ...contribForm, contributionDate: e.target.value })}
          />

          <Field
            label="备注"
            type="text"
            value={contribForm.description}
            onChange={(e) => setContribForm({ ...contribForm, description: e.target.value })}
            placeholder="可选，记录这笔钱的来源/用途"
          />
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        open={confirmDeleteOpen}
        title="确认删除"
        onClose={() => setConfirmDeleteOpen(false)}
        width={400}
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn tone="ghost" onClick={() => setConfirmDeleteOpen(false)}>取消</Btn>
            <Btn tone="danger" disabled={deleting} onClick={handleConfirmDelete}>
              确认删除
            </Btn>
          </div>
        }
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            确定要删除目标 <strong>「{deleteTarget?.name}」</strong> 吗？
          </p>
          <p style={{ margin: '10px 0 0', color: 'var(--color-ink-mute)', fontSize: 14 }}>
            删除后相关的存入/取出记录也会被清除，此操作不可撤销。
          </p>
        </div>
      </Modal>

      <Toast toast={toast} />
    </div>
  );
}
