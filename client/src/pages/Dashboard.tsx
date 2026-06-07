import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState, PageHeader, SectionCard } from '../components/page';
import { Btn, Skeleton, Tag, TrendArrow } from '../components/ui';
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
      { icon: <IconHeart />, title: '健康中心', metrics: summary.health.metrics, href: '/health/step', trend: 'up' as const },
      { icon: <IconDollar />, title: '财务中心', metrics: summary.finance.metrics, href: '/finance/shopping?shoppingTab=overview', trend: 'down' as const },
      { icon: <IconHome />, title: '生活中心', metrics: summary.life.metrics, href: '/life/todo?todoTab=tasks', trend: 'down' as const },
      { icon: <IconChart />, title: '投资中心', metrics: summary.investment.metrics, href: '/investment/forex?forexTab=trades', trend: 'up' as const },
    ];
  }, [summary]);

  const timelineItems = useMemo(() => {
    if (!summary) return [];
    const items: Array<{ time: string; module: string; title: string; sortKey: number }> = [];
    summary.notifications.recentLogs.slice(0, 3).forEach((log) => {
      const d = new Date(log.createdAt);
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const hour = d.getHours().toString().padStart(2, '0');
      const minute = d.getMinutes().toString().padStart(2, '0');
      items.push({ time: `${year}-${month}-${day} ${hour}:${minute}`, module: '通知', title: log.title, sortKey: d.getTime() });
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
        <div className="section-card" style={{ padding: 24 }}>
          <Skeleton lines={4} />
        </div>
      </div>
    );
  }

  const hasAgenda = summary.agenda.length > 0;
  const h = summary.health.metrics, f = summary.finance.metrics, l = summary.life.metrics, inv = summary.investment.metrics;

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
        {/* 1. 今日步数 - 大号统计 */}
        <div className="dash-masonry-item dash-card dash-stat-big">
          <div className="dash-card-hd">
            <div className="dash-card-icon dash-bg-step"><IconSteps /></div>
            <div className="dash-card-title-area"><h3>今日步数</h3><span>健康追踪</span></div>
          </div>
          <div className="dash-card-bd">
            <div className="dash-stat-value">{h[0]?.value ?? '0'}</div>
            <div className="dash-stat-label">目标 10,000 步</div>
            <div className="dash-stat-sub">体重 {h[1]?.value || '-'} &nbsp;|&nbsp; 消耗约 {Math.round(Number(h[0]?.value||0)*0.04)} kcal</div>
            <div className="dash-progress-bar"><div className="dash-progress-fill" style={{width:`${Math.min(100,Number(h[0]?.value||0)/100)}%`,background:'linear-gradient(90deg,var(--color-primary),#7c3aed)'}}></div></div>
          </div>
        </div>

        {/* 2. 快捷操作 - 按钮组 */}
        <div className="dash-masonry-item dash-card">
          <div className="dash-card-bd" style={{padding:'16px'}}>
            <div style={{fontSize:'13px',fontWeight:600,marginBottom:'12px',color:'var(--color-ink-secondary)'}}>快捷入口</div>
            <div className="dash-quick-grid">
              <Link to="/health/step?stepTab=entry" className="dash-quick-btn"><div className="qa-icon dash-bg-step"><IconSteps /></div><span className="qa-text">录入步数</span></Link>
              <Link to="/finance/travel?travelTab=details" className="dash-quick-btn"><div className="qa-icon dash-bg-finance"><IconWallet /></div><span className="qa-text">记录消费</span></Link>
              <Link to="/life/todo?todoTab=tasks" className="dash-quick-btn"><div className="qa-icon dash-bg-life"><IconTodo /></div><span className="qa-text">新建待办</span></Link>
              <Link to="/finance/shopping?shoppingTab=records" className="dash-quick-btn"><div className="qa-icon dash-bg-invest"><IconChart /></div><span className="qa-text">购物记录</span></Link>
            </div>
          </div>
        </div>

        {/* 3. 投资收益 - 中等统计 */}
        <div className="dash-masonry-item dash-card dash-stat-med">
          <div className="dash-card-hd">
            <div className="dash-card-icon dash-bg-invest"><IconTrend /></div>
            <div className="dash-card-title-area"><h3>投资净收益</h3><span>本月累计</span></div>
          </div>
          <div className="dash-card-bd">
            <div className="dash-stat-value" style={Number(inv[0]?.value?.replace(/[^0-9.-]/g,'')||0)>=0?{color:'#059669'}:{color:'#dc2626'}}>{inv[0]?.value ?? '¥0'}</div>
            <div className="dash-stat-label">胜率 {inv[1]?.value ?? '0%'} &nbsp;|&nbsp; 活跃交易多笔</div>
            <div className="dash-stat-sub">
              <span style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--color-ink-mute)'}}>本周趋势</span><span className="trend-tag trend-up">查看详情 →</span></span>
              <div className="dash-chart-placeholder" style={{height:'100px',marginTop:'10px'}}>
                <div className="dash-mini-bar"><div className="bar" style={{height:'40%'}}></div><div className="bar" style={{height:'55%'}}></div><div className="bar" style={{height:'35%'}}></div><div className="bar" style={{height:'70%'}}></div><div className="bar" style={{height:'60%'}}></div><div className="bar" style={{height:'85%'}}></div><div className="bar" style={{height:'75%'}}></div></div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. 财务中心 - 多指标行 */}
        <div className="dash-masonry-item dash-card">
          <div className="dash-card-hd">
            <div className="dash-card-icon dash-bg-finance"><IconWallet /></div>
            <div className="dash-card-title-area"><h3>财务中心</h3><span>本月概览</span></div>
          </div>
          <div className="dash-card-bd">
            <div className="dash-metric-row"><span className="dash-metric-label">待还金额</span><span className="dash-metric-value" style={{color:'#dc2626'}}>{f[0]?.value ?? '¥0'}</span></div>
            <div className="dash-metric-row"><span className="dash-metric-label">活跃订阅</span><span className="dash-metric-value">{f[1]?.value ?? '0 项'}</span></div>
            <div className="dash-metric-row"><span className="dash-metric-label">本月消费</span><span className="dash-metric-value">--</span></div>
            <div className="dash-metric-row"><span className="dash-metric-label">预算剩余</span><span className="dash-metric-value" style={{color:'#059669'}}>--</span></div>
            <div style={{textAlign:'center'}}><span className="trend-tag trend-down">较上月 ---%</span></div>
          </div>
        </div>

        {/* 5. 最近动态 - 时间线 */}
        <div className="dash-masonry-item dash-card">
          <div className="dash-card-hd">
            <div className="dash-card-icon dash-bg-notif"><IconBell /></div>
            <div className="dash-card-title-area"><h3>最近动态</h3><span>实时更新</span></div>
          </div>
          <div className="dash-card-bd">
            {timelineItems.length > 0 ? timelineItems.map((item, i) => (
              <div key={i} className="dash-tl-item">
                <span className="dash-tl-time">{item.time}</span>
                <div className="dash-tl-body">
                  <div className="dash-tl-title">{item.title}</div>
                  <div className="dash-tl-module">{item.module}</div>
                </div>
              </div>
            )) : (
              <EmptyState title="暂无动态" description="当有新活动时会在这里显示" />
            )}
          </div>
        </div>

        {/* 6. 健康数据 - 中等统计 */}
        <div className="dash-masonry-item dash-card dash-stat-med">
          <div className="dash-card-hd">
            <div className="dash-card-icon dash-bg-health"><IconHeart /></div>
            <div className="dash-card-title-area"><h3>健康数据</h3><span>今日快照</span></div>
          </div>
          <div className="dash-card-bd">
            <div className="dash-stat-value">{h[1]?.value || '-'}<span style={{fontSize:'18px','color':'var(--color-ink-mute)','fontWeight':400}}>kg</span></div>
            <div className="dash-stat-label">体重 &nbsp;|&nbsp; BMI 正常范围</div>
            <div className="dash-stat-sub">
              <div style={{display:'flex',gap:'16px',fontSize:'12px','color':'var(--color-ink-secondary)'}}>
                <span>🏃 步数 {h[0]?.value || '0'}</span>
                <span>💊 用药 --</span>
              </div>
              <div style={{display:'flex',gap:'16px',fontSize:'12px','color':'var(--color-ink-secondary)',marginTop:'4px'}}>
                <span>📋 体检 待做</span>
              </div>
            </div>
          </div>
        </div>

        {/* 7. 生活中心 - 小号紧凑 */}
        <div className="dash-masonry-item dash-card dash-stat-sm">
          <div className="dash-card-hd">
            <div className="dash-card-icon dash-bg-life"><IconHome /></div>
            <div className="dash-card-title-area"><h3>生活中心</h3><span>物品与号卡</span></div>
          </div>
          <div className="dash-card-bd">
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              <div><div className="dash-stat-value">{l[0]?.value ?? '0'}</div><div className="dash-stat-label">待办事项</div></div>
              <div><div className="dash-stat-value">{l[1]?.value ?? '0'}</div><div className="dash-stat-label">物品追踪</div></div>
              <div><div className="dash-stat-value">4</div><div className="dash-stat-label">活跃号卡</div></div>
              <div><div className="dash-stat-value">{summary.notifications.logCount > 0 ? Math.min(summary.notifications.logCount, 3) : 0}</div><div className="dash-stat-label">通知日志</div></div>
            </div>
          </div>
        </div>

        {/* 8. 通知状态 - 小号紧凑 */}
        <div className="dash-masonry-item dash-card dash-stat-sm">
          <div className="dash-card-hd">
            <div className="dash-card-icon dash-bg-notif"><IconBell /></div>
            <div className="dash-card-title-area"><h3>通知中心</h3><span>渠道状态</span></div>
          </div>
          <div className="dash-card-bd">
            <div className="dash-stat-value">{summary.notifications.enabledChannels}</div>
            <div className="dash-stat-label">已启用渠道</div>
            <div className="dash-stat-sub" style={{marginTop:'12px',paddingTop:'10px',borderTop:'1px solid var(--color-surface-3)'}}>
              <div style={{fontSize:'12px',display:'flex',flexDirection:'column',gap:'6px'}}>
                <span style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--color-ink-mute)'}}>邮件</span><span style={{padding:'1px 6px',fontSize:'10px'}}><Tag tone="green">正常</Tag></span></span>
                <span style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--color-ink-mute)'}}>企业微信</span><span style={{padding:'1px 6px',fontSize:'10px'}}><Tag tone="green">正常</Tag></span></span>
                <span style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--color-ink-mute)'}}>Webhook</span><span style={{padding:'1px 6px',fontSize:'10px'}}><Tag tone="default">未配置</Tag></span></span>
              </div>
            </div>
          </div>
        </div>

        {/* 9. 待处理提醒条（如果有 agenda） */}
        {hasAgenda ? (
          <div className="dash-masonry-item dash-card">
            <div className="dash-card-bd" style={{padding:'14px 18px',background:'color-mix(in srgb,#f59e0b 6%,var(--color-surface-2))',borderRadius:'14px'}}>
              <div style={{fontSize:'13px',fontWeight:600,color:'#92400e',marginBottom:'10px',display:'flex',alignItems:'center',gap:'6px'}}>
                <IconWarning /> 待处理事项 ({summary.agenda.length})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                {agendaInline.map((item) => (
                  <Link key={item.id} to={item.href} style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'6px 12px',borderRadius:'10px',background:'var(--color-surface-1)',border:'1px solid var(--color-hairline)',textDecoration:'none',color:'inherit',fontSize:'13px',transition:'all 0.15s'}}>
                    <span style={{lineHeight:1}}>{item.dot}</span>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'180px'}}>{item.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* 10. 本周趋势图占位 */}
        <div className="dash-masonry-item dash-card">
          <div className="dash-card-hd">
            <div className="dash-card-icon dash-bg-step"><IconTrend /></div>
            <div className="dash-card-title-area"><h3>本周趋势概览</h3><span>近 7 天</span></div>
          </div>
          <div className="dash-card-bd">
            <div className="dash-chart-placeholder" style={{height:'160px'}}>
              <div className="dash-mini-bar" style={{left:'12px',right:'12px',height:'100px'}}>
                <div className="bar" style={{height:'65%',background:'linear-gradient(180deg,var(--color-primary)40%,var(--color-primary))'}}></div>
                <div className="bar" style={{height:'82%',background:'linear-gradient(180deg,var(--color-primary)40%,var(--color-primary))'}}></div>
                <div className="bar" style={{height:'45%',background:'linear-gradient(180deg,var(--color-primary)40%,var(--color-primary))'}}></div>
                <div className="bar" style={{height:'90%',background:'linear-gradient(180deg,var(--color-primary)40%,var(--color-primary))'}}></div>
                <div className="bar" style={{height:'55%',background:'linear-gradient(180deg,var(--color-primary)40%,var(--color-primary))'}}></div>
                <div className="bar" style={{height:'78%',background:'linear-gradient(180deg,var(--color-primary)40%,var(--color-primary))'}}></div>
                <div className="bar" style={{height:'84%',background:'linear-gradient(180deg,var(--color-primary)40%,var(--color-primary))'}}></div>
              </div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:'10px',fontSize:'11px',color:'var(--color-ink-mute)'}}>
              <span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>今天</span>
            </div>
            <div style={{textAlign:'center',marginTop:'10px'}}>
              <Tag tone="blue">日均 -- 步</Tag>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
