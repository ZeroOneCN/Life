import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, PageHeader, SectionCard } from '../components/page';
import { Tag } from '../components/ui';
import { buildApiErrorMessage, apiGet } from '../lib/api';
import type {
  DashboardAgendaItem,
  DashboardModuleSnapshot,
  DashboardPageSummary,
} from '../types/dashboard';

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
  return `¥${value.toFixed(0)}`;
}

function formatSignedMoney(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

const SEVERITY_DOT: Record<string, string> = {
  high: '\u{1F534}',
  medium: '\u{1F7E0}',
  low: '\u{1F7E1}',
};

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardPageSummary | null>(null);
  const [loadingError, setLoadingError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const raw = await apiGet<RawDashboardSummaryResponse>('/dashboard/summary');
        if (cancelled) return;

        const buildModule = (
          title: string,
          metrics: Array<{ label: string; value: string; helper?: string }>,
          chartKind: 'bar' | 'line',
        ): DashboardModuleSnapshot => ({
          title,
          subtitle: '',
          metrics,
          chartTitle: '',
          chartDescription: '',
          chartKind,
          chartData: [],
          listTitle: '',
          listDescription: '',
          listItems: [],
        });

        const health = buildModule('健康中心', [
          { label: '今日步数', value: `${raw.health.stats.todayStepCount}`, helper: '' },
          { label: '体重', value: raw.health.stats.latestWeight ? `${raw.health.stats.latestWeight}kg` : '-', helper: '' },
        ], 'line');

        const finance = buildModule('财务中心', [
          { label: '待还金额', value: formatMoney(raw.finance.stats.totalUnpaidLoanAmount), helper: '' },
          { label: '订阅服务', value: `${raw.finance.stats.activeSubscriptionCount}项`, helper: '' },
        ], 'bar');

        const life = buildModule('生活中心', [
          { label: '待办事项', value: `${raw.life.stats.pendingTodoCount}`, helper: '' },
          { label: '物品追踪', value: `${raw.life.stats.activeStorageCount}件`, helper: '' },
        ], 'line');

        const investment = buildModule('投资中心', [
          { label: '净收益', value: formatSignedMoney(raw.investment.stats.netPnl), helper: '' },
          { label: '胜率', value: formatPercent(raw.investment.stats.winRate), helper: '' },
        ], 'line');

        setSummary({
          overviewCards: raw.overviewCards.map((item) => ({
            id: item.key,
            label: item.label,
            value: String(item.value),
            helper: '',
          })),
          agenda: raw.agenda,
          health,
          finance,
          life,
          investment,
          notifications: {
            enabledChannels: raw.notifications.enabledChannelCount,
            enabledScenes: raw.notifications.enabledSceneCount,
            logCount: raw.notifications.recentLogs.length,
            mostActiveSceneLabel: raw.notifications.hottestSceneId || '-',
            recentLogs: raw.notifications.recentLogs.map((log) => ({
              id: log.id,
              createdAt: log.created_at,
              channel: log.channel,
              sceneId: log.scene_id as DashboardPageSummary['notifications']['recentLogs'][number]['sceneId'],
              kind: log.kind,
              status: log.status,
              title: log.title,
              message: log.message,
            })),
          },
          connectedModuleCount: Number(raw.overviewCards.find((item) => item.key === 'modules')?.value ?? 0),
        });
        setLoadingError('');
      } catch (error) {
        if (cancelled) return;
        setLoadingError(buildApiErrorMessage(error, '首页数据加载失败'));
      }
    };

    void load();
    const intervalId = window.setInterval(() => void load(), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const topStats = useMemo(() => {
    if (!summary) return [];
    const h = summary.health.metrics;
    const f = summary.finance.metrics;
    const l = summary.life.metrics;
    const inv = summary.investment.metrics;
    return [
      { icon: '\uD83D\uDC63', label: '步数', value: h[0]?.value ?? '0', sub: h[1]?.value, href: '/health/step' },
      { icon: '\uD83D\uDCC8', label: '收益', value: inv[0]?.value ?? '¥0', sub: inv[1]?.value, href: '/investment/forex?forexTab=trades' },
      { icon: '\uD83D\uDCCB', label: '待办', value: l[0]?.value ?? '0', sub: `${summary.agenda.filter((a) => a.severity === 'high').length}项紧急`, href: '/life/todo?todoTab=tasks' },
      { icon: '\uD83D\uDCB3', label: '待还', value: f[0]?.value ?? '¥0', sub: f[1]?.value, href: '/finance/loan' },
      { icon: '\uD83D\uDD14', label: '通知', value: `${summary.notifications.logCount}`, sub: `${summary.notifications.enabledChannels}渠道`, href: '/notifications?tab=logs' },
    ];
  }, [summary]);

  const agendaInline = useMemo(() => {
    if (!summary) return [];
    return summary.agenda.slice(0, 5).map((item) => ({
      id: item.id,
      dot: SEVERITY_DOT[item.severity],
      title: item.title,
      href: item.href,
    }));
  }, [summary]);

  const moduleCards = useMemo(() => {
    if (!summary) return [];
    return [
      { icon: '\u2764\uFE0F', title: '健康中心', metrics: summary.health.metrics, href: '/health/step' },
      { icon: '\uD83D\uDCB0', title: '财务中心', metrics: summary.finance.metrics, href: '/finance/shopping?shoppingTab=overview' },
      { icon: '\uD83C\uDFE0', title: '生活中心', metrics: summary.life.metrics, href: '/life/todo?todoTab=tasks' },
      { icon: '\uD83D\uDCC8', title: '投资中心', metrics: summary.investment.metrics, href: '/investment/forex?forexTab=trades' },
    ];
  }, [summary]);

  const timelineItems = useMemo(() => {
    if (!summary) return [];
    const items: Array<{ time: string; module: string; title: string }> = [];
    summary.notifications.recentLogs.slice(0, 3).forEach((log) => {
      const date = new Date(log.createdAt);
      items.push({
        time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
        module: '通知',
        title: log.title,
      });
    });
    summary.agenda.slice(0, 2).forEach((item) => {
      items.push({ time: item.targetDate || '-', module: item.module, title: item.title });
    });
    return items.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5);
  }, [summary]);

  if (!summary) {
    return (
      <div className="page-stack dashboard-page">
        <PageHeader title="LifeOS 控制台" subtitle={loadingError || '正在加载数据...'} />
        <EmptyState title="加载中" description={loadingError || '正在获取最新数据'} />
      </div>
    );
  }

  const hasAgenda = summary.agenda.length > 0;

  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        title="LifeOS 控制台"
        subtitle="一目了然，快速行动"
        actions={(
          <div className="dashboard-status-row">
            <Tag tone={hasAgenda ? 'orange' : 'green'}>
              {hasAgenda ? `${summary.agenda.length} 项待处理` : '全部正常'}
            </Tag>
            <Tag tone="default">{summary.connectedModuleCount} 个模块已接入</Tag>
          </div>
        )}
      />

      <section className="dash-stats-strip">
        {topStats.map((stat) => (
          <Link key={stat.label} className="dash-stat-chip" to={stat.href}>
            <span className="dash-stat-icon">{stat.icon}</span>
            <div className="dash-stat-body">
              <strong className="dash-stat-val">{stat.value}</strong>
              <span className="dash-stat-sub">{stat.sub}</span>
            </div>
          </Link>
        ))}
      </section>

      {hasAgenda ? (
        <div className="dash-agenda-strip">
          <span className="dash-agenda-label">\u26A0\uFE0F 待处理</span>
          <div className="dash-agenda-items">
            {agendaInline.map((item) => (
              <Link key={item.id} className="dash-agenda-chip" to={item.href}>
                <span className="dash-agenda-dot">{item.dot}</span>
                <span className="dash-agenda-text">{item.title}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <section className="dash-modules-row">
        {moduleCards.map((mod) => (
          <Link key={mod.title} className="dash-module-card" to={mod.href}>
            <span className="dash-module-icon">{mod.icon}</span>
            <div className="dash-module-body">
              <strong className="dash-module-title">{mod.title}</strong>
              <div className="dash-module-metrics">
                {mod.metrics.map((m) => (
                  <span key={m.label} className="dash-module-metric">
                    <span className="dash-metric-label">{m.label}</span>
                    <span className="dash-metric-value">{m.value}</span>
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </section>

      <SectionCard title="最近动态">
        <div className="dash-timeline">
          {timelineItems.length > 0 ? (
            timelineItems.map((item, i) => (
              <div key={i} className="dash-timeline-row">
                <span className="dash-tl-time">{item.time}</span>
                <span className="dash-tl-module">{item.module}</span>
                <span className="dash-tl-title">{item.title}</span>
              </div>
            ))
          ) : (
            <EmptyState title="暂无动态" description="当有新活动时会在这里显示" />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
