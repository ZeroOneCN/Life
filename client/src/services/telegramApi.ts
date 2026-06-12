import { apiClient } from '../lib/api';

/** Telegram 绑定状态 */
export interface TelegramBindingStatus {
  bound: boolean;
  telegramUsername?: string | null;
  boundAt?: string;
}

/** 生成绑定码 */
export async function generateTelegramBindCode(): Promise<{ code: string }> {
  const response = await apiClient.post('/telegram/bind-code');
  return response.data.data;
}

/** 查询绑定状态 */
export async function getTelegramBindingStatus(): Promise<TelegramBindingStatus> {
  const response = await apiClient.get('/telegram/status');
  return response.data.data;
}
