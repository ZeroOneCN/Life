import { useMemo, useState } from 'react';

import { Btn, Tag, TextArea } from '../ui';
import { updateTemplateConfig } from '../../services/notificationCenter';
import type {
  NotificationSceneConfig,
  NotificationTemplate,
  NotificationTemplateFormat,
} from '../../types/notifications';

interface NotificationTemplateEditorProps {
  scene: NotificationSceneConfig;
  template: NotificationTemplate;
  onSaved?: () => void;
}

const TEMPLATE_VARIABLES: { token: string; description: string }[] = [
  { token: '{{title}}', description: '通知标题' },
  { token: '{{message}}', description: '业务消息正文' },
  { token: '{{date}}', description: '当前时间（YYYY-MM-DD HH:mm:ss）' },
  { token: '{{userId}}', description: '当前用户 ID' },
  { token: '{{meta.xxx}}', description: '调用方传入的额外业务字段（如 {{meta.amount}}）' },
];

const HTML_PRESETS: { label: string; snippet: string }[] = [
  {
    label: '卡片式提醒',
    snippet: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; padding: 16px 20px;">
    <div style="font-size: 12px; opacity: .85; letter-spacing: .08em;">LifeOS 通知</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 4px;">{{title}}</div>
  </div>
  <div style="padding: 16px 20px; color: #1f2937; line-height: 1.6;">
    <p style="margin: 0 0 8px;">{{message}}</p>
    <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">时间：{{date}}</p>
  </div>
</div>`,
  },
  {
    label: 'Markdown 转 HTML',
    snippet: `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; padding: 12px 16px; border-left: 4px solid #4f46e5; background: #f8fafc; border-radius: 6px;">
  <h3 style="margin: 0 0 8px; color: #1e293b;">{{title}}</h3>
  <div style="color: #334155; line-height: 1.7;">{{message}}</div>
</div>`,
  },
  {
    label: '账单提醒',
    snippet: `<table style="font-family: -apple-system, sans-serif; border-collapse: collapse; min-width: 360px;">
  <thead>
    <tr style="background: #f1f5f9;">
      <th colspan="2" style="padding: 10px 14px; text-align: left; color: #0f172a;">{{title}}</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding: 8px 14px; color: #64748b;">金额</td><td style="padding: 8px 14px; font-weight: 600; color: #dc2626;">¥ {{meta.amount}}</td></tr>
    <tr><td style="padding: 8px 14px; color: #64748b;">还款日</td><td style="padding: 8px 14px;">{{meta.dueDate}}</td></tr>
    <tr><td style="padding: 8px 14px; color: #64748b;">账户</td><td style="padding: 8px 14px;">{{meta.account}}</td></tr>
  </tbody>
</table>`,
  },
];

function renderPreview(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.\-]*)\s*\}\}/g, (match, key: string) => {
    if (key in vars) {
      return vars[key];
    }
    return `<span style="background:#fee2e2;color:#b91c1c;padding:0 4px;border-radius:3px;">${match}</span>`;
  });
}

const SAMPLE_VARS: Record<string, string> = {
  title: '本月信用卡还款提醒',
  message: '您的招商银行信用卡本期账单 ¥3,258.00 将于 3 天后到期。',
  date: '2026-06-08 09:30:00',
  userId: 'demo-user',
  'meta.amount': '3,258.00',
  'meta.dueDate': '2026-06-11',
  'meta.account': '招商银行 (尾号 1234)',
};

export function NotificationTemplateEditor({ scene, template, onSaved }: NotificationTemplateEditorProps) {
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);
  const [format, setFormat] = useState<NotificationTemplateFormat>(template.format);
  const [htmlBody, setHtmlBody] = useState(template.htmlBody || '');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const previewText = useMemo(() => renderPreview(body, SAMPLE_VARS), [body]);
  const previewHtml = useMemo(() => renderPreview(htmlBody, SAMPLE_VARS), [htmlBody]);
  const previewTitle = useMemo(() => renderPreview(title, SAMPLE_VARS), [title]);

  const dirty =
    title !== template.title ||
    body !== template.body ||
    format !== template.format ||
    htmlBody !== (template.htmlBody || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTemplateConfig(scene.id, {
        title,
        body,
        format,
        htmlBody,
      });
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setTitle(template.title);
    setBody(template.body);
    setFormat(template.format);
    setHtmlBody(template.htmlBody || '');
  };

  return (
    <div className="nt-editor">
      <div className="nt-editor-header">
        <div>
          <div className="nt-editor-scene">{scene.label}</div>
          <div className="nt-editor-hint">
            模板仅对该场景生效。支持纯文本与 HTML（富文本）两种格式，HTML 模板将同时下发到邮件、企业微信/钉钉/飞书（Markdown）、Telegram（HTML 模式）和 Webhook（payload.html 字段）。
          </div>
        </div>
        <div className="nt-editor-actions">
        <Tag tone={dirty ? 'orange' : 'default'}>{dirty ? '未保存' : '已同步'}</Tag>
        <Btn tone="secondary" onClick={handleReset} disabled={!dirty || saving}>还原</Btn>
        <Btn onClick={handleSave} disabled={!dirty || saving}>{saving ? '保存中…' : '保存模板'}</Btn>
      </div>
      </div>

      <div className="nt-editor-format">
        <span className="nt-editor-format-label">格式</span>
        <div className="nt-format-toggle">
          <button
            type="button"
            className={`nt-format-option ${format === 'text' ? 'is-active' : ''}`}
            onClick={() => setFormat('text')}
          >
            纯文本
          </button>
          <button
            type="button"
            className={`nt-format-option ${format === 'html' ? 'is-active' : ''}`}
            onClick={() => setFormat('html')}
          >
            HTML 富文本
          </button>
        </div>
        <span className="nt-editor-format-hint">
          {format === 'html' ? 'HTML 模板将覆盖纯文本 body 用于实际发送' : '仅使用纯文本 body，忽略 HTML 字段'}
        </span>
      </div>

      <div className="nt-editor-row">
        <TextArea
          label="标题模板"
          rows={1}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          hint={`示例：{{title}} → ${previewTitle}`}
        />
      </div>

      <div className="nt-editor-split">
        <div className="nt-editor-pane">
          <div className="nt-pane-tabs">
            <button
              type="button"
              className={`nt-pane-tab ${activeTab === 'edit' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('edit')}
            >
              {format === 'html' ? 'HTML 编辑' : '正文编辑'}
            </button>
            <button
              type="button"
              className={`nt-pane-tab ${activeTab === 'preview' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              实时预览
            </button>
          </div>

          {activeTab === 'edit' ? (
            <div className="nt-pane-body">
              {format === 'html' ? (
                <>
                  <TextArea
                    label="HTML 模板正文"
                    rows={10}
                    value={htmlBody}
                    onChange={(event) => setHtmlBody(event.target.value)}
                    hint="支持 inline-style 样式，{{title}} / {{message}} / {{date}} / {{userId}} / {{meta.xxx}} 等占位符"
                  />
                  <div className="nt-preset-list">
                    <div className="nt-preset-title">快速插入预设</div>
                    <div className="nt-preset-row">
                      {HTML_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className="nt-preset-chip"
                          onClick={() => setHtmlBody((current) => (current ? `${current}\n\n${preset.snippet}` : preset.snippet))}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <TextArea
                  label="纯文本正文"
                  rows={10}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  hint="支持 {{title}} / {{message}} / {{date}} / {{userId}} / {{meta.xxx}} 插值"
                />
              )}
            </div>
          ) : (
            <div className="nt-pane-body">
              <div className="nt-preview-meta">使用示例数据预览实际收到的通知效果：</div>
              {format === 'html' ? (
                <div className="nt-preview-html">
                  <div
                    className="nt-preview-html-frame"
                    // 预览沙箱：仅渲染用户输入的 HTML 字符串
                    dangerouslySetInnerHTML={{ __html: previewHtml || '<em style="color:#94a3b8">尚未填写 HTML 模板</em>' }}
                  />
                </div>
              ) : (
                <pre className="nt-preview-text">{previewText || '（正文为空）'}</pre>
              )}
            </div>
          )}
        </div>

        <div className="nt-editor-side">
          <div className="nt-side-title">可用变量</div>
          <ul className="nt-variable-list">
            {TEMPLATE_VARIABLES.map((variable) => (
              <li key={variable.token}>
                <code>{variable.token}</code>
                <span>{variable.description}</span>
              </li>
            ))}
          </ul>
          <div className="nt-side-tip">
            提示：HTML 模板中插入的 <code>{'{{meta.amount}}'}</code> 等占位符会在发送时由调用方填入。
          </div>
        </div>
      </div>
    </div>
  );
}
