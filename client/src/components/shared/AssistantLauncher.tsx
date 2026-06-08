import { useEffect, useRef, useState } from 'react';

import { Btn, Tag } from '../../components/ui';
import { buildApiErrorMessage } from '../../lib/api';
import { assistantApi } from '../../services/assistantApi';
import {
  ASSISTANT_PROMPT_SUGGESTIONS,
  ASSISTANT_TOOL_LABELS,
  type AssistantChatMessage,
  type AssistantToolCallLog,
} from '../../services/assistant.types';

interface ChatBubble {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: AssistantToolCallLog[];
  pending?: boolean;
  error?: boolean;
}

const MAX_HISTORY = 20;

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

function renderInlineMarkdown(input: string) {
  return input
    .split('\n')
    .map((line) => {
      const safe = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const inline = safe
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      if (/^#\s+/.test(inline)) return `<h4>${inline.replace(/^#\s+/, '')}</h4>`;
      if (/^##\s+/.test(inline)) return `<h4>${inline.replace(/^##\s+/, '')}</h4>`;
      if (/^-\s+/.test(inline)) return `<li>${inline.replace(/^-\s+/, '')}</li>`;
      if (!inline.trim()) return '';
      return `<p>${inline}</p>`;
    })
    .join('\n');
}

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [open, messages.length]);

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || sending) {
      return;
    }

    const userBubble: ChatBubble = { id: buildId(), role: 'user', content: text };
    const pendingId = buildId();
    setMessages((current) => [
      ...current,
      userBubble,
      { id: pendingId, role: 'assistant', content: '正在调用工具并整理答案…', pending: true },
    ]);
    setInput('');
    setSending(true);

    const baseHistory: AssistantChatMessage[] = [...messages, userBubble]
      .slice(-MAX_HISTORY)
      .map<AssistantChatMessage>((item) => ({ role: item.role, content: item.content }));

    try {
      const response = await assistantApi.chat(baseHistory);
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
    setMessages([]);
    setInput('');
  };

  return (
    <div className="assistant-launcher">
      {open ? (
        <div className="assistant-panel" role="dialog" aria-label="AI 智能助理">
          <header className="assistant-panel-header">
            <div>
              <strong>AI 智能助理</strong>
              <span>调用你的真实数据，跨财务 / 健康 / 投资 / 生活四模块回答</span>
            </div>
            <div className="assistant-panel-actions">
              <button
                type="button"
                className="assistant-icon-button"
                aria-label="清空对话"
                onClick={handleReset}
                title="清空对话"
              >
                ↺
              </button>
              <button
                type="button"
                className="assistant-icon-button"
                aria-label="关闭助理"
                onClick={() => setOpen(false)}
                title="关闭"
              >
                ×
              </button>
            </div>
          </header>

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
                    <div
                      className="assistant-message-body"
                      dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(bubble.content) }}
                    />
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
      ) : null}

      <button
        type="button"
        className={`assistant-fab ${open ? 'is-open' : ''}`}
        aria-label={open ? '关闭 AI 助理' : '打开 AI 助理'}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{open ? '×' : '🤖'}</span>
        <span className="assistant-fab-tooltip">{open ? '关闭' : 'AI 助理'}</span>
      </button>
    </div>
  );
}
