import type { NotificationChannelConfig, NotificationChannelType } from '../types/notifications';
import { Btn, Field, Switch } from './ui';

export function NotificationChannelCard({
  config,
  onToggle,
  onUpdate,
  onTest,
}: {
  config: NotificationChannelConfig;
  onToggle: (enabled: boolean) => void;
  onUpdate: (patch: Partial<NotificationChannelConfig>) => void;
  onTest: (channel: NotificationChannelType) => void;
}) {
  return (
    <div className="card channel-card">
      <Switch
        checked={config.enabled}
        onChange={onToggle}
        label={config.label}
        description={config.notes ?? '配置收敛在通知中心，便于统一追踪。'}
        statusText={config.status === 'ready' ? '已就绪' : config.status === 'disabled' ? '已停用' : '待完善'}
      />
      {config.type === 'email' ? (
        <div className="form-grid">
          <Field
            label="收件人"
            value={config.recipient ?? ''}
            onChange={(event) => onUpdate({ recipient: event.target.value })}
            placeholder="owner@lifeos.local"
          />
          <Field
            label="发送者名称"
            value={config.senderName ?? ''}
            onChange={(event) => onUpdate({ senderName: event.target.value })}
            placeholder="LifeOS"
          />
        </div>
      ) : (
        <div className="form-grid">
          <Field
            label="Webhook 地址"
            value={config.webhookUrl ?? ''}
            onChange={(event) => onUpdate({ webhookUrl: event.target.value })}
            placeholder="https://example.com/hook"
          />
          <Field
            label="密钥 / 签名"
            value={config.secret ?? ''}
            onChange={(event) => onUpdate({ secret: event.target.value })}
            placeholder="可选"
          />
        </div>
      )}
      <div className="inline-row">
        <span className="subtle-text">
          最近测试：{config.lastTestAt ? new Date(config.lastTestAt).toLocaleString() : '尚未测试'}
        </span>
        <Btn tone="secondary" onClick={() => onTest(config.type)}>
          测试发送
        </Btn>
      </div>
    </div>
  );
}
