import { useEffect, useRef, useState } from 'react';

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
  const [recipient, setRecipient] = useState(config.recipient ?? '');
  const [senderName, setSenderName] = useState(config.senderName ?? '');
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl ?? '');
  const [secret, setSecret] = useState(config.secret ?? '');
  const [testing, setTesting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecipient(config.recipient ?? '');
    setSenderName(config.senderName ?? '');
    setWebhookUrl(config.webhookUrl ?? '');
    setSecret(config.secret ?? '');
  }, [config.recipient, config.senderName, config.webhookUrl, config.secret]);

  const scheduleUpdate = (patch: Partial<NotificationChannelConfig>) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      onUpdate(patch);
      timerRef.current = null;
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

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
            value={recipient}
            onChange={(event) => {
              setRecipient(event.target.value);
              scheduleUpdate({ recipient: event.target.value });
            }}
            placeholder="owner@lifeos.local"
          />
          <Field
            label="发送者名称"
            value={senderName}
            onChange={(event) => {
              setSenderName(event.target.value);
              scheduleUpdate({ senderName: event.target.value });
            }}
            placeholder="LifeOS"
          />
        </div>
      ) : config.type === 'telegram' ? (
        <div className="form-grid">
          <Field
            label="Bot Token"
            value={recipient}
            onChange={(event) => {
              setRecipient(event.target.value);
              scheduleUpdate({ recipient: event.target.value });
            }}
            placeholder="123456:ABC-DEF..."
          />
          <Field
            label="Chat ID"
            value={webhookUrl}
            onChange={(event) => {
              setWebhookUrl(event.target.value);
              scheduleUpdate({ webhookUrl: event.target.value });
            }}
            placeholder="用户或群组 ID"
          />
        </div>
      ) : (
        <div className="form-grid">
          <Field
            label="Webhook 地址"
            value={webhookUrl}
            onChange={(event) => {
              setWebhookUrl(event.target.value);
              scheduleUpdate({ webhookUrl: event.target.value });
            }}
            placeholder="https://example.com/hook"
          />
          <Field
            label="密钥 / 签名（可选）"
            value={secret}
            onChange={(event) => {
              setSecret(event.target.value);
              scheduleUpdate({ secret: event.target.value });
            }}
            placeholder="可选"
          />
        </div>
      )}
      <div className="inline-row">
        <span className="subtle-text">
          最近测试：{config.lastTestAt ? new Date(config.lastTestAt).toLocaleString() : '尚未测试'}
        </span>
        <Btn tone="secondary" disabled={testing} onClick={async () => {
          setTesting(true);
          try {
            await onTest(config.type);
          } finally {
            setTesting(false);
          }
        }}>
          {testing ? '发送中...' : '测试发送'}
        </Btn>
      </div>
    </div>
  );
}
