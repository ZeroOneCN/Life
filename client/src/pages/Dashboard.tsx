import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, PageHeader, SectionCard } from '../components/page';
import { Btn, Tag } from '../components/ui';
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

const MODULE_ICONS: Record<string, string> = {
  health: '\u2764\uFE0F',
  finance: '\u{1F4B0}',
  life: '\u{1F3E0}',
  investment: '\u{1F4C8}',
  notification: '\u{1F514}',
};

const SEVERITY_CONFIG: Record<string, { icon: string; label: string; tone: 'default' | 'green' | 'orange' | 'blue' | 'red' }> = {
  high: { icon: '\u{1F534}', label: '紧急', tone: 'red' as const },
  medium: { icon: '\u{1F7E0}', label: '关注', tone: 'orange' as const },
  low: { icon: '\u{1F7E1}', label: '提示', tone: 'blue' as const },
};

interface QuickStatProps {
  icon: string;
  label: string;
  value: string;
  href: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function QuickStat({ icon, label, value, href, subValue, trend }: QuickStatProps) {
  return (
    <Link className="quick-stat-card" to={href}>
      <span className="quick-stat-icon">{icon}</span>
      <div className="quick-stat-content">
        <span className="quick-stat-label">{label}</span>
        <strong className="quick-stat-value">{value}</strong>
        {subValue ? <span className="quick-stat-sub">{subValue}</span> : null}
      </div>
      {trend ? (
        <span className={`quick-stat-trend ${trend}`}>
          {trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2192'}
        </span>
      ) : null}
    </Link>
  );
}

interface AgendaItemProps {
  item: DashboardAgendaItem;
}

function AgendaItem({ item }: AgendaItemProps) {
  const config = SEVERITY_CONFIG[item.severity];

  return (
    <Link className="agenda-item" to={item.href}>
      <span className={`agenda-severity agenda-severity-${item.severity}`}>{config.icon}</span>
      <div className="agenda-main">
        <div className="agenda-header">
          {/* @ts-ignore */}
          <Tag tone={config.tone} className="agenda-tag">{config.label}</Tag>
          <span className="agenda-module">{item.module}</span>
        </div>
        <strong className="agenda-title">{item.title}</strong>
        <p className="agenda-summary">{item.summary}</p>
      </div>
      <div className="agenda-action">\u2192</div>
    </Link>
  );
}

interface TimelineItemProps {
  time: string;
  module: string;
  title: string;
  description?: string;
}

function TimelineItem({ time, module, title, description }: TimelineItemProps) {
  return (
    <div className="timeline-item">
      <span className="timeline-time">{time}</span>
      <span className="timeline-module">{module}</span>
      <div className="timeline-content">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
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
        if (cancelled) return;

        const health: DashboardModuleSnapshot = {
          title: '健康中心',
          subtitle: '',
          metrics: [
            { label: '今日步数', value: `${raw.health.stats.todayStepCount}`, helper: '' },
            { label: '体重', value: raw.health.stats.latestWeight ? `${raw.health.stats.latestWeight} kg` : '-', helper: '' },
          ],
          chartTitle: '',
          chartDescription: '',
          chartKind: 'line',
          chartData: [],
          listTitle: '',
          listDescription: '',
          listItems: [],
        };

        const finance: DashboardModuleSnapshot = {
          title: '财务中心',
          subtitle: '',
          metrics: [
            { label: '待还金额', value: formatMoney(raw.finance.stats.totalUnpaidLoanAmount), helper: '' },
            { label: '订阅服务', value: `${raw.finance.stats.activeSubscriptionCount} 项`, helper: '' },
          ],
          chartTitle: '',
          chartDescription: '',
          chartKind: 'bar',
          chartData: [],
          listTitle: '',
          listDescription: '',
          listItems: [],
        };

        const life: DashboardModuleSnapshot = {
          title: '生活中心',
          subtitle: '',
          metrics: [
            { label: '待办事项', value: `${raw.life.stats.pendingTodoCount}`, helper: '' },
            { label: '物品追踪', value: `${raw.life.stats.activeStorageCount} 件`, helper: '' },
          ],
          chartTitle: '',
          chartDescription: '',
          chartKind: 'line',
          chartData: [],
          listTitle: '',
          listDescription: '',
          listItems: [],
        };

        const investment: DashboardModuleSnapshot = {
          title: '投资中心',
          subtitle: '',
          metrics: [
            { label: '净收益', value: formatSignedMoney(raw.investment.stats.netPnl), helper: '' },
            { label: '胜率', value: formatPercent(raw.investment.stats.winRate), helper: '' },
          ],
          chartTitle: '',
          chartDescription: '',
          chartKind: 'line',
          chartData: [],
          listTitle: '',
          listDescription: '',
          listItems: [],
        };

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

    const healthStats = summary.health.metrics;
    const financeStats = summary.finance.metrics;
    const lifeStats = summary.life.metrics;
    const investStats = summary.investment.metrics;

    return [
      {
        icon: '\uD83D\uDCC3',
        label: '今日步数',
        value: healthStats[0]?.value ?? '0',
        href: '/health/step',
        subValue: healthStats[1]?.value,
      },
      {
        icon: '\uD83D\uDCB0',
        label: '投资收益',
        value: investStats[0]?.value ?? '¥0',
        href: '/investment/forex?forexTab=trades',
        subValue: investStats[1]?.value,
      },
      {
        icon: '\uD83D\uDCCB',
        label: '待办事项',
        value: lifeStats[0]?.value ?? '0',
        href: '/life/todo?todoTab=tasks',
        subValue: `今日 ${summary.agenda.filter((a) => a.severity === 'high').length} 项紧急`,
      },
      {
        icon: '\uD83D\uDCB3',
        label: '待还金额',
        value: financeStats[0]?.value ?? '¥0',
        href: '/finance/loan',
        subValue: `${summary.agenda.filter((a) => a.module.includes('贷款') || a.module.includes('订阅')).length} 项待处理`,
      },
      {
        icon: '\uD83D\uDCD1',
        label: '号卡余额',
        value: `${lifeStats.find((m) => m.label.includes('物品')) ? lifeStats[1]?.value ?? '0' : '-'}`,
        href: '/life/card?cardTab=cards',
        subValue: '检查低余额',
      },
      {
        icon: '\uD83D\uDD14',
        label: '通知提醒',
        value: `${summary.notifications.logCount}`,
        href: '/notifications?tab=logs',
        subValue: `${summary.notifications.enabledChannels} 渠道`,
      },
    ];
  }, [summary]);

  const timelineItems = useMemo(() => {
    if (!summary) return [];

    const items: Array<{ time: string; module: string; title: string; description?: string }> = [];

    summary.notifications.recentLogs.slice(0, 3).forEach((log) => {
      const date = new Date(log.createdAt);
      items.push({
        time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
        module: '通知',
        title: log.title,
        description: log.message.length > 50 ? log.message.slice(0, 50) + '...' : log.message,
      });
    });

    summary.agenda.slice(0, 2).forEach((item) => {
      items.push({
        time: item.targetDate || '-',
        module: item.module,
        title: item.title,
        description: item.summary,
      });
    });

    return items.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5);
  }, [summary]);

