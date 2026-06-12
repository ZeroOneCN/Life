import { useEffect, useRef, useState } from 'react';

import { SectionCard } from '../../components/page';
import { Btn, Tag, Toast, useToastState } from '../../components/ui';
import { generateTelegramBindCode, getTelegramBindingStatus, type TelegramBindingStatus } from '../../services/telegramApi';

/** 绑定码有效时间（秒） */
const CODE_TTL_SECONDS = 10 * 60;

/**
 * Telegram 快速录入绑定组件
 * 提供绑定码生成、显示、倒计时和绑定状态查询功能
 */
export default function TelegramBindWidget() {
  const { toast, showToast } = useToastState();
  // 初始状态默认为未绑定，确保 UI 立即可见
  const [status, setStatus] = useState<TelegramBindingStatus>({ bound: false });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [bindCode, setBindCode] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 查询绑定状态
  const fetchStatus = async () => {
    setLoading(true);
    setInitError(null);
    try {
      const result = await getTelegramBindingStatus();
      setStatus(result);
    } catch (error) {
      setStatus({ bound: false });
      const msg = error instanceof Error ? error.message : String(error);
      setInitError(msg);
      showToast('查询绑定状态失败：' + msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载状态
  useEffect(() => {
    fetchStatus();
  }, []);

  // 倒计时逻辑
  useEffect(() => {
    if (remainingSeconds <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setBindCode(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingSeconds]);

  // 生成绑定码
  const handleGenerateCode = async () => {
    setGenerating(true);
    try {
      const result = await generateTelegramBindCode();
      setBindCode(result.code);
      setRemainingSeconds(CODE_TTL_SECONDS);
      showToast('绑定码已生成，请在 Telegram 中发送 /bind ' + result.code);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showToast('生成绑定码失败：' + msg, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // 复制绑定码到剪贴板
  const handleCopyCode = async () => {
    if (!bindCode) return;
    try {
      await navigator.clipboard.writeText(`/bind ${bindCode}`);
      showToast('已复制：/bind ' + bindCode);
    } catch {
      showToast('复制失败，请手动复制');
    }
  };

  // 格式化剩余时间
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <SectionCard
      title="🤖 Telegram 快速录入"
      description="通过 Telegram Bot 快速录入步数、体重、饮食、运动等数据，无需打开浏览器。"
    >
      <Toast toast={toast} />

      {/* 错误提示 */}
      {initError ? (
        <div style={{ color: 'var(--color-red-500, #e53935)', fontSize: 13, marginBottom: 12 }}>
          连接失败：{initError}
        </div>
      ) : null}

      {/* 绑定状态 */}
      <div className="tg-bind-status">
        {status.bound ? (
          <div className="tg-bind-bound">
            <Tag tone="green">已绑定</Tag>
            {status.telegramUsername ? (
              <span className="tg-bind-username">@{status.telegramUsername}</span>
            ) : null}
            <Btn tone="ghost" onClick={fetchStatus} disabled={loading}>
              刷新状态
            </Btn>
          </div>
        ) : (
          <div className="tg-bind-unbound">
            <Tag tone="orange">未绑定</Tag>
            <Btn tone="ghost" onClick={fetchStatus} disabled={loading}>
              刷新状态
            </Btn>
          </div>
        )}
      </div>

      {/* 绑定操作区（未绑定时显示） */}
      {!status.bound && (
        <div className="tg-bind-actions">
          {!bindCode ? (
            <Btn tone="primary" onClick={handleGenerateCode} disabled={generating}>
              {generating ? '生成中...' : '生成绑定码'}
            </Btn>
          ) : (
            <div className="tg-bind-code-panel">
              <div className="tg-bind-code-display">
                <code className="tg-bind-code">{bindCode}</code>
                <span className="tg-bind-countdown">{formatTime(remainingSeconds)}</span>
              </div>
              <div className="tg-bind-code-actions">
                <Btn tone="ghost" onClick={handleCopyCode}>复制命令</Btn>
                <Btn tone="primary" onClick={handleGenerateCode} disabled={generating}>
                  重新生成
                </Btn>
              </div>
              <p className="tg-bind-hint">
                在 Telegram 中搜索你的 Bot，发送：<br />
                <strong>/bind {bindCode}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* 使用提示 */}
      <div className="tg-bind-guide">
        <h4>使用步骤</h4>
        <ol>
          <li>点击上方「生成绑定码」按钮</li>
          <li>在 Telegram 中给 Bot 发送 <code>/bind {'{绑定码}'}</code></li>
          <li>绑定成功后即可用快捷指令录入数据</li>
        </ol>
      </div>
    </SectionCard>
  );
}
