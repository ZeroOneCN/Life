import { useNavigate } from 'react-router-dom';

import type { NotificationSceneId } from '../types/notifications';
import { getBoundChannelCount, useNotificationCenterState } from '../services/notificationCenter';
import { Btn, Tag } from './ui';

export function NotificationStatusCard({
  sceneId,
  title,
  summary,
}: {
  sceneId: NotificationSceneId;
  title: string;
  summary: string;
}) {
  const navigate = useNavigate();
  const notificationState = useNotificationCenterState();
  const scene = notificationState.scenes[sceneId];
  const boundChannels = getBoundChannelCount(sceneId);

  if (!scene) {
    return (
      <div className="card notification-status-card">
        <div className="notification-status-top">
          <div>
            <h3 className="card-title">{title}</h3>
            <p className="section-description">{summary}</p>
          </div>
          <Tag tone="orange">场景加载中</Tag>
        </div>
        <div className="callout callout-info">
          通知中心正在同步该场景的后端配置，稍后刷新即可恢复正常显示。
        </div>
        <Btn tone="ghost" onClick={() => navigate('/notifications?tab=scenes')}>
          前往通知中心查看
        </Btn>
      </div>
    );
  }

  return (
    <div className="card notification-status-card">
      <div className="notification-status-top">
        <div>
          <h3 className="card-title">{title}</h3>
          <p className="section-description">{summary}</p>
        </div>
        <Tag tone={scene.enabled ? 'green' : 'orange'}>
          {scene.enabled ? '场景已启用' : '场景已停用'}
        </Tag>
      </div>
      <div className="status-metadata">
        <span>已绑定就绪渠道 {boundChannels} 个</span>
        <span>{scene.channels.length ? scene.channels.join(' / ') : '尚未绑定渠道'}</span>
      </div>
      <div className="callout callout-info">
        所有此类提醒都由通知中心统一发送，当前页面只负责业务开关与触发条件。
      </div>
      <Btn tone="ghost" onClick={() => navigate('/notifications?tab=scenes')}>
        前往通知中心调整渠道
      </Btn>
    </div>
  );
}
