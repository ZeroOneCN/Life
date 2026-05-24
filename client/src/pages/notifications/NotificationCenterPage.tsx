import { useMemo } from 'react';

import { NotificationChannelCard } from '../../components/NotificationChannelCard';
import { NotificationLogTable } from '../../components/NotificationLogTable';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Checkbox, PillTabs, Switch, Tag, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import {
  sendTestNotification,
  updateChannelConfig,
  updateSceneConfig,
  useNotificationCenterState,
} from '../../services/notificationCenter';
import type { NotificationChannelType, NotificationSceneId } from '../../types/notifications';

const tabOptions = [
  { value: 'overview', label: '总览' },
  { value: 'channels', label: '渠道配置' },
  { value: 'scenes', label: '场景绑定' },
  { value: 'logs', label: '通知日志' },
] as const;

const channelLabels: Record<NotificationChannelType, string> = {
  email: '邮件',
  wechatWork: '企业微信',
  webhook: 'Webhook',
};

export default function NotificationCenterPage() {
  const notificationState = useNotificationCenterState();
  const [tab, setTab] = usePageTab('overview', tabOptions.map((item) => item.value));
  const { toast, showToast } = useToastState();

  const metrics = useMemo(() => {
    const channels = Object.values(notificationState.channels);
    const scenes = Object.values(notificationState.scenes);

    return {
      enabledChannels: channels.filter((item) => item.enabled).length,
      enabledScenes: scenes.filter((item) => item.enabled).length,
      readyChannels: channels.filter((item) => item.status === 'ready').length,
      exceptionCount: channels.filter((item) => item.enabled && item.status !== 'ready').length,
    };
  }, [notificationState.channels, notificationState.scenes]);

  const sceneList = Object.values(notificationState.scenes);
  const latestLogs = notificationState.logs.slice(0, 5);

  const toggleSceneChannel = (sceneId: NotificationSceneId, channel: NotificationChannelType) => {
    const current = notificationState.scenes[sceneId];
    const nextChannels = current.channels.includes(channel)
      ? current.channels.filter((item) => item !== channel)
      : [...current.channels, channel];

    updateSceneConfig(sceneId, { channels: nextChannels });
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="通知中心"
        subtitle="统一配置通知渠道、业务场景和测试日志，所有提醒都从这里发出。"
        actions={<Tag tone="blue">一级菜单</Tag>}
      />

      <PillTabs
        options={tabOptions.map((item) => ({ value: item.value, label: item.label }))}
        value={tab}
        onChange={(value) => setTab(value as (typeof tabOptions)[number]['value'])}
      />

      {tab === 'overview' ? (
        <>
          <StatGrid
            items={[
              { label: '启用渠道数', value: `${metrics.enabledChannels}` },
              { label: '就绪渠道数', value: `${metrics.readyChannels}` },
              { label: '启用场景数', value: `${metrics.enabledScenes}` },
              { label: '异常状态数', value: `${metrics.exceptionCount}` },
            ]}
          />
          <div className="two-column-layout">
            <SectionCard title="统一发送说明" description="前端 v1 采用 mock adapter，本轮不接后端。">
              <div className="bullet-list">
                <div className="bullet-item"><span className="bullet-dot" />所有测试发送和业务提醒都会写入统一日志。</div>
                <div className="bullet-item"><span className="bullet-dot" />渠道启用状态、场景绑定和日志都持久化在本地存储。</div>
                <div className="bullet-item"><span className="bullet-dot" />业务页只负责开关、规则和触发条件，不再各自维护发送逻辑。</div>
              </div>
            </SectionCard>
            <SectionCard title="最近发送记录" description="便于快速确认通知中心是否正常工作。">
              <NotificationLogTable logs={latestLogs} />
            </SectionCard>
          </div>
        </>
      ) : null}

      {tab === 'channels' ? (
        <div className="page-stack">
          {Object.values(notificationState.channels).map((channel) => (
            <NotificationChannelCard
              key={channel.type}
              config={channel}
              onToggle={(enabled) => {
                updateChannelConfig(channel.type, { enabled });
                showToast(`${channel.label} 已${enabled ? '启用' : '停用'}。`);
              }}
              onUpdate={(patch) => updateChannelConfig(channel.type, patch)}
              onTest={(type) => {
                const result = sendTestNotification(type);
                showToast(result.message, result.success ? 'success' : 'error');
              }}
            />
          ))}
        </div>
      ) : null}

      {tab === 'scenes' ? (
        <div className="page-stack">
          {sceneList.map((scene) => (
            <SectionCard key={scene.id} title={scene.label} description={scene.description}>
              <div className="page-stack">
                <Switch
                  checked={scene.enabled}
                  onChange={(enabled) => {
                    updateSceneConfig(scene.id, { enabled });
                    showToast(`${scene.label} 已${enabled ? '启用' : '停用'}。`);
                  }}
                  label="场景开关"
                  description={scene.summary}
                  statusText={scene.enabled ? '已启用' : '已停用'}
                />
                <div className="channel-checkbox-group">
                  {Object.values(notificationState.channels).map((channel) => (
                    <Checkbox
                      key={`${scene.id}-${channel.type}`}
                      checked={scene.channels.includes(channel.type)}
                      onChange={() => toggleSceneChannel(scene.id, channel.type)}
                    >
                      {channelLabels[channel.type]}
                    </Checkbox>
                  ))}
                </div>
              </div>
            </SectionCard>
          ))}
        </div>
      ) : null}

      {tab === 'logs' ? (
        <SectionCard title="通知日志" description="查看所有测试发送和业务场景发送记录。">
          <NotificationLogTable logs={notificationState.logs} />
        </SectionCard>
      ) : null}

      <Toast toast={toast} />
    </div>
  );
}
