import { useEffect, useMemo, useState } from 'react';

import { NotificationChannelCard } from '../../components/NotificationChannelCard';
import { NotificationLogTable } from '../../components/NotificationLogTable';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Checkbox, PillTabs, Switch, Tag, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import {
  hydrateNotificationCenterState,
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
  const [loading, setLoading] = useState(true);
  const { toast, showToast } = useToastState();

  useEffect(() => {
    setLoading(true);
    void hydrateNotificationCenterState()
      .catch((error) => {
        showToast(buildApiErrorMessage(error, '通知中心加载失败。'), 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [showToast]);

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

  const toggleSceneChannel = async (sceneId: NotificationSceneId, channel: NotificationChannelType) => {
    const current = notificationState.scenes[sceneId];
    const nextChannels = current.channels.includes(channel)
      ? current.channels.filter((item) => item !== channel)
      : [...current.channels, channel];

    try {
      await updateSceneConfig(sceneId, { channels: nextChannels });
      showToast('场景渠道绑定已更新。');
    } catch (error) {
      showToast(buildApiErrorMessage(error, '场景渠道绑定更新失败。'), 'error');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="通知中心"
        subtitle="统一配置通知渠道、业务场景和发送日志。所有业务提醒都从这里出发，不再经过浏览器本地业务存储。"
        actions={<Tag tone="blue">{loading ? '同步中' : '后端已接入'}</Tag>}
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
            <SectionCard title="统一发送说明" description="当前已经切到后端通知中心，日志、模板、场景和渠道都以数据库为准。">
              <div className="bullet-list">
                <div className="bullet-item"><span className="bullet-dot" />所有测试发送和业务提醒都会写入统一日志。</div>
                <div className="bullet-item"><span className="bullet-dot" />业务页面只维护触发规则，不再各自保存通知状态。</div>
                <div className="bullet-item"><span className="bullet-dot" />默认场景、模板和渠道说明由 seed 提供，而不是前端写死。</div>
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
                void updateChannelConfig(channel.type, { enabled })
                  .then(() => {
                    showToast(`${channel.label} 已${enabled ? '启用' : '停用'}。`);
                  })
                  .catch((error) => {
                    showToast(buildApiErrorMessage(error, `${channel.label} 更新失败。`), 'error');
                  });
              }}
              onUpdate={(patch) => {
                void updateChannelConfig(channel.type, patch)
                  .then(() => {
                    showToast(`${channel.label} 配置已更新。`);
                  })
                  .catch((error) => {
                    showToast(buildApiErrorMessage(error, `${channel.label} 更新失败。`), 'error');
                  });
              }}
              onTest={(type) => {
                void sendTestNotification(type)
                  .then((result) => {
                    showToast(result.message, result.success ? 'success' : 'error');
                  })
                  .catch((error) => {
                    showToast(buildApiErrorMessage(error, '测试发送失败。'), 'error');
                  });
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
                    void updateSceneConfig(scene.id, { enabled })
                      .then(() => {
                        showToast(`${scene.label} 已${enabled ? '启用' : '停用'}。`);
                      })
                      .catch((error) => {
                        showToast(buildApiErrorMessage(error, `${scene.label} 更新失败。`), 'error');
                      });
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
                      onChange={() => {
                        void toggleSceneChannel(scene.id, channel.type);
                      }}
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
