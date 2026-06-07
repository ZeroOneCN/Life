import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, PageHeader } from '../components/page';
import { Skeleton, Tag } from '../components/ui';
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
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 01-2 2H4a2 2 0 01-2-2z"/>
    <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 002 2h2a2 2 0 002-2z"/>
  </svg>
);

const IconTrend = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);

const IconTodo = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconWallet = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const IconBell = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);

const IconHeart = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
  </svg>
);

const IconHome = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const IconChart = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const SEVERITY_DOT_CLASS: Record<string, string> = {
  high: 'dash-dot dash-dot-high',
  medium: 'dash-dot dash-dot-medium',
  low: 'dash-dot dash-dot-low',
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

        const buildModule = (title: string, metrics: Array<{ label: string; value: string; helper?: string }>, chartKind: 'bar' | 'line'): DashboardModuleSnapshot => ({
          title, subtitle: '', metrics, chartTitle: '', chartDescription: '', chartKind, chartData: [], listTitle: '', listDescription: '', listItems: [],
        });

        setSummary({
          overviewCards: raw.overviewCards.map((item) => ({ id: item.key, label: item.label, value: String(item.value), helper: '' })),
          agenda: raw.agenda,
          health: buildModule('健康中心', [
            { label: '今日步数', value: `${raw.health.stats.todayStepCount}`, helper: '' },
            { label: '体重', value: raw.health.stats.latestWeight ? `${Number(raw.health.stats.latestWeight).toFixed(2)} kg` : '-', helper: '' },
            { label: '净热量', value: raw.health.stats.todayCalorieNet ? `${raw.health.stats.todayCalorieNet} kcal` : '-', helper: '' },
            { label: '待体检', value: `${raw.health.stats.checkupPendingCount}项`, helper: '' },
            { label: '药品低库存', value: `${raw.health.stats.medicationLowStockCount}种`, helper: '' },
          ], 'line'),
          finance: buildModule('财务中心', [
            { label: '待还金额', value: formatMoney(raw.finance.stats.totalUnpaidLoanAmount), helper: '' },
            { label: '逾期贷款', value: `${raw.finance.stats.overdueLoanCount}笔`, helper: '' },
            { label: '活跃订阅', value: `${raw.finance.stats.activeSubscriptionCount}项`, helper: '' },
          ], 'bar'),
          life: buildModule('生活中心', [
            { label: '待办事项', value: `${raw.life.stats.pendingTodoCount}项`, helper: '' },
            { label: '今日到期', value: `${raw.life.stats.dueTodayTodoCount}项`, helper: '' },
            { label: '物品追踪', value: `${raw.life.stats.activeStorageCount}件`, helper: '' },
            { label: '低余额号卡', value: `${raw.life.stats.lowBalanceCardCount}张`, helper: '' },
          ], 'line'),
          investment: buildModule('投资中心', [
            { label: '净收益', value: formatSignedMoney(raw.investment.stats.netPnl), helper: '' },
            { label: '胜率', value: formatPercent(raw.investment.stats.winRate), helper: '' },
            { label: '净资金', value: formatMoney(raw.investment.stats.netCapital), helper: '' },
            { label: '活跃交易', value: `${raw.investment.stats.activeTradeCount}笔`, helper: '' },
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

  const agendaInline = useMemo(() => {
    if (!summary) return [];
    return summary.agenda.slice(0, 6).map((item) => ({ id: item.id, dotClass: SEVERITY_DOT_CLASS[item.severity] ?? 'dash-dot dash-dot-low', title: item.title, href: item.href }));
  }, [summary]);

  const timelineItems = useMemo(() => {
    if (!summary) return [];
    const items: Array<{ time: string; module: string; moduleClass: string; title: string; sortKey: number }> = [];
    summary.notifications.recentLogs.slice(0, 6).forEach((log) => {
      const d = new Date(log.createdAt);
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const hour = d.getHours().toString().padStart(2, '0');
      const minute = d.getMinutes().toString().padStart(2, '0');
      const second = d.getSeconds().toString().padStart(2, '0');
      items.push({ time: `${year}-${month}-${day} ${hour}:${minute}:${second}`, module: '通知', moduleClass: 'is-notif', title: log.title, sortKey: d.getTime() });
    });
    summary.agenda.slice(0, 4).forEach((item) => {
      const sortKey = item.targetDate ? new Date(item.targetDate).getTime() : 0;
      const raw = item.targetDate ? item.targetDate.replace('T', ' ').slice(0, 19) : '-';
      /* 日期只有 YYYY-MM-DD 时补全为 00:00:00 */
      const time = raw !== '-' && raw.length <= 10 ? `${raw} 00:00:00` : raw;
      items.push({ time, module: item.module, moduleClass: 'is-agenda', title: item.title, sortKey });
    });
    return items.sort((a, b) => b.sortKey - a.sortKey);
  }, [summary]);

  /* 从最近日志中判断各渠道是否有最近活动（非配置状态） */
  const channelActivity = useMemo(() => {
    if (!summary) return { email: false, wechatWork: false, webhook: false };
    const channels = new Set(summary.notifications.recentLogs.map((log) => log.channel));
    return {
      email: channels.has('email'),
      wechatWork: channels.has('wechatWork'),
      webhook: channels.has('webhook'),
    };
  }, [summary]);

  if (!summary) {
    return (
      <div className="page-stack dashboard-page">
        <PageHeader title="LifeOS 控制台" subtitle={loadingError || '正在加载数据...'} />
        <div className="section-card dash-skeleton-pad">
          <Skeleton lines={4} />
        </div>
      </div>
    );
  }

  const hasAgenda = summary.agenda.length > 0;
  const h = summary.health.metrics, f = summary.finance.metrics, l = summary.life.metrics, inv = summary.investment.metrics;
  const stepsNum = Number(h[0]?.value || 0);
  /* PNL 字符串形如 "+123" / "-123" / "0"，判断首字符判断正负 */
  const pnlRaw = inv[0]?.value ?? '0';
  const isPnlPositive = !pnlRaw.startsWith('-');

  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        title="LifeOS 控制台"
        subtitle="一目了然，快速行动"
        actions={(
          <div className="dashboard-header-tags">
            <Tag tone={hasAgenda ? 'orange' : 'green'}>{hasAgenda ? `${summary.agenda.length} 项待处理` : '全部正常'}</Tag>
            <Tag tone="default">{summary.connectedModuleCount} 个模块已接入</Tag>
          </div>
        )}
      />

      <div className="dash-masonry">

        {/* ====== 0. 待办事项（顶部一行，全宽横跨）====== */}
        {hasAgenda ? (
          <div className="dash-masonry-item dash-card is-full">
            <div className="dash-card-hd is-tight">
              <div className="dash-card-icon dash-bg-life"><IconTodo /></div>
              <div className="dash-card-title-area">
                <h3>待处理事项</h3>
                <span>共 {summary.agenda.length} 项需要关注</span>
              </div>
              <Link to="/life/todo?todoTab=tasks" className="dash-link-primary">查看全部 →</Link>
            </div>
            <div className="dash-card-bd">
              <div className="dash-agenda-list">
                {agendaInline.map((item) => (
                  <Link key={item.id} to={item.href} className="dash-agenda-item">
                    <span className={item.dotClass} aria-hidden="true" />
                    <span className="dash-agenda-title">{item.title}</span>
                    <span className="dash-agenda-arrow">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* ====== 1. 健康中心（大模块，可点击跳转）====== */}
        <Link to="/health/step" className="dash-masonry-item dash-card dash-card-link">
          <div className="dash-card-hd is-tight">
            <div className="dash-card-icon dash-bg-health"><IconHeart /></div>
            <div className="dash-card-title-area">
              <h3>健康中心</h3>
              <span>今日数据快照</span>
            </div>
            <span className="dash-arrow">→</span>
          </div>
          <div className="dash-card-bd">
            <div className="dash-step-block">
              <div className="dash-step-label">今日步数</div>
              <div className="dash-step-value">
                {h[0]?.value?.toLocaleString() || '0'}
              </div>
              <div className="dash-step-meta">
                <span className="dash-step-meta-label">今日已录入</span>
                <span className="dash-step-meta-value">{stepsNum.toLocaleString()} 步</span>
              </div>
            </div>
            <div className="dash-mini-grid">
              {h.slice(1).map((m, i) => (
                <div key={i} className="dash-mini-stat">
                  <div className="dash-mini-stat-label">{m.label}</div>
                  <div className="dash-mini-stat-value">{m.value}</div>
                </div>
              ))}
            </div>
          </div>
        </Link>

        {/* ====== 2. 快捷操作入口 ====== */}
        <div className="dash-masonry-item dash-card">
          <div className="dash-card-hd is-tight">
            <div className="dash-card-icon dash-bg-step"><IconSteps /></div>
            <div className="dash-card-title-area">
              <h3>快捷操作</h3>
              <span>常用功能一键直达</span>
            </div>
          </div>
          <div className="dash-card-bd">
            <div className="dash-quick-grid">
              <Link to="/health/step?stepTab=entry" className="dash-quick-btn">
                <div className="qa-icon dash-bg-step"><IconSteps /></div>
                <span className="qa-text">录入步数</span>
              </Link>
              <Link to="/finance/travel?travelTab=details" className="dash-quick-btn">
                <div className="qa-icon dash-bg-finance"><IconWallet /></div>
                <span className="qa-text">记录消费</span>
              </Link>
              <Link to="/life/todo?todoTab=tasks" className="dash-quick-btn">
                <div className="qa-icon dash-bg-life"><IconTodo /></div>
                <span className="qa-text">新建待办</span>
              </Link>
              <Link to="/finance/shopping?shoppingTab=records" className="dash-quick-btn">
                <div className="qa-icon dash-bg-invest"><IconChart /></div>
                <span className="qa-text">购物记录</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ====== 3. 投资中心（可点击跳转）====== */}
        <Link to="/investment/forex?forexTab=trades" className="dash-masonry-item dash-card dash-card-link">
          <div className="dash-card-hd is-tight">
            <div className="dash-card-icon dash-bg-invest"><IconTrend /></div>
            <div className="dash-card-title-area">
              <h3>投资中心</h3>
              <span>本月累计数据</span>
            </div>
            <span className="dash-arrow">→</span>
          </div>
          <div className="dash-card-bd">
            <div className="dash-pnl-block">
              <div className="dash-pnl-block-label">净收益</div>
              <div className={`dash-pnl-display ${isPnlPositive ? 'is-positive' : 'is-negative'}`}>
                {inv[0]?.value || '¥0'}
              </div>
            </div>
            {inv.slice(1).map((m, i) => (
              <div key={i} className="dash-metric-row is-tight">
                <span className="dash-metric-label">{m.label}</span>
                <span className="dash-metric-value">{m.value}</span>
              </div>
            ))}
            <div className="dash-trend-cta">
              <span className={`dash-trend-cta-pill ${isPnlPositive ? 'is-positive' : 'is-negative'}`}>
                {isPnlPositive ? '盈利中' : '亏损中'} · 查看详情 →
              </span>
            </div>
          </div>
        </Link>

        {/* ====== 4. 财务中心（可点击跳转）====== */}
        <Link to="/finance/loan" className="dash-masonry-item dash-card dash-card-link">
          <div className="dash-card-hd is-tight">
            <div className="dash-card-icon dash-bg-finance"><IconWallet /></div>
            <div className="dash-card-title-area">
              <h3>财务中心</h3>
              <span>资金与订阅概览</span>
            </div>
            <span className="dash-arrow">→</span>
          </div>
          <div className="dash-card-bd">
            {f.map((m, i) => (
              <div key={i} className="dash-metric-row is-loose">
                <span className="dash-metric-label">{m.label}</span>
                <span className={`dash-metric-value is-strong ${i === 0 ? 'is-danger-accent' : ''}`}>{m.value}</span>
              </div>
            ))}
            <div className="dash-trend-cta">
              <span className="dash-trend-cta-pill is-negative">管理财务 →</span>
            </div>
          </div>
        </Link>

        {/* ====== 5. 生活中心（可点击跳转）====== */}
        <Link to="/life/todo?todoTab=tasks" className="dash-masonry-item dash-card dash-card-link">
          <div className="dash-card-hd is-tight">
            <div className="dash-card-icon dash-bg-life"><IconHome /></div>
            <div className="dash-card-title-area">
              <h3>生活中心</h3>
              <span>待办与物品追踪</span>
            </div>
            <span className="dash-arrow">→</span>
          </div>
          <div className="dash-card-bd">
            {l.map((m, i) => (
              <div key={i} className="dash-metric-row is-loose">
                <span className="dash-metric-label">{m.label}</span>
                <span className="dash-metric-value is-strong">{m.value}</span>
              </div>
            ))}
            <div className="dash-trend-cta">
              <span className="dash-trend-cta-pill is-primary">管理生活 →</span>
            </div>
          </div>
        </Link>

        {/* ====== 6. 最近动态（表格）====== */}
        <div className="dash-masonry-item dash-card">
          <div className="dash-card-hd is-tight">
            <div className="dash-card-icon dash-bg-notif"><IconBell /></div>
            <div className="dash-card-title-area">
              <h3>最近动态</h3>
              <span>实时活动记录</span>
            </div>
          </div>
          <div className="dash-card-bd">
            {timelineItems.length > 0 ? (
              <>
                <div className="dash-timeline-grid dash-timeline-header">
                  <span>日期时间</span>
                  <span>类型</span>
                  <span>具体内容</span>
                </div>
                {timelineItems.map((item, i) => (
                  <div key={i} className="dash-timeline-grid dash-timeline-row">
                    <span className="dash-timeline-cell-time">{item.time}</span>
                    <span className={`dash-timeline-cell-module ${item.moduleClass}`}>{item.module}</span>
                    <span className="dash-timeline-cell-title">{item.title}</span>
                  </div>
                ))}
              </>
            ) : (
              <EmptyState title="暂无动态" description="当有新活动时会在这里显示" />
            )}
          </div>
        </div>

        {/* ====== 7. 通知渠道状态 ====== */}
        <div className="dash-masonry-item dash-card">
          <div className="dash-card-hd is-tight">
            <div className="dash-card-icon dash-bg-notif"><IconBell /></div>
            <div className="dash-card-title-area">
              <h3>通知中心</h3>
              <span>渠道与日志状态</span>
            </div>
          </div>
          <div className="dash-card-bd">
            <div className="dash-notif-stats">
              <div className="dash-notif-stat">
                <div className="dash-notif-stat-value is-primary">{summary.notifications.enabledChannels}</div>
                <div className="dash-notif-stat-label">已启用渠道</div>
              </div>
              <div className="dash-notif-stat">
                <div className="dash-notif-stat-value">{summary.notifications.logCount}</div>
                <div className="dash-notif-stat-label">最近日志数</div>
              </div>
            </div>
            <div className="dash-notif-channel-list">
              <div className="dash-notif-channel-row">
                <span className="dash-notif-channel-row-label">邮件通道</span>
                <Tag tone={channelActivity.email ? 'green' : 'default'}>{channelActivity.email ? '有日志' : '静默'}</Tag>
              </div>
              <div className="dash-notif-channel-row">
                <span className="dash-notif-channel-row-label">企业微信</span>
                <Tag tone={channelActivity.wechatWork ? 'green' : 'default'}>{channelActivity.wechatWork ? '有日志' : '静默'}</Tag>
              </div>
              <div className="dash-notif-channel-row">
                <span className="dash-notif-channel-row-label">Webhook</span>
                <Tag tone={channelActivity.webhook ? 'green' : 'default'}>{channelActivity.webhook ? '有日志' : '静默'}</Tag>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
