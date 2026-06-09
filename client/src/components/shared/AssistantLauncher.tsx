import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';

import { Btn, Modal, Tag } from '../../components/ui';
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
  createdAt: number;
}

const MAX_HISTORY = 20;
const MAX_PERSISTED = 40;
const STORAGE_KEY = 'lifeos-assistant-history-v1';
const POSITION_STORAGE_KEY = 'lifeos-assistant-position-v1';

const DEFAULT_POSITION = { right: 24, bottom: 24 };
const FAB_SIZE = 56;
const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 600;
const PANEL_GAP = 12;

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

interface AssistantPosition {
  right: number;
  bottom: number;
}

function loadPosition(): AssistantPosition {
  if (typeof window === 'undefined') {
    return DEFAULT_POSITION;
  }
  try {
    const raw = window.localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_POSITION;
    }
    const parsed = JSON.parse(raw) as Partial<AssistantPosition>;
    if (typeof parsed.right === 'number' && typeof parsed.bottom === 'number') {
      return { right: parsed.right, bottom: parsed.bottom };
    }
  } catch (error) {
    // 静默失败
  }
  return DEFAULT_POSITION;
}

function savePosition(position: AssistantPosition) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch (error) {
    // 静默失败
  }
}

function loadHistory(): ChatBubble[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is ChatBubble => (
        Boolean(item)
        && typeof item === 'object'
        && typeof (item as ChatBubble).id === 'string'
        && typeof (item as ChatBubble).content === 'string'
        && ((item as ChatBubble).role === 'user' || (item as ChatBubble).role === 'assistant')
      ))
      .slice(-MAX_PERSISTED);
  } catch (error) {
    return [];
  }
}

function saveHistory(messages: ChatBubble[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const trimmed = messages.slice(-MAX_PERSISTED);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    // 静默失败：localStorage 写满 / 隐私模式
  }
}

/**
 * 极简 Markdown → HTML 渲染器（支持 heading 1-6、bold/em/inline-code/code-block、
 * 有序/无序列表、引用、表格、链接、分隔线、换行），输出已转义的安全 HTML。
 */
