import { randomInt } from 'node:crypto';
import dayjs from 'dayjs';

import { appDataSource } from '../../../db/data-source';
import { TelegramBindingEntity } from '../telegram.entity';

/** 绑定码有效期（分钟） */
const BIND_CODE_TTL_MINUTES = 10;

/** 绑定码位数 */
const BIND_CODE_LENGTH = 6;

/**
 * 生成 6 位数字绑定码
 * @returns 100000-999999 范围内的随机数字字符串
 */
function generateCode(): string {
  return String(randomInt(100000, 999999));
}

/**
 * 为指定 LifeOS 用户生成新的绑定码（覆盖旧码）
 * @param userId - LifeOS 用户 ID
 * @returns 生成的 6 位绑定码
 */
export async function generateBindCode(userId: string): Promise<string> {
  const repo = appDataSource.getRepository(TelegramBindingEntity);
  const code = generateCode();
  const expiresAt = dayjs().add(BIND_CODE_TTL_MINUTES, 'minute').toDate();

  // 查找已有绑定记录，没有则创建
  let binding = await repo.findOne({ where: { user_id: userId } });
  if (!binding) {
    binding = repo.create({
      user_id: userId,
      telegram_user_id: '0',
      chat_id: '0',
      bind_code: code,
      bind_code_expires_at: expiresAt,
    });
  } else {
    binding.bind_code = code;
    binding.bind_code_expires_at = expiresAt;
  }

  await repo.save(binding);
  return code;
}

/**
 * 校验绑定码并完成绑定
 * @param code - 用户输入的 6 位绑定码
 * @param telegramUserId - Telegram 用户 ID
 * @param chatId - Telegram 聊天 ID
 * @param username - Telegram 用户名（可选）
 * @returns 绑定结果，包含是否成功、关联的 LifeOS 用户 ID、提示消息
 */
export async function consumeBindCode(
  code: string,
  telegramUserId: string,
  chatId: string,
  username?: string,
): Promise<{ success: boolean; userId?: string; message: string }> {
  const repo = appDataSource.getRepository(TelegramBindingEntity);
  const binding = await repo.findOne({ where: { bind_code: code } });

  if (!binding) {
    return { success: false, message: '绑定码无效' };
  }

  if (dayjs().isAfter(dayjs(binding.bind_code_expires_at))) {
    return { success: false, message: '绑定码已过期，请在网页端重新生成' };
  }

  // 完成绑定：清除绑定码，写入 Telegram 身份信息
  binding.telegram_user_id = telegramUserId;
  binding.chat_id = chatId;
  binding.telegram_username = username ?? null;
  binding.bind_code = null;
  binding.bind_code_expires_at = null;

  await repo.save(binding);

  return { success: true, userId: binding.user_id, message: '绑定成功！' };
}

/**
 * 根据 Telegram user ID 查找对应的 LifeOS user ID
 * @param telegramUserId - Telegram 用户 ID
 * @returns 对应的 LifeOS 用户 ID，未绑定返回 null
 */
export async function resolveUserIdByTelegram(telegramUserId: string): Promise<string | null> {
  const repo = appDataSource.getRepository(TelegramBindingEntity);
  const binding = await repo.findOne({ where: { telegram_user_id: telegramUserId } });

  return binding?.user_id ?? null;
}

/**
 * 更新最后活跃时间
 * @param telegramUserId - Telegram 用户 ID
 */
export async function touchActive(telegramUserId: string): Promise<void> {
  const repo = appDataSource.getRepository(TelegramBindingEntity);
  await repo.update({ telegram_user_id: telegramUserId }, { updated_at: new Date() });
}

/**
 * 获取用户的绑定状态（Web 端展示用）
 * @param userId - LifeOS 用户 ID
 * @returns 绑定状态对象，包含是否已绑定、Telegram 用户名、绑定时间
 */
export async function getBindingStatus(userId: string): Promise<{
  bound: boolean;
  telegramUsername?: string | null;
  boundAt?: string;
}> {
  const repo = appDataSource.getRepository(TelegramBindingEntity);
  const binding = await repo.findOne({ where: { user_id: userId } });

  if (!binding || !binding.telegram_user_id || binding.telegram_user_id === '0') {
    return { bound: false };
  }

  return {
    bound: true,
    telegramUsername: binding.telegram_username,
    boundAt: binding.updated_at.toISOString(),
  };
}
