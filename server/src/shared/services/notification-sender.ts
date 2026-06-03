import nodemailer from 'nodemailer';
import { env } from '../../config/env';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface WebhookOptions {
  url: string;
  secret?: string;
  payload: Record<string, unknown>;
}

export interface WechatWorkOptions {
  webhookUrl: string;
  content: string;
}

export interface DingTalkOptions {
  webhookUrl: string;
  secret?: string;
  content: string;
}

export interface FeishuOptions {
  webhookUrl: string;
  secret?: string;
  content: string;
}

export interface TelegramOptions {
  botToken: string;
  chatId: string;
  text: string;
}

let emailTransporter: nodemailer.Transporter | null = null;

function getEmailTransporter() {
  if (!emailTransporter) {
    const port = env.SMTP_PORT;
    const secure = port === 465;

    emailTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure,
      requireTLS: !secure && port === 587,
      auth: env.SMTP_USER ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      } : undefined,
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });
  }
  return emailTransporter;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getEmailTransporter();
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

export async function sendDingTalkWebhook(options: DingTalkOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const body: Record<string, unknown> = {
      msgtype: 'text',
      text: { content: options.content },
    };

    if (options.secret) {
      const crypto = await import('node:crypto');
      const timestamp = Date.now().toString();
      const signStr = `${timestamp}\n${options.secret}`;
      const hmac = crypto.createHmac('sha256', signStr);
      hmac.update(signStr);
      const sign = hmac.digest('base64');
      headers['Content-Type'] = 'application/json';
      body.timestamp = timestamp;
      body.sign = `sha256=${sign}`;
    }

    const response = await fetch(options.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json() as { errcode?: number; errmsg?: string };

    if (!response.ok || (data.errcode !== undefined && data.errcode !== 0)) {
      return { success: false, error: data.errmsg || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

export async function sendFeishuWebhook(options: FeishuOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (options.secret) {
      const crypto = await import('node:crypto');
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signStr = `${timestamp}\n${options.secret}`;
      const hmac = crypto.createHmac('sha256', signStr);
      hmac.update(signStr);
      const sign = hmac.digest('base64');
      headers['Content-Type'] = 'application/json';
      headers['X-Lark-Request-Timestamp'] = timestamp;
      headers['X-Lark-Signature'] = sign;
    }

    const response = await fetch(options.webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        msg_type: 'text',
        content: JSON.stringify({ text: options.content }),
      }),
    });

    const data = await response.json() as { code?: number; msg?: string };

    if (!response.ok || (data.code !== undefined && data.code !== 0)) {
      return { success: false, error: data.msg || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

export async function sendTelegramMessage(options: TelegramOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${options.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: options.text,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json() as { ok?: boolean; description?: string };

    if (!data.ok) {
      return { success: false, error: data.description || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

export async function sendWebhook(options: WebhookOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.secret) {
      headers['X-Webhook-Secret'] = options.secret;
    }

    const response = await fetch(options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(options.payload),
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

export async function sendWechatWorkWebhook(options: WechatWorkOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(options.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'text',
        text: {
          content: options.content,
        },
      }),
    });

    const data = await response.json() as { errcode?: number; errmsg?: string };

    if (!response.ok || data.errcode !== 0) {
      return { success: false, error: data.errmsg || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
