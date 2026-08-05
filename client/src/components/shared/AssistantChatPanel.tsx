import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Btn, Modal, Tag } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { assistantApi } from '../../services/assistantApi';
import {
  ASSISTANT_PROMPT_SUGGESTIONS,
  ASSISTANT_TOOL_LABELS,
  type AssistantChatMessage,
  type AssistantToolCallLog,
} from '../../services/assistant.types';

/**
 * 安全链接渲染：仅允许 http(s)/mailto/相对路径，强制新窗口打开并加 noopener。
 * @param props - 标准 <a> 元素属性。
 */
function SafeLink(props: ComponentPropsWithoutRef<'a'>) {
  const { href, children, ...rest } = props;
  const safeHref = href && /^(https?:|mailto:|\/)/i.test(href) ? href : undefined;
  return (
    <a
      href={safeHref ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  );
}

/**
 * 聊天气泡
 */
interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: AssistantToolCallLog[];
  pending?: boolean;
  error?: boolean;
  createdAt: number;
}

const MAX_HISTORY = 50;
const MAX_PERSISTED = 100;
const STORAGE_KEY = 'lifeos-assistant-history-v1';

/**
 * 生成唯一 ID
 * @returns 随机 ID 字符串
 */
function buildId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

/**
 * 从 localStorage 加载历史对话
 * @returns ChatBubble 数组
 */
function loadHistory(): ChatBubble[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ChatBubble => (
        Boolean(item)
        && typeof item === 'object'
        && typeof (item as ChatBubble).id === 'string'
        && typeof (item as ChatBubble).content === 'string'
        && ((item as ChatBubble).role === 'user' || (item as ChatBubble).role === 'assistant')
      ))
      .slice(-MAX_PERSISTED);
  } catch {
    return [];
  }
}

/**
 * 持久化历史对话到 localStorage
 * @param messages - 对话数组
 */
function saveHistory(messages: ChatBubble[]): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = messages.slice(-MAX_PERSISTED);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // 静默失败：localStorage 写满 / 隐私模式
  }
}

/**
 * AssistantChatPanel：AI 助理聊天面板（可复用核心）
 *
 * 从原 AssistantLauncher 抽取的纯聊天逻辑，不含 FAB / 定位 / 拖拽。
 * 由 Inspector（AI 模式）与移动端 Bottom Sheet 复用。
 *
 * @param props.context - 上下文描述（C3：当前页面/选中项摘要，注入到系统提示）
 * @returns 聊天面板 JSX
 */
export function AssistantChatPanel({ context }: { context?: string }) {
  const [messages, setMessages] = useState<ChatBubble[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const todayLabel = useMemo(() => dayjs().format('YYYY-MM-DD HH:mm'), []);

  // 新消息自动滚动到底部
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages.length]);

  // 持久化历史
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  /**
   * 发送消息（含上下文注入：C3）
   * @param rawText - 用户输入
   */
  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || sending) return;

    const userBubble: ChatBubble = {
      id: buildId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };
    const pendingId = buildId();
    setMessages((current) => [
      ...current,
      userBubble,
      { id: pendingId, role: 'assistant', content: '正在调用工具并整理答案…', pending: true, createdAt: Date.now() },
    ]);
    setInput('');
    setSending(true);

    // C3 上下文注入：以 system 前缀消息追加当前页面上下文，帮助 AI 聚焦
    const baseHistory: AssistantChatMessage[] = [...messages, userBubble]
      .slice(-MAX_HISTORY)
      .map<AssistantChatMessage>((item) => ({ role: item.role, content: item.content }));

    const injectedHistory: AssistantChatMessage[] = context
      ? [{ role: 'system', content: context }, ...baseHistory]
      : baseHistory;

    try {
      const response = await assistantApi.chat(injectedHistory);
      setMessages((current) => current.map((item) => (
        item.id === pendingId
          ? { ...item, content: response.content, toolCalls: response.toolCalls, pending: false }
          : item
      )));
    } catch (error) {
      setMessages((current) => current.map((item) => (
        item.id === pendingId
          ? { ...item, content: buildApiErrorMessage(error, '调用 AI 助理失败。'), pending: false, error: true }
          : item
      )));
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleReset = () => {
    if (messages.length === 0) return;
    setResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    setMessages([]);
    setInput('');
    setResetConfirmOpen(false);
  };

  return (
    <>
      <div className="assistant-chat-panel">
        <div className="assistant-panel-body" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="assistant-empty">
              <strong>想了解点什么？</strong>
              <span>试试下面这些常用问题，或者直接输入你的需求。</span>
              <div className="assistant-suggestions">
                {ASSISTANT_PROMPT_SUGGESTIONS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="assistant-suggestion"
                    onClick={() => void sendMessage(item.prompt)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="assistant-message-list">
              {messages.map((bubble) => (
                <li
                  key={bubble.id}
                  className={`assistant-message ${bubble.role} ${bubble.error ? 'is-error' : ''}`.trim()}
                >
                  <div className="assistant-message-meta">
                    <span>{bubble.role === 'user' ? '我' : 'AI 助理'}</span>
                    {bubble.pending ? <Tag tone="blue">思考中</Tag> : null}
                  </div>
                  <div className="assistant-message-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{ a: SafeLink }}
                    >
                      {bubble.content}
                    </ReactMarkdown>
                  </div>
                  {bubble.toolCalls && bubble.toolCalls.length ? (
                    <div className="assistant-tool-list">
                      {bubble.toolCalls.map((call, index) => {
                        const toolKey = (Object.keys(ASSISTANT_TOOL_LABELS) as Array<keyof typeof ASSISTANT_TOOL_LABELS>).find(
                          (key) => key === call.tool,
                        );
                        const label = toolKey ? ASSISTANT_TOOL_LABELS[toolKey] : call.tool;
                        return (
                          <Tag key={`${call.tool}-${index}`} tone="green">
                            调用工具：{label}
                          </Tag>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <form className="assistant-panel-input" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="例如：帮我看下本月购物和旅行的支出对比"
            rows={2}
            disabled={sending}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage(input);
              }
            }}
          />
          <Btn tone="primary" type="submit" disabled={sending || !input.trim()}>
            {sending ? '发送中…' : '发送'}
          </Btn>
        </form>
      </div>

      <Modal
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        title="清空对话历史"
        width={420}
        footer={(
          <>
            <Btn tone="secondary" onClick={() => setResetConfirmOpen(false)}>取消</Btn>
            <Btn tone="danger-fill" onClick={handleConfirmReset}>清空对话</Btn>
          </>
        )}
      >
        <div className="assistant-reset-confirm">
          <p className="subtle-text">
            当前共有 <span className="assistant-reset-count">{messages.length}</span> 条对话历史，清空后不可恢复。
          </p>
          <div className="assistant-reset-tip">
            <span aria-hidden="true">💡</span>
            <span>
              清空后下次对话可以从零开始，本地存储的对话记录会立即移除；如需保留建议先导出重要内容。
            </span>
          </div>
        </div>
      </Modal>
    </>
  );
}
