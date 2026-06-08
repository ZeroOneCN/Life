import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';

import { Btn, Skeleton, Tag, Toast, useToastState } from '../ui';
import { buildApiErrorMessage } from '../../lib/api';
import {
  fetchDeepseekUsage,
  type DeepseekBalanceInfo,
  type DeepseekLocalUsage,
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

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '尚未调用';
  const target = dayjs(iso);
  const diffMinutes = dayjs().diff(target, 'minute');
  if (diffMinutes < 1) return '刚刚';
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = dayjs().diff(target, 'hour');
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = dayjs().diff(target, 'day');
  if (diffDays < 30) return `${diffDays} 天前`;
  return target.format('YYYY-MM-DD HH:mm');
}

function formatTokenCount(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(2)} 万`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}k`;
  }
  return value.toString();
}

function formatCost(value: number): string {
  if (value >= 1) {
    return `¥${value.toFixed(2)}`;
  }
  if (value >= 0.01) {
    return `¥${value.toFixed(4)}`;
  }
  return `¥${value.toFixed(6)}`;
}

function renderLocalUsage(local: DeepseekLocalUsage) {
  if (local.totalCalls === 0) {
    return (
      <div className="deepseek-usage-empty">
        <Tag tone="default">暂无记录</Tag>
        <strong>本站 AI 助理还未发起过请求</strong>
        <span>在右下角 AI 助理里开始一次对话，组件就会自动汇总累计 / 今日的 Token 消耗。</span>
      </div>
    );
  }

  return (
    <div className="deepseek-usage-grid deepseek-usage-local-grid">
      <div className="deepseek-usage-cell">
        <span className="deepseek-usage-cell-label">累计请求</span>
        <strong className="deepseek-usage-cell-value">{local.totalCalls} 次</strong>
        <span className="deepseek-usage-cell-helper">
          共发出 {local.totalRequests} 次 DeepSeek HTTP 调用（含多轮工具调用）
        </span>
      </div>
      <div className="deepseek-usage-cell">
        <span className="deepseek-usage-cell-label">累计 Token</span>
        <strong className="deepseek-usage-cell-value">{formatTokenCount(local.totalTokens)}</strong>
        <span className="deepseek-usage-cell-helper">
          输入 {formatTokenCount(local.totalPromptTokens)} · 输出 {formatTokenCount(local.totalCompletionTokens)}
        </span>
      </div>
      <div className="deepseek-usage-cell">
        <span className="deepseek-usage-cell-label">今日 Token</span>
        <strong className="deepseek-usage-cell-value">{formatTokenCount(local.todayTokens)}</strong>
        <span className="deepseek-usage-cell-helper">
          今日 {local.todayCalls} 次对话
        </span>
      </div>
      <div className="deepseek-usage-cell">
        <span className="deepseek-usage-cell-label">估算花费</span>
        <strong className="deepseek-usage-cell-value">{formatCost(local.estimatedCost)}</strong>
        <span className="deepseek-usage-cell-helper">
          按 0.001 元 / 1k tokens 粗算
        </span>
      </div>
      <div className="deepseek-usage-cell deepseek-usage-cell-wide">
        <span className="deepseek-usage-cell-label">最后调用</span>
        <strong className="deepseek-usage-cell-value">{formatRelativeTime(local.lastCalledAt)}</strong>
        <span className="deepseek-usage-cell-helper">
          数据来自本站 assistant-usage-logs 表，按用户隔离累计
        </span>
      </div>
    </div>
  );
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
        <div className="deepseek-usage-section">
          <div className="deepseek-usage-section-head">
            <h4>官方账户余额</h4>
            <span>来自 DeepSeek /user/balance</span>
          </div>
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

        <div className="deepseek-usage-section">
          <div className="deepseek-usage-section-head">
            <h4>本站 AI 助理请求</h4>
            <span>按当前登录用户从 /assistant/chat 累计</span>
          </div>
          {renderLocalUsage(snapshot.local)}
        </div>
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
