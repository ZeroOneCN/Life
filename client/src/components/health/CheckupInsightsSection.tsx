import { useMemo } from 'react';

import { NotificationLogTable } from '../NotificationLogTable';
import { NotificationStatusCard } from '../NotificationStatusCard';
import { SettingSwitchCard } from '../SettingSwitchCard';
import { EmptyState, SectionCard } from '../page';
import { DataTable, Field, Tag } from '../ui';
import {
  CHECKUP_STATUS_META,
  buildCheckupInsights,
  buildDueFollowUps,
} from '../../services/checkup';
import { useNotificationCenterState } from '../../services/notificationCenter';
import type { CheckupPageState, CheckupRecord } from '../../types/checkup';

interface CheckupInsightsSectionProps {
  records: CheckupRecord[];
  settings: CheckupPageState['settings'];
  onSettingsChange: (patch: Partial<CheckupPageState['settings']>) => void;
  onReminderToggle: (checked: boolean) => void;
  onAbnormalAlertToggle: (checked: boolean) => void;
}

export function CheckupInsightsSection({
  records,
  settings,
  onSettingsChange,
  onReminderToggle,
  onAbnormalAlertToggle,
}: CheckupInsightsSectionProps) {
  const notificationState = useNotificationCenterState();

  const insights = useMemo(
    () => buildCheckupInsights(records, settings.insightUserId, settings.followUpLeadDays),
    [records, settings.followUpLeadDays, settings.insightUserId],
  );

  const dueFollowUps = useMemo(
    () => buildDueFollowUps(records, settings.insightUserId, settings.followUpLeadDays),
    [records, settings.followUpLeadDays, settings.insightUserId],
  );

  const latestLogs = useMemo(
    () => notificationState.logs
      .filter((log) => log.sceneId === 'checkup.followup_reminder' || log.sceneId === 'checkup.abnormal_alert')
      .slice(0, 5),
    [notificationState.logs],
  );

  return (
    <SectionCard
      title="分析与提醒"
      description="基于前端本地规则判断异常、趋势和复查窗口，并统一通过通知中心记录提醒发送。"
    >
      <div className="page-stack">
        <div className="checkup-filter-grid">
          <Field
            label="分析用户 ID"
            value={settings.insightUserId}
            onChange={(event) => onSettingsChange({ insightUserId: event.target.value })}
            placeholder="留空查看全部用户"
            hint="分析卡片、复查列表和提醒扫描都以这里的用户维度为准。"
          />
          <Field
            label="提前提醒天数"
            type="number"
            min="1"
            value={String(settings.followUpLeadDays)}
            onChange={(event) => onSettingsChange({ followUpLeadDays: Math.max(1, Number(event.target.value) || 1) })}
            hint="进入这个时间窗口后，复查提醒会开始触发。"
          />
        </div>

        <div className="checkup-setting-grid">
          <SettingSwitchCard
            title="复查提醒"
            description="控制复查日期临近或逾期时，是否写入通知中心统一发送。"
            checked={settings.reminderEnabled}
            onChange={onReminderToggle}
            statusText={settings.reminderEnabled ? '已启用' : '已停用'}
            impact={`当前会扫描未来 ${settings.followUpLeadDays} 天内的复查计划，避免遗漏复查窗口。`}
          />
          <NotificationStatusCard
            sceneId="checkup.followup_reminder"
            title="复查提醒场景"
            summary="查看通知中心里已绑定的渠道数、场景状态和统一发送入口。"
          />
          <SettingSwitchCard
            title="异常指标提醒"
            description="控制保存或更新异常指标时，是否同步写入通知中心日志。"
            checked={settings.abnormalAlertEnabled}
            onChange={onAbnormalAlertToggle}
            statusText={settings.abnormalAlertEnabled ? '已启用' : '已停用'}
            impact="适合在录入或复查后即时感知异常结果，后续也能在通知中心里追踪历史发送。"
          />
          <NotificationStatusCard
            sceneId="checkup.abnormal_alert"
            title="异常指标场景"
            summary="所有异常相关通知都会通过通知中心统一选渠道，不在本页单独配置。"
          />
        </div>

        <div className="checkup-insight-grid">
          {insights.map((insight) => (
            <div className={`checkup-insight-card is-${insight.level}`} key={insight.id}>
              <div className="fitness-insight-head">
                <strong>{insight.title}</strong>
                <Tag
                  tone={
                    insight.level === 'success'
                      ? 'green'
                      : insight.level === 'info'
                        ? 'blue'
                        : insight.level === 'warning'
                          ? 'orange'
                          : 'red'
                  }
                >
                  {insight.level === 'success'
                    ? '平稳'
                    : insight.level === 'info'
                      ? '提示'
                      : insight.level === 'warning'
                        ? '关注'
                        : '高优先级'}
                </Tag>
              </div>
              <p>{insight.description}</p>
            </div>
          ))}
        </div>

        <div className="two-column-layout">
          <div className="chart-card">
            <div className="fitness-chart-header">
              <strong>待复查列表</strong>
              <span>显示临近或逾期的异常/关注指标。</span>
            </div>
            {dueFollowUps.length ? (
              <DataTable
                rowKey="id"
                data={dueFollowUps}
                columns={[
                  {
                    key: 'testName',
                    title: '项目',
                    dataIndex: 'testName',
                  },
                  {
                    key: 'userId',
                    title: '用户 ID',
                    dataIndex: 'userId',
                  },
                  {
                    key: 'followUpDate',
                    title: '复查日期',
                    dataIndex: 'followUpDate',
                  },
                  {
                    key: 'daysUntilDue',
                    title: '剩余天数',
                    render: (_value, row) => (
                      <Tag tone={row.daysUntilDue < 0 ? 'red' : row.daysUntilDue <= 3 ? 'orange' : 'blue'}>
                        {row.daysUntilDue < 0 ? `已逾期 ${Math.abs(row.daysUntilDue)} 天` : `还有 ${row.daysUntilDue} 天`}
                      </Tag>
                    ),
                  },
                  {
                    key: 'status',
                    title: '状态',
                    render: (_value, row) => (
                      <Tag tone={CHECKUP_STATUS_META[row.status].tone}>{CHECKUP_STATUS_META[row.status].label}</Tag>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState
                title="暂无待复查项目"
                description="当前筛选范围内没有进入提醒窗口的异常或关注指标。"
              />
            )}
          </div>

          <div className="chart-card">
            <div className="fitness-chart-header">
              <strong>最近触发日志</strong>
              <span>只展示体检场景相关的发送和测试记录。</span>
            </div>
            <NotificationLogTable logs={latestLogs} />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
