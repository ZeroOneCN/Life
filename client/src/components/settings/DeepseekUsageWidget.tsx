import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';

import { Btn, Skeleton, Tag, Toast, useToastState } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import {
  fetchDeepseekUsage,
  type DeepseekBalanceInfo,
  type DeepseekUsageSnapshot,
} from '../../services/deepseekUsageApi';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function formatAmount(value: number, currency: string) {
  const fixed = value.toFixed(2);
  if (currency === 'CNY' || currency === 'RMB' || currency === '人民币') {
    return `¥${fixed}`;
  }
  if (currency === 'USD') {
    return `$${fixed}`;
  }
  return `${fixed} ${currency}`;
}

function formatTimestamp(iso: string) {
  return dayjs(iso).format('YYYY-MM-DD HH:mm:ss');
}

function pickPrimaryBalance(balances: DeepseekBalanceInfo[]): DeepseekBalanceInfo | null {
  if (balances.length === 0) {
    return null;
  }
  const priority = ['CNY', 'RMB', '人民币', 'USD'];
  for (const code of priority) {
    const found = balances.find((item) => item.currency === code);
    if (found) {
      return found;
    }
  }
  return balances[0];
}

export function DeepseekUsageWidget() {
  const { toast, showToast } = useToastState();
  const [snapshot, setSnapshot] = useState<DeepseekUsageSnapshot | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const load = useCallback(async () => {
    setLoadState('loading');
    setErrorMessage('');
    try {
      const data = await fetchDeepseekUsage();
      setSnapshot(data);
      setLoadState('ready');
    } catch (error) {
      setErrorMessage(buildApiErrorMessage(error, 'DeepSeek 余额查询失败。'));
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    await load();
    showToast('DeepSeek 余额已刷新。', 'success');
  }, [load, showToast]);

  const renderBody = () => {
    if (loadState === 'loading' && !snapshot) {
      return (
        <div className="deepseek-usage-body">
          <Skeleton lines={3} />
        </div>
      );
    }

    if (loadState === 'error') {
      return (
        <div className="deepseek-usage-body">
          <div className="deepseek-usage-error">
            <strong>查询失败</strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      );
    }

    if (!snapshot) {
      return null;
    }

    if (!snapshot.enabled) {
      return (
        <div className="deepseek-usage-body">
          <div className="deepseek-usage-empty">
            <Tag tone="orange">未启用</Tag>
            <strong>服务端尚未配置 DEEPSEEK_API_KEY</strong>
            <span>{snapshot.reason}。配置完成后重启服务，AI 助理与本组件即可正常工作。</span>
          </div>
        </div>
      );
    }

    if (!snapshot.ok) {
      return (
        <div className="deepseek-usage-body">
          <div className="deepseek-usage-empty">
            <Tag tone="red">接口异常</Tag>
            <strong>DeepSeek 余额接口返回错误</strong>
            <span>{snapshot.reason}</span>
          </div>
        </div>
      );
    }

    if (!snapshot.isAvailable) {
      return (
        <div className="deepseek-usage-body">
          <div className="deepseek-usage-empty">
            <Tag tone="red">账户欠费</Tag>
            <strong>DeepSeek 账户当前不可用</strong>
            <span>请前往 DeepSeek 平台充值或检查账户状态。</span>
          </div>
        </div>
      );
    }

    const primary = pickPrimaryBalance(snapshot.balances);

    if (!primary) {
      return (
        <div className="deepseek-usage-body">
          <div className="deepseek-usage-empty">
            <Tag tone="default">无余额</Tag>
            <strong>DeepSeek 接口未返回余额数据</strong>
            <span>刷新时间：{formatTimestamp(snapshot.fetchedAt)}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="deepseek-usage-body">
        <div className="deepseek-usage-headline">
          <div className="deepseek-usage-headline-label">账户余额</div>
          <div className="deepseek-usage-headline-value">
            {formatAmount(primary.totalBalance, primary.currency)}
          </div>
          <div className="deepseek-usage-headline-meta">
            币种：{primary.currency} · 刷新于 {formatTimestamp(snapshot.fetchedAt)}
          </div>
        </div>

        <div className="deepseek-usage-grid">
          <div className="deepseek-usage-cell">
            <span className="deepseek-usage-cell-label">赠送余额</span>
            <strong className="deepseek-usage-cell-value">
              {primary.grantedBalance !== null
                ? formatAmount(primary.grantedBalance, primary.currency)
                : '-'}
            </strong>
            <span className="deepseek-usage-cell-helper">平台赠送，可用于 AI 助理</span>
          </div>
          <div className="deepseek-usage-cell">
            <span className="deepseek-usage-cell-label">充值余额</span>
            <strong className="deepseek-usage-cell-value">
              {primary.toppedUpBalance !== null
                ? formatAmount(primary.toppedUpBalance, primary.currency)
                : '-'}
            </strong>
            <span className="deepseek-usage-cell-helper">自助充值到账部分</span>
          </div>
          <div className="deepseek-usage-cell">
            <span className="deepseek-usage-cell-label">币种</span>
            <strong className="deepseek-usage-cell-value">{primary.currency}</strong>
            <span className="deepseek-usage-cell-helper">DeepSeek 账户基础币种</span>
          </div>
        </div>

        {snapshot.balances.length > 1 ? (
          <div className="deepseek-usage-extra">
            <span>其他币种余额：</span>
            {snapshot.balances
              .filter((item) => item.currency !== primary.currency)
              .map((item) => (
                <Tag key={item.currency} tone="default">
                  {item.currency} · {formatAmount(item.totalBalance, item.currency)}
                </Tag>
              ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="card section-card deepseek-usage-card">
      <div className="section-card-header">
        <div>
          <h2 className="section-title">DeepSeek Token 消耗</h2>
          <p className="section-description">
            实时拉取 DeepSeek 官方账户余额，用于预估 AI 助理的 Token 消耗与可用配额。
          </p>
        </div>
        <Btn
          tone="secondary"
          onClick={() => {
            void handleRefresh();
          }}
          disabled={loadState === 'loading'}
        >
          {loadState === 'loading' ? '刷新中...' : '刷新'}
        </Btn>
      </div>
      {renderBody()}
      <Toast toast={toast} />
    </div>
  );
}
