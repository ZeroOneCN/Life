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
import {
  buildDashboardSummary,
  buildDashboardAgenda,
  buildDashboardHealthSnapshot,
  buildDashboardFinanceSnapshot,
  buildDashboardLifeSnapshot,
  buildDashboardInvestmentSnapshot,
  buildDashboardNotificationSnapshot,
} from '../services/dashboard';

const TOOLTIP_STYLE = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-hairline)',
  borderRadius: 14,
  boxShadow: 'var(--shadow-soft)',
};

function useDashboardSummaryState() {
  const [summary, setSummary] = useState(() => buildDashboardSummary());

  useEffect(() => {
    const refresh = () => {
      setSummary({
        overviewCards: buildDashboardSummary().overviewCards,
        agenda: buildDashboardAgenda(),
        health: buildDashboardHealthSnapshot(),
        finance: buildDashboardFinanceSnapshot(),
        life: buildDashboardLifeSnapshot(),
        investment: buildDashboardInvestmentSnapshot(),
        notifications: buildDashboardNotificationSnapshot(),
        connectedModuleCount: buildDashboardSummary().connectedModuleCount,
      });
    };

    refresh();
    const onVisibility = () => {
      if (!document.hidden) {
        refresh();
      }
    };
    const intervalId = window.setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return summary;
}

function AgendaSeverityTag({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  if (severity === 'high') {
    return <Tag tone="red">高风险</Tag>;
  }

  if (severity === 'medium') {
    return <Tag tone="orange">需跟进</Tag>;
  }

  return <Tag tone="blue">可关注</Tag>;
}

function SnapshotChart({
  kind,
  data,
}: {
  kind: 'bar' | 'line';
  data: Array<{ id: string; label: string; value: number; secondaryValue?: number; color?: string }>;
}) {
  if (!data.length) {
    return <EmptyState title="暂无趋势" description="当前模块还没有足够的本地数据形成首页摘要图表。" />;
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
            <Line
              type="monotone"
              dataKey="value"
              name="主指标"
              stroke="var(--color-primary)"
              strokeWidth={2.4}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="secondaryValue"
              name="对照指标"
              stroke="#10b981"
              strokeWidth={1.8}
              strokeDasharray="4 4"
              dot={false}
            />
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
}: ReturnType<typeof buildDashboardHealthSnapshot>) {
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
  const summary = useDashboardSummaryState();
  const statusTags = useMemo(() => ([
    { label: '系统在线', tone: 'green' as const },
    { label: '本地优先', tone: 'blue' as const },
    { label: `${summary.connectedModuleCount} 个模块已接入`, tone: 'default' as const },
  ]), [summary.connectedModuleCount]);

  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        title="全局控制台"
        subtitle="把健康、财务、生活、投资和通知中心的高信号信息收敛到同一张首页里，优先帮助你看清现在最该处理什么。"
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
        description="这里不会只显示通知日志，而是把各业务页真正需要你处理的事项统一排出来，并按风险级别和日期优先级排序。"
      >
        {summary.agenda.length ? (
          <div className="dashboard-agenda-list">
            {summary.agenda.map((item) => (
              <Link className="dashboard-agenda-item" key={item.id} to={item.href}>
                <div className="dashboard-agenda-main">
                  <div className="dashboard-agenda-top">
                    <span className="dashboard-agenda-module">{item.module}</span>
                    <AgendaSeverityTag severity={item.severity} />
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
          <EmptyState title="当前没有临近待处理事项" description="所有已接入模块都没有落入提醒窗口，首页会继续监听后续变化。" />
        )}
      </SectionCard>

      <div className="dashboard-bottom-grid">
        <SnapshotSection {...summary.health} />
        <SnapshotSection {...summary.finance} />
        <SnapshotSection {...summary.life} />
        <SnapshotSection {...summary.investment} />

        <SectionCard
          title="通知中心动态"
          description="通知中心继续作为统一出口，首页这里只保留启用状态、活跃场景和最近日志，避免重复造另一套消息系统。"
        >
          <div className="dashboard-notification-stack">
            <StatGrid
              className="dashboard-notification-grid"
              items={[
                { label: '启用渠道数', value: `${summary.notifications.enabledChannels}`, helper: '通知中心统一管理渠道配置' },
                { label: '启用场景数', value: `${summary.notifications.enabledScenes}`, helper: '与通知中心页面保持一致' },
                { label: '最近日志数', value: `${summary.notifications.logCount}`, helper: '只统计前端本地通知日志' },
                { label: '最活跃场景', value: summary.notifications.mostActiveSceneLabel, helper: '过去一段时间写入最多的业务场景' },
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
              <EmptyState title="暂无通知动态" description="当业务页触发提醒或手动测试通知后，这里会同步显示最近日志。" />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