function renderInlineMarkdown(input: string): string {
  if (!input) {
    return '';
  }

  const escapeHtml = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const escapeAttr = (s: string) => escapeHtml(s);

  const applyInline = (s: string) => s
    // inline code
    .replace(/`([^`\n]+)`/g, (_m, code: string) => `<code>${escapeHtml(code)}</code>`)
    // bold
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
    // italic
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')
    // link [text](url)
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
      const safeUrl = /^(https?:|mailto:|\/)/i.test(url) ? url : '#';
      return `<a href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`;
    });

  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const closeTable = () => {
    if (inTable) {
      const headers = tableHeader.map((h) => `<th>${applyInline(escapeHtml(h))}</th>`).join('');
      const body = tableRows
        .map((row) => `<tr>${row.map((c) => `<td>${applyInline(escapeHtml(c))}</td>`).join('')}</tr>`)
        .join('');
      html.push(`<table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`);
      inTable = false;
      tableHeader = [];
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // code block
    if (/^```/.test(line.trim())) {
      if (inCodeBlock) {
        html.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        closeList();
        closeTable();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // table: | a | b |
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const cells = line.trim().slice(1, -1).split('|').map((c) => c.trim());
      if (!inTable) {
        // 检查下一行是否是分隔行 | --- | --- |
        const next = lines[i + 1] ?? '';
        if (/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(next)) {
          inTable = true;
          tableHeader = cells;
          i += 1;
        } else {
          // 单独的 | 行，按普通行处理
          html.push(`<p>${applyInline(escapeHtml(line))}</p>`);
        }
      } else {
        tableRows.push(cells);
      }
      continue;
    } else if (inTable) {
      closeTable();
    }

    // heading
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      const text = applyInline(escapeHtml(headingMatch[2]));
      html.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    // hr
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      closeList();
      html.push('<hr/>');
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      closeList();
      const text = applyInline(escapeHtml(line.replace(/^>\s?/, '')));
      html.push(`<blockquote>${text}</blockquote>`);
      continue;
    }

    // unordered list
    const ulMatch = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ulMatch) {
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${applyInline(escapeHtml(ulMatch[1]))}</li>`);
      continue;
    }

    // ordered list
    const olMatch = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (olMatch) {
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${applyInline(escapeHtml(olMatch[1]))}</li>`);
      continue;
    }

    // 空行：结束列表
    if (!line.trim()) {
      closeList();
      continue;
    }

    // 普通段落
    closeList();
    html.push(`<p>${applyInline(escapeHtml(line))}</p>`);
  }

  closeList();
  closeTable();
  if (inCodeBlock && codeBuffer.length) {
    html.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
  }

  return html.join('');
}

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>(() => loadHistory());
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [position, setPosition] = useState<AssistantPosition>(() => loadPosition());
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startRight: number;
    startBottom: number;
    width: number;
    height: number;
  } | null>(null);
  const fabDragRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const todayLabel = useMemo(() => dayjs().format('YYYY-MM-DD HH:mm'), []);

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

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  useEffect(() => {
    savePosition(position);
  }, [position]);

  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startRight: window.innerWidth - rect.right,
      startBottom: window.innerHeight - rect.bottom,
      width: rect.width,
      height: rect.height,
    };
    setIsDragging(true);
    try {
      target.setPointerCapture(event.pointerId);
    } catch (error) {
      // 某些浏览器对非指针元素会抛错，忽略
    }
  };

  useEffect(() => {
    /* 全局监听 pointermove/up：注册一次即可，避免 isDragging 切换时
       漏掉从 pointerdown 之后的第一个 move 事件（React effect 是异步的）。 */
    const handleMove = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      // 拖动方向 = 鼠标位移的反方向（因为 right/bottom 离屏幕边缘越远越大）
      const nextRight = drag.startRight - deltaX;
      const nextBottom = drag.startBottom - deltaY;
      const maxRight = Math.max(0, window.innerWidth - drag.width);
      const maxBottom = Math.max(0, window.innerHeight - drag.height);
      setPosition({
        right: Math.min(maxRight, Math.max(0, nextRight)),
        bottom: Math.min(maxBottom, Math.max(0, nextBottom)),
      });
    };
    const handleEnd = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const moved = Math.hypot(dx, dy) >= 4;
      dragStateRef.current = null;
      setIsDragging(false);
      if (moved) {
        /* 标记刚拖完：FAB 的 onClick 在 50ms 内会被拦截 */
        fabDragRef.current = Date.now();
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, []);

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || sending) {
      return;
    }

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
    if (messages.length === 0) {
      return;
    }
    setResetConfirmOpen(true);
  };

  const handleConfirmReset = () => {
    setMessages([]);
    setInput('');
    setResetConfirmOpen(false);
  };

  const launcherStyle = {
    right: `${position.right}px`,
    bottom: `${position.bottom}px`,
  } as const;

  return (
    <div
      className={`assistant-launcher ${isDragging ? 'is-dragging' : ''}`.trim()}
      style={launcherStyle}
    >
      {open ? (
        <div className="assistant-panel" role="dialog" aria-label="AI 智能助理">
          <header
            className="assistant-panel-header assistant-drag-handle"
            onPointerDown={handleDragStart}
            title="按住拖动 AI 助理"
          >
            <div>
              <strong>AI 智能助理</strong>
              <span>调用真实数据 · 当前 {todayLabel}</span>
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

      <button
        type="button"
        className={`assistant-fab ${open ? 'is-open' : ''}`.trim()}
        aria-label={open ? '关闭 AI 助理' : '打开 AI 助理'}
        onClick={() => {
          /* 拖动结束后阻止 click 切换面板；fabDragEndAt 距今 < 50ms 视为刚拖完 */
          if (fabDragRef.current && Date.now() - fabDragRef.current < 50) {
            fabDragRef.current = null;
            return;
          }
          setOpen((value) => !value);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          /* pointerdown 时立即 setPointerCapture，之后 pointermove 即便离开元素也会继续触发。
             距离判定放到 onPointerUp。 */
          fabDragRef.current = null;
          handleDragStart(event);
        }}
        title="按住拖动 · 点击展开"
      >
        <span aria-hidden="true">{open ? '×' : '🤖'}</span>
        <span className="assistant-fab-tooltip">{open ? '关闭' : 'AI 助理'}</span>
      </button>
    </div>
  );
}
