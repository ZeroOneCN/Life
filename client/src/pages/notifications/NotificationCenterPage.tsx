import { useEffect, useMemo, useRef, useState } from 'react';

import { NotificationChannelCard } from '../../components/NotificationChannelCard';
import { NotificationLogTable } from '../../components/NotificationLogTable';
import { PageHeader, SectionCard, StatGrid } from '../../components/page';
import { Btn, Checkbox, DeleteModal, PillTabs, Switch, Tag, Toast, useToastState } from '../../components/ui';
import { usePageTab } from '../../hooks/usePageTab';
import { buildApiErrorMessage } from '../../lib/api';
import {
  hydrateNotificationCenterState,
  sendTestNotification,
  updateChannelConfig,
  updateSceneConfig,
  useNotificationCenterState,
  clearNotificationLogs,
  getNotificationLogs,
} from '../../services/notificationCenter';
import type { NotificationChannelType, NotificationSceneId, NotificationLogEntry } from '../../types/notifications';

const tabOptions = [
  { value: 'overview', label: '总览' },
  { value: 'channels', label: '渠道配置' },
  { value: 'scenes', label: '场景绑定' },
  { value: 'logs', label: '通知日志' },
] as const;

const channelLabels: Record<NotificationChannelType, string> = {
  email: '邮件',
  wechatWork: '企业微信',
  dingTalk: '钉钉',
  feishu: '飞书',
  telegram: 'Telegram',
  webhook: 'Webhook',
};

export default function NotificationCenterPage() {
  const notificationState = useNotificationCenterState();
  const [tab, setTab] = usePageTab('overview', tabOptions.map((item) => item.value));
  const [loading, setLoading] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [paginatedLogs, setPaginatedLogs] = useState<NotificationLogEntry[]>([]);
  const { toast, showToast } = useToastState();
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    setLoading(true);
    void hydrateNotificationCenterState()
      .catch((error) => {
        showToastRef.current(buildApiErrorMessage(error, '通知中心加载失败。'), 'error');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (tab !== 'logs') return;

    let cancelled = false;
    void getNotificationLogs({ page: logPage, pageSize: 10 })
      .then((result) => {
        if (!cancelled) {
          setPaginatedLogs(result.items);
          setLogTotalPages(Math.max(1, result.totalPages));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          showToastRef.current(buildApiErrorMessage(error, '日志加载失败。'), 'error');
        }
      });

    return () => { cancelled = true; };
  }, [tab, logPage]);

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
          <div className="quick-actions-row">
            <Btn tone="secondary" onClick={() => {
              setLoading(true);
              void hydrateNotificationCenterState()
                .catch((error) => {
                  showToastRef.current(buildApiErrorMessage(error, '刷新数据失败。'), 'error');
                })
                .finally(() => {
                  setLoading(false);
                });
            }}>刷新数据</Btn>
            <Btn tone="secondary" onClick={async () => {
              try {
                const result = await sendTestNotification('email');
                showToast(result.message, result.success ? 'success' : 'error');
              } catch (error) {
                showToast(buildApiErrorMessage(error, '测试发送失败。'), 'error');
              }
            }}>测试发送</Btn>
          </div>
          <div className="page-stack">
              <SectionCard title="统一发送说明" description="当前已经切到后端通知中心，日志、模板、场景和渠道都以数据库为准。">
              <div className="bullet-list">
                <div className="bullet-item"><span className="bullet-dot" />所有测试发送和业务提醒都会写入统一日志。</div>
                <div className="bullet-item"><span className="bullet-dot" />业务页面只维护触发规则，不再各自保存通知状态。</div>
                <div className="bullet-item"><span className="bullet-dot" />默认场景、模板和渠道说明由 seed 提供，而不是前端写死。</div>
              </div>
            </SectionCard>
            <SectionCard title="最近发送记录" description="便于快速确认通知中心是否正常工作。">
              <NotificationLogTable logs={latestLogs} page={1} totalPages={1} onPageChange={() => {}} />
            </SectionCard>
          </div>
        </>
      ) : null}

      {tab === 'channels' ? (
        <div className="channel-config-grid">
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
              onTest={async (type) => {
                try {
                  const result = await sendTestNotification(type);
                  showToast(result.message, result.success ? 'success' : 'error');
                } catch (error) {
                  showToast(buildApiErrorMessage(error, '测试发送失败。'), 'error');
                }
              }}
            />
          ))}
        </div>
      ) : null}

      {tab === 'scenes' ? (
        <div className="scene-grid">
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
        <SectionCard
          title="通知日志"
          description="查看所有测试发送和业务场景发送记录。"
          action={notificationState.logs.length > 0 ? (
            <Btn tone="danger" onClick={() => {
              setLogPage(1);
              setShowClearModal(true);
            }}>
              清空日志
            </Btn>
          ) : undefined}
        >
          <NotificationLogTable
            logs={paginatedLogs}
            page={logPage}
            totalPages={logTotalPages}
            onPageChange={(next) => setLogPage(next)}
          />
        </SectionCard>
      ) : null}

      <DeleteModal
        open={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={() => {
          void clearNotificationLogs()
            .then(() => {
              showToast('通知日志已清空。');
            })
            .catch((error) => {
              showToast(buildApiErrorMessage(error, '清空日志失败。'), 'error');
            })
            .finally(() => {
              setShowClearModal(false);
            });
        }}
        title="清空通知日志"
      >
        确定要清空所有通知日志吗？此操作不可撤销。
      </DeleteModal>

      <Toast toast={toast} />
    </div>
  );
}
