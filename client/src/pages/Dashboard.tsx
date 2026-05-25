import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState, PageHeader, SectionCard, StatGrid } from '../components/page';
import { Tag } from '../components/ui';
import { buildApiErrorMessage, apiGet } from '../lib/api';
import type {
  DashboardAgendaItem,
  DashboardModuleSnapshot,
  DashboardPageSummary,
} from '../types/dashboard';

const TOOLTIP_STYLE = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

interface RawDashboardSummaryResponse {
  overviewCards: Array<{ key: string; label: string; value: string | number }>;
  agenda: Array<{
    id: string;
    module: string;
    title: string;
    summary: string;
    severity: 'high' | 'medium' | 'low';
    targetDate: string;
    href: string;
  }>;
  health: {
    title: string;
    stats: {
      todayStepCount: number;
      latestWeight: number | null;
      todayCalorieNet: number;
      checkupPendingCount: number;
      medicationLowStockCount: number;
    };
    trend: Array<{ date: string; label: string; steps: number }>;
  };
  finance: {
    title: string;
    stats: {
      upcomingSubscriptionCount: number;
      overdueLoanCount: number;
      activeSubscriptionCount: number;
      totalUnpaidLoanAmount: number;
    };
    trend: Array<{ month: string; label: string; subscriptionCount: number; loanAmount: number }>;
  };
  life: {
    title: string;
    stats: {
      pendingTodoCount: number;
      dueTodayTodoCount: number;
      activeStorageCount: number;
      lowBalanceCardCount: number;
    };
    trend: Array<{ key: string; label: string; value: number }>;
  };
  investment: {
    title: string;
    stats: {
      netPnl: number;
      winRate: number;
      netCapital: number;
      activeTradeCount: number;
    };
    trend: Array<{ date: string; label: string; netPnl: number; tradeCount?: number }>;
  };
  notifications: {
    enabledChannelCount: number;
    enabledSceneCount: number;
    recentLogs: Array<{
      id: string;
      created_at: string;
      channel: 'email' | 'wechatWork' | 'webhook';
      scene_id: string | null;
      kind: 'test' | 'scene';
      status: 'success' | 'skipped' | 'error';
      title: string;
      message: string;
    }>;
    hottestSceneId: string;
  };
}

function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

