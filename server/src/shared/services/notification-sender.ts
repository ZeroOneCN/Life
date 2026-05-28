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
