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
    stats: { todayStepCount: number; latestWeight: number | null; todayCalorieNet: number; checkupPendingCount: number; medicationLowStockCount: number };
    trend: Array<{ date: string; label: string; steps: number }>;
  };
  finance: {
    title: string;
    stats: { upcomingSubscriptionCount: number; overdueLoanCount: number; activeSubscriptionCount: number; totalUnpaidLoanAmount: number };
    trend: Array<{ month: string; label: string; subscriptionCount: number; loanAmount: number }>;
  };
  life: {
    title: string;
    stats: { pendingTodoCount: number; dueTodayTodoCount: number; activeStorageCount: number; lowBalanceCardCount: number };
    trend: Array<{ key: string; label: string; value: number }>;
  };
  investment: {
    title: string;
    stats: { netPnl: number; winRate: number; netCapital: number; activeTradeCount: number };
    trend: Array<{ date: string; label: string; netPnl: number; tradeCount?: number }>;
  };
  notifications: {
    enabledChannelCount: number;
    enabledSceneCount: number;
    recentLogs: Array<{ id: string; created_at: string; channel: 'email' | 'wechatWork' | 'webhook'; scene_id: string | null; kind: 'test' | 'scene'; status: 'success' | 'skipped' | 'error'; title: string; message: string }>;
    hottestSceneId: string;
  };
}

function formatMoney(value: number) { return `¥${value.toFixed(0)}`; }
function formatSignedMoney(value: number) { return `${value >= 0 ? '+' : ''}${value.toFixed(0)}`; }
function formatPercent(value: number) { return `${(value * 100).toFixed(1)}%`; }

const IconSteps = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 01-2 2H4a2 2 0 01-2-2z"/>
    <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 002 2h2a2 2 0 002-2z"/>
  </svg>
);

const IconTrend = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const IconTodo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconWallet = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const IconBell = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

const IconHeart = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
  </svg>
);

const IconDollar = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
  </svg>
);

const IconHome = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconChart = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const IconWarning = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const DotHigh = () => <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />;
const DotMedium = () => <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />;
const DotLow = () => <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />;