function formatSignedMoney(value: number) {
  return `${value >= 0 ? '+' : '-'}¥${Math.abs(value).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function agendaSeverityTagTone(severity: DashboardAgendaItem['severity']) {
  if (severity === 'high') {
    return 'red' as const;
  }
  if (severity === 'medium') {
    return 'orange' as const;
  }
  return 'blue' as const;
}

function agendaSeverityTagLabel(severity: DashboardAgendaItem['severity']) {
  if (severity === 'high') {
    return '高风险';
  }
  if (severity === 'medium') {
    return '需跟进';
  }
  return '可关注';
}

function buildSnapshotFromRaw(summary: RawDashboardSummaryResponse): DashboardPageSummary {
  const health: DashboardModuleSnapshot = {
    title: '健康中心摘要',
    subtitle: '围绕步数、净热量、复查和低库存药品提炼出首页关注信号。',
    metrics: [
      { label: '今日步数', value: `${summary.health.stats.todayStepCount} 步`, helper: '来自今日步数记录' },
      { label: '最近体重', value: summary.health.stats.latestWeight === null ? '-' : `${summary.health.stats.latestWeight} kg`, helper: '最新体重记录' },
      { label: '待复查', value: `${summary.health.stats.checkupPendingCount} 项`, helper: '近 7 天复查窗口' },
      { label: '低库存药品', value: `${summary.health.stats.medicationLowStockCount} 项`, helper: `今日净热量 ${Math.round(summary.health.stats.todayCalorieNet)} kcal` },
    ],
    chartTitle: '最近步数趋势',
    chartDescription: '保留最轻量、最易读的今日健康主线图表。',
    chartKind: 'line',
    chartData: summary.health.trend.map((item) => ({
      id: item.date,
      label: item.label,
      value: item.steps,
    })),
    listTitle: '重点关注',
    listDescription: '快速看到今天最需要留意的健康事项。',
    listItems: [
      { id: 'health-checkup', title: '待复查事项', meta: '近 7 天需处理的复查计划', value: `${summary.health.stats.checkupPendingCount} 项` },
      { id: 'health-medication', title: '药品库存风险', meta: '低于库存阈值的药品数量', value: `${summary.health.stats.medicationLowStockCount} 项` },
      { id: 'health-calorie', title: '今日净热量', meta: '饮食摄入减去运动消耗', value: `${Math.round(summary.health.stats.todayCalorieNet)} kcal` },
    ],
  };

  const finance: DashboardModuleSnapshot = {
    title: '财务中心摘要',
    subtitle: '把贷款与订阅的关键压力信号集中在首页展示。',
    metrics: [
      { label: '待还金额', value: formatMoney(summary.finance.stats.totalUnpaidLoanAmount), helper: '当前所有未结清账单' },
      { label: '逾期贷款', value: `${summary.finance.stats.overdueLoanCount} 笔`, helper: '需要优先处理' },
      { label: '活跃订阅', value: `${summary.finance.stats.activeSubscriptionCount} 项`, helper: '当前订阅池总量' },
      { label: '即将到期订阅', value: `${summary.finance.stats.upcomingSubscriptionCount} 项`, helper: '近 7 天到期' },
    ],
    chartTitle: '贷款与订阅趋势',
    chartDescription: '保留最适合首页的跨月趋势摘要。',
    chartKind: 'bar',
    chartData: summary.finance.trend.map((item) => ({
      id: item.month,
      label: item.label,
      value: item.loanAmount,
      secondaryValue: item.subscriptionCount,
    })),
    listTitle: '财务提醒',
    listDescription: '用简洁摘要提醒当前最重要的支出和待还事项。',
    listItems: [
      { id: 'finance-loan', title: '贷款待还', meta: '当前未结清贷款金额', value: formatMoney(summary.finance.stats.totalUnpaidLoanAmount) },
      { id: 'finance-overdue', title: '逾期账单', meta: '存在逾期时建议优先处理', value: `${summary.finance.stats.overdueLoanCount} 笔` },
      { id: 'finance-subscription', title: '订阅到期', meta: '近 7 天需要关注的续费事项', value: `${summary.finance.stats.upcomingSubscriptionCount} 项` },
    ],
  };

  const life: DashboardModuleSnapshot = {
    title: '生活中心摘要',
    subtitle: '首页只保留待办、物品追踪和号卡中心的高信号摘要。',
    metrics: [
      { label: '未完成待办', value: `${summary.life.stats.pendingTodoCount} 项`, helper: `今日到期 ${summary.life.stats.dueTodayTodoCount} 项` },
      { label: '使用中物品', value: `${summary.life.stats.activeStorageCount} 件`, helper: '物品追踪中的活跃记录' },
      { label: '低余额号卡', value: `${summary.life.stats.lowBalanceCardCount} 张`, helper: '需要关注充值或账单' },
      { label: '生活活跃事项', value: `${summary.life.stats.pendingTodoCount + summary.life.stats.activeStorageCount + summary.life.stats.lowBalanceCardCount}`, helper: '待办 + 物品 + 号卡' },
    ],
    chartTitle: '生活事项分布',
    chartDescription: '看清生活中心当前的主要精力落点。',
    chartKind: 'bar',
    chartData: summary.life.trend.map((item) => ({
      id: item.key,
      label: item.label,
      value: item.value,
    })),
    listTitle: '生活关注',
    listDescription: '保留最直观的三个入口，便于首页快速下钻。',
    listItems: [
      { id: 'life-todo', title: '待办压力', meta: '未完成任务总量', value: `${summary.life.stats.pendingTodoCount} 项` },
      { id: 'life-storage', title: '物品追踪', meta: '正在摊销成本的活跃物品', value: `${summary.life.stats.activeStorageCount} 件` },
      { id: 'life-card', title: '号卡低余额', meta: '可能需要充值或检查账单', value: `${summary.life.stats.lowBalanceCardCount} 张` },
    ],
  };

  const investment: DashboardModuleSnapshot = {
    title: '投资中心摘要',
    subtitle: '当前真实聚合来源为外汇中心，其余投资页面只保留接入状态。',
    metrics: [
      { label: '净收益', value: formatSignedMoney(summary.investment.stats.netPnl), helper: '已实现净收益' },
      { label: '胜率', value: formatPercent(summary.investment.stats.winRate), helper: '当前交易胜率' },
      { label: '净入金', value: formatMoney(summary.investment.stats.netCapital), helper: '入金减出金' },
      { label: '活跃交易', value: `${summary.investment.stats.activeTradeCount} 笔`, helper: '统计区间内交易数' },
    ],
    chartTitle: '最近净收益走势',
    chartDescription: '首页只保留足够判断节奏的净收益走势。',
    chartKind: 'line',
    chartData: summary.investment.trend.map((item) => ({
      id: item.date,
      label: item.label,
      value: item.netPnl,
      secondaryValue: item.tradeCount,
    })),
    listTitle: '投资快照',
    listDescription: '保留资金和结果指标，不在首页复制完整交易台。',
    listItems: [
      { id: 'investment-pnl', title: '净收益', meta: '当前外汇中心真实统计', value: formatSignedMoney(summary.investment.stats.netPnl) },
      { id: 'investment-win-rate', title: '胜率', meta: '统计区间内盈利占比', value: formatPercent(summary.investment.stats.winRate) },
      { id: 'investment-trades', title: '活跃交易数', meta: '当前统计窗口的交易数量', value: `${summary.investment.stats.activeTradeCount} 笔` },
    ],
  };

  const notifications = {
    enabledChannels: summary.notifications.enabledChannelCount,
    enabledScenes: summary.notifications.enabledSceneCount,
    logCount: summary.notifications.recentLogs.length,
    mostActiveSceneLabel: summary.notifications.hottestSceneId || '暂无活跃场景',
    recentLogs: summary.notifications.recentLogs.map((log) => ({
      id: log.id,
      createdAt: log.created_at,
      channel: log.channel,
      sceneId: log.scene_id as DashboardPageSummary['notifications']['recentLogs'][number]['sceneId'],
      kind: log.kind,
      status: log.status,
      title: log.title,
      message: log.message,
    })),
  };

  return {
    overviewCards: summary.overviewCards.map((item) => ({
      id: item.key,
      label: item.label,
      value: String(item.value),
      helper: '',
    })),
    agenda: summary.agenda,
    health,
    finance,
    life,
    investment,
    notifications,
    connectedModuleCount: Number(summary.overviewCards.find((item) => item.key === 'modules')?.value ?? 0),
  };
}

function SnapshotChart({
  kind,
  data,
}: {
  kind: 'bar' | 'line';
  data: Array<{ id: string; label: string; value: number; secondaryValue?: number }>;
}) {
  if (!data.length) {
    return <EmptyState title="暂无趋势" description="当前模块还没有足够数据形成首页图表。" />;
  }

  if (kind === 'line') {
    return (
      <div className="dashboard-chart-shell">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="value" name="主指标" stroke="var(--color-primary)" strokeWidth={2.4} dot={false} />
            <Line type="monotone" dataKey="secondaryValue" name="辅助指标" stroke="#10b981" strokeWidth={1.8} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="dashboard-chart-shell">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
          <YAxis tick={{ fill: 'var(--color-ink-subtle)', fontSize: 12 }} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" name="主指标" radius={[10, 10, 0, 0]} fill="var(--color-primary)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SnapshotSection({
  title,
  subtitle,
  metrics,
  chartTitle,
  chartDescription,
  chartKind,
  chartData,
  listTitle,
  listDescription,
  listItems,
}: DashboardModuleSnapshot) {
  return (
    <SectionCard title={title} description={subtitle}>
      <div className="dashboard-snapshot-stack">
        <StatGrid className="dashboard-snapshot-stat-grid" items={metrics.map((item) => ({
          label: item.label,
          value: item.value,
          helper: item.helper,
          accent: item.accent,
        }))} />

        <div className="dashboard-snapshot-content">
          <div className="dashboard-chart-card">
            <div className="dashboard-block-header">
              <strong>{chartTitle}</strong>
              <span>{chartDescription}</span>
            </div>
            <SnapshotChart kind={chartKind} data={chartData} />
          </div>

          <div className="dashboard-list-card">
            <div className="dashboard-block-header">
              <strong>{listTitle}</strong>
              <span>{listDescription}</span>
            </div>
            {listItems.length ? (
              <div className="dashboard-summary-list">
                {listItems.map((item) => (
                  <article className="dashboard-summary-item" key={item.id}>
                    <div className="dashboard-summary-copy">
                      <strong>{item.title}</strong>
                      <span>{item.meta}</span>
                    </div>
                    {item.value ? (
                      <div className="dashboard-summary-value" style={item.accent ? { color: item.accent } : undefined}>
                        {item.value}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无记录" description="当前模块还没有形成首页摘要列表。" />
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardPageSummary | null>(null);
  const [loadingError, setLoadingError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const raw = await apiGet<RawDashboardSummaryResponse>('/dashboard/summary');
        if (cancelled) {
          return;
        }
        setSummary(buildSnapshotFromRaw(raw));
        setLoadingError('');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadingError(buildApiErrorMessage(error, '首页数据加载失败。'));
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const statusTags = useMemo(() => (
    [
      { label: '数据库在线', tone: 'green' as const },
      { label: '业务数据以后端为准', tone: 'blue' as const },
      { label: `${summary?.connectedModuleCount ?? 0} 个模块已接入`, tone: 'default' as const },
    ]
  ), [summary?.connectedModuleCount]);

  if (!summary) {
    return (
      <div className="page-stack dashboard-page">
        <PageHeader
          title="全局控制台"
          subtitle={loadingError || '正在从后端汇总跨模块数据，请稍候。'}
          actions={(
            <div className="dashboard-header-tags">
              {statusTags.map((item) => (
                <Tag key={item.label} tone={item.tone}>{item.label}</Tag>
              ))}
            </div>
          )}
        />
        <EmptyState title="首页加载中" description={loadingError || '后端正在返回最新控制台摘要。'} />
      </div>
    );
  }

  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        title="全局控制台"
        subtitle="把健康、财务、生活、投资和通知中心的高信号信息收敛到一张正式首页里，优先帮你看清现在最该处理什么。"
        actions={(
          <div className="dashboard-header-tags">
            {statusTags.map((item) => (
              <Tag key={item.label} tone={item.tone}>{item.label}</Tag>
            ))}
          </div>
        )}
      />

      <StatGrid className="dashboard-overview-grid" items={summary.overviewCards} />

      <SectionCard
        title="统一待处理 / 近期提醒"
        description="这里不是单纯的通知日志，而是把各业务页真正需要你处理的事项统一列出来，并按风险级别和日期排序。"
      >
        {summary.agenda.length ? (
          <div className="dashboard-agenda-list">
            {summary.agenda.map((item) => (
              <Link className="dashboard-agenda-item" key={item.id} to={item.href}>
                <div className="dashboard-agenda-main">
                  <div className="dashboard-agenda-top">
                    <span className="dashboard-agenda-module">{item.module}</span>
                    <Tag tone={agendaSeverityTagTone(item.severity)}>{agendaSeverityTagLabel(item.severity)}</Tag>
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                </div>
                <div className="dashboard-agenda-side">
                  <span>目标日期</span>
                  <strong>{item.targetDate || '暂无日期'}</strong>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="当前没有临近待处理事项" description="所有已接入模块当前都没有进入提醒窗口的事项。" />
        )}
      </SectionCard>

      <div className="dashboard-bottom-grid">
        <SnapshotSection {...summary.health} />
        <SnapshotSection {...summary.finance} />
        <SnapshotSection {...summary.life} />
        <SnapshotSection {...summary.investment} />

        <SectionCard
          title="通知中心动态"
          description="通知中心继续作为统一出口，首页这里只保留启用状态、最近日志和活跃场景。"
        >
          <div className="dashboard-notification-stack">
            <StatGrid
              className="dashboard-notification-grid"
              items={[
                { label: '启用渠道数', value: `${summary.notifications.enabledChannels}`, helper: '统一管理通知渠道配置' },
                { label: '启用场景数', value: `${summary.notifications.enabledScenes}`, helper: '与通知中心页面保持一致' },
                { label: '最近日志数', value: `${summary.notifications.logCount}`, helper: '最近 8 条通知记录摘要' },
                { label: '最活跃场景', value: summary.notifications.mostActiveSceneLabel, helper: '最近最常出现的业务场景' },
              ]}
            />

            {summary.notifications.recentLogs.length ? (
              <div className="dashboard-notification-list">
                {summary.notifications.recentLogs.map((log) => (
                  <article className="dashboard-notification-item" key={log.id}>
                    <div className="dashboard-notification-copy">
                      <strong>{log.title}</strong>
                      <span>{log.message}</span>
                    </div>
                    <div className="dashboard-notification-meta">
                      <Tag tone={log.status === 'success' ? 'green' : log.status === 'error' ? 'red' : 'orange'}>
                        {log.status === 'success' ? '成功' : log.status === 'error' ? '失败' : '跳过'}
                      </Tag>
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无通知动态" description="当业务页面触发提醒或手动测试通知后，这里会同步显示最近日志。" />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
