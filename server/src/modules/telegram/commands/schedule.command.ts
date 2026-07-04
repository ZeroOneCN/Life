import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { LifeScheduleEventEntity } from '../../life/entities/life-schedule-event.entity';

/** 日程命令数据 */
interface ScheduleData {
  action: 'add';
  text: string;
  /** 开始时间字符串：可能是 HH:mm 或 明天 HH:mm 等相对时间 */
  startAt: string;
  /** 持续分钟数（默认 60） */
  durationMinutes?: number;
  /** 提前提醒分钟数（默认 30） */
  reminderMinutes?: number;
}

/**
 * 解析相对时间字符串为 ISO 时间字符串。
 * @param raw 原始字符串，如 "14:00"、"明天 14:00"、"后天 09:30"
 * @returns ISO 字符串；无法解析返回 null
 */
function parseStartAt(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const now = dayjs();

  // 明天 HH:mm
  const tomorrowMatch = trimmed.match(/^(?:明天|明日)\s*(\d{1,2}):(\d{2})$/);
  if (tomorrowMatch) {
    const hour = Number(tomorrowMatch[1]);
    const minute = Number(tomorrowMatch[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return now.add(1, 'day').hour(hour).minute(minute).second(0).millisecond(0).toISOString();
    }
  }

  // 后天 HH:mm
  const dayAfterMatch = trimmed.match(/^(?:后天|后日)\s*(\d{1,2}):(\d{2})$/);
  if (dayAfterMatch) {
    const hour = Number(dayAfterMatch[1]);
    const minute = Number(dayAfterMatch[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return now.add(2, 'day').hour(hour).minute(minute).second(0).millisecond(0).toISOString();
    }
  }

  // HH:mm 当天
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return now.hour(hour).minute(minute).second(0).millisecond(0).toISOString();
    }
  }

  return null;
}

/**
 * 处理日程添加命令。
 * @param userId LifeOS 用户 ID
 * @param data   解析后的日程数据
 * @returns 操作结果消息
 */
export async function handleSchedule(userId: string, data: Record<string, unknown>): Promise<string> {
  const text = String(data.text ?? '').trim();
  const startAtRaw = String(data.startAt ?? '').trim();

  if (!text || !startAtRaw) {
    return '❌ 日程格式无效。格式：日 明天 14:00 开会';
  }

  const startAtIso = parseStartAt(startAtRaw);
  if (!startAtIso) {
    return `❌ 无法解析时间：${startAtRaw}。支持格式：HH:mm / 明天 HH:mm / 后天 HH:mm`;
  }

  const durationMinutes = typeof data.durationMinutes === 'number' ? data.durationMinutes : 60;
  const reminderMinutes = typeof data.reminderMinutes === 'number' ? data.reminderMinutes : 30;

  const repo = appDataSource.getRepository(LifeScheduleEventEntity);
  const startAt = dayjs(startAtIso);
  const endAt = startAt.add(durationMinutes, 'minute');

  await repo.save(repo.create({
    user_id: userId,
    title: text,
    description_markdown: '',
    start_at: startAt.toDate(),
    end_at: endAt.toDate(),
    is_all_day: false,
    location: null,
    color: 'indigo',
    recurrence_type: 'none',
    recurrence_config: null,
    recurrence_end_date: null,
    reminder_minutes: reminderMinutes,
    completed: false,
    completed_at: null,
    trashed_at: null,
    source: 'manual',
    source_id: null,
    sort_order: Date.now(),
  }));

  const startLabel = startAt.format('YYYY-MM-DD HH:mm');
  return `📅 日程已添加：${text}\n开始时间：${startLabel}\n持续：${durationMinutes} 分钟`;
}