const SEVERITY_DOT: Record<string, React.ReactNode> = { high: <DotHigh />, medium: <DotMedium />, low: <DotLow /> };

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardPageSummary | null>(null);
  const [loadingError, setLoadingError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const raw = await apiGet<RawDashboardSummaryResponse>('/dashboard/summary');
        if (cancelled) return;

        const buildModule = (title: string, metrics: Array<{ label: string; value: string; helper?: string }>, chartKind: 'bar' | 'line'): DashboardModuleSnapshot => ({
          title, subtitle: '', metrics, chartTitle: '', chartDescription: '', chartKind, chartData: [], listTitle: '', listDescription: '', listItems: [],
        });

        setSummary({
          overviewCards: raw.overviewCards.map((item) => ({ id: item.key, label: item.label, value: String(item.value), helper: '' })),
          agenda: raw.agenda,
          health: buildModule('健康中心', [
            { label: '今日步数', value: `${raw.health.stats.todayStepCount}`, helper: '' },
            { label: '体重', value: raw.health.stats.latestWeight ? `${raw.health.stats.latestWeight}kg` : '-', helper: '' },
          ], 'line'),
          finance: buildModule('财务中心', [
            { label: '待还金额', value: formatMoney(raw.finance.stats.totalUnpaidLoanAmount), helper: '' },
            { label: '订阅服务', value: `${raw.finance.stats.activeSubscriptionCount}项`, helper: '' },
          ], 'bar'),
          life: buildModule('生活中心', [
            { label: '待办事项', value: `${raw.life.stats.pendingTodoCount}`, helper: '' },
            { label: '物品追踪', value: `${raw.life.stats.activeStorageCount}件`, helper: '' },
          ], 'line'),
          investment: buildModule('投资中心', [
            { label: '净收益', value: formatSignedMoney(raw.investment.stats.netPnl), helper: '' },
            { label: '胜率', value: formatPercent(raw.investment.stats.winRate), helper: '' },
          ], 'line'),
          notifications: {
            enabledChannels: raw.notifications.enabledChannelCount,
            enabledScenes: raw.notifications.enabledSceneCount,
            logCount: raw.notifications.recentLogs.length,
            mostActiveSceneLabel: raw.notifications.hottestSceneId || '-',
            recentLogs: raw.notifications.recentLogs.map((log) => ({
              id: log.id, createdAt: log.created_at, channel: log.channel,
              sceneId: log.scene_id as DashboardPageSummary['notifications']['recentLogs'][number]['sceneId'],
              kind: log.kind, status: log.status, title: log.title, message: log.message,
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
    return () => { cancelled = true; window.clearInterval(intervalId); };
  }, []);

  const topStats = useMemo(() => {
    if (!summary) return [];
    const h = summary.health.metrics, f = summary.finance.metrics, l = summary.life.metrics, inv = summary.investment.metrics;
    return [
      { icon: <IconSteps />, label: '步数', value: h[0]?.value ?? '0', sub: h[1]?.value, href: '/health/step' },
      { icon: <IconTrend />, label: '收益', value: inv[0]?.value ?? '¥0', sub: inv[1]?.value, href: '/investment/forex?forexTab=trades' },
      { icon: <IconTodo />, label: '待办', value: l[0]?.value ?? '0', sub: `${summary.agenda.filter((a) => a.severity === 'high').length}项紧急`, href: '/life/todo?todoTab=tasks' },
      { icon: <IconWallet />, label: '待还', value: f[0]?.value ?? '¥0', sub: f[1]?.value, href: '/finance/loan' },
      { icon: <IconBell />, label: '通知', value: `${summary.notifications.logCount}`, sub: `${summary.notifications.enabledChannels}渠道`, href: '/notifications?tab=logs' },
    ];
  }, [summary]);

  const agendaInline = useMemo(() => {
    if (!summary) return [];
    return summary.agenda.slice(0, 5).map((item) => ({ id: item.id, dot: SEVERITY_DOT[item.severity], title: item.title, href: item.href }));
  }, [summary]);

  const moduleCards = useMemo(() => {
    if (!summary) return [];
    return [
      { icon: <IconHeart />, title: '健康中心', metrics: summary.health.metrics, href: '/health/step' },
      { icon: <IconDollar />, title: '财务中心', metrics: summary.finance.metrics, href: '/finance/shopping?shoppingTab=overview' },
      { icon: <IconHome />, title: '生活中心', metrics: summary.life.metrics, href: '/life/todo?todoTab=tasks' },
      { icon: <IconChart />, title: '投资中心', metrics: summary.investment.metrics, href: '/investment/forex?forexTab=trades' },
    ];
  }, [summary]);

  const timelineItems = useMemo(() => {
    if (!summary) return [];
    const items: Array<{ time: string; module: string; title: string; sortKey: number }> = [];
    summary.notifications.recentLogs.slice(0, 3).forEach((log) => {
      const d = new Date(log.createdAt);
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const hour = d.getHours().toString().padStart(2, '0');
      const minute = d.getMinutes().toString().padStart(2, '0');
      items.push({ time: `${month}-${day} ${hour}:${minute}`, module: '通知', title: log.title, sortKey: d.getTime() });
    });
    summary.agenda.slice(0, 2).forEach((item) => {
      const sortKey = item.targetDate ? new Date(item.targetDate).getTime() : 0;
      items.push({ time: item.targetDate || '-', module: item.module, title: item.title, sortKey });
    });
    return items.sort((a, b) => b.sortKey - a.sortKey).slice(0, 5);
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
            <Tag tone={hasAgenda ? 'orange' : 'green'}>{hasAgenda ? `${summary.agenda.length} 项待处理` : '全部正常'}</Tag>
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
          <span className="dash-agenda-label"><IconWarning /> 待处理</span>
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