  if (!summary) {
    return (
      <div className="page-stack dashboard-page">
        <PageHeader
          title="LifeOS 控制台"
          subtitle={loadingError || '正在加载数据...'}
        />
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

      <section className="quick-stats-grid">
        {topStats.map((stat) => (
          <QuickStat key={stat.label} {...stat} />
        ))}
      </section>

      {hasAgenda ? (
        <SectionCard
          title="待处理事项"
          description={`按优先级排序，共 ${summary.agenda.length} 项需要关注`}
        >
          <div className="agenda-list">
            {summary.agenda.slice(0, 5).map((item) => (
              <AgendaItem key={item.id} item={item} />
            ))}
          </div>
          {summary.agenda.length > 5 ? (
            <div className="agenda-footer">
              <Btn tone="ghost">查看全部 {summary.agenda.length} 项</Btn>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard title="快捷入口" description="点击进入各模块管理">
        <div className="module-grid">
          <Link className="module-card" to="/health/step">
            <span className="module-icon">{MODULE_ICONS.health}</span>
            <div className="module-info">
              <strong>健康中心</strong>
              <span>{summary.health.metrics[0]?.value ?? '0'} 步</span>
            </div>
            <span className="module-arrow">\u2192</span>
          </Link>

          <Link className="module-card" to="/finance/shopping?shoppingTab=overview">
            <span className="module-icon">{MODULE_ICONS.finance}</span>
            <div className="module-info">
              <strong>财务中心</strong>
              <span>{summary.finance.metrics[0]?.value ?? '¥0'}</span>
            </div>
            <span className="module-arrow">\u2192</span>
          </Link>

          <Link className="module-card" to="/life/todo?todoTab=tasks">
            <span className="module-icon">{MODULE_ICONS.life}</span>
            <div className="module-info">
              <strong>生活中心</strong>
              <span>{summary.life.metrics[0]?.value ?? '0'} 待办</span>
            </div>
            <span className="module-arrow">\u2192</span>
          </Link>

          <Link className="module-card" to="/investment/forex?forexTab=trades">
            <span className="module-icon">{MODULE_ICONS.investment}</span>
            <div className="module-info">
              <strong>投资中心</strong>
              <span>{summary.investment.metrics[0]?.value ?? '¥0'}</span>
            </div>
            <span className="module-arrow">\u2192</span>
          </Link>

          <Link className="module-card" to="/notifications?tab=overview">
            <span className="module-icon">{MODULE_ICONS.notification}</span>
            <div className="module-info">
              <strong>通知中心</strong>
              <span>{summary.notifications.enabledChannels} 渠道</span>
            </div>
            <span className="module-arrow">\u2192</span>
          </Link>

          <Link className="module-card module-card-settings" to="/settings/profile">
            <span className="module-icon">\u2699\uFE0F</span>
            <div className="module-info">
              <strong>系统设置</strong>
              <span>个人偏好</span>
            </div>
            <span className="module-arrow">\u2192</span>
          </Link>
        </div>
      </SectionCard>

      <SectionCard title="最近动态" description="各模块最新活动汇总">
        <div className="timeline-list">
          {timelineItems.length > 0 ? (
            timelineItems.map((item, index) => <TimelineItem key={index} {...item} />)
          ) : (
            <EmptyState title="暂无动态" description="当有新活动时会在这里显示" />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
