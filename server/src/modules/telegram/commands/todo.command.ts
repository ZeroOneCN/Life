import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { LifeTodoTaskEntity } from '../../life/entities/life-todo-task.entity';

/** 待办命令数据 */
interface TodoData {
  action: 'add' | 'done';
  text: string;
  due?: string;
}

/**
 * 解析相对日期字符串为 YYYY-MM-DD
 * @param dueText - 相对日期文本（如"明天"、"后天"、"今天"）
 * @returns 格式化后的日期字符串，无法解析返回 undefined
 */
function parseDueDate(dueText?: string): string | undefined {
  if (!dueText) return undefined;

  if (dueText.includes('明天')) return dayjs().add(1, 'day').format('YYYY-MM-DD');
  if (dueText.includes('后天')) return dayjs().add(2, 'day').format('YYYY-MM-DD');
  if (dueText.includes('今天') || dueText.includes('今天')) return dayjs().format('YYYY-MM-DD');

  return undefined;
}

/**
 * 处理待办操作命令
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的待办数据
 * @returns 操作结果消息
 */
export async function handleTodo(userId: string, data: TodoData): Promise<string> {
  const repo = appDataSource.getRepository(LifeTodoTaskEntity);

  if (data.action === 'add') {
    // 查询当前最大 sort_order
    const lastTask = await repo.findOne({
      where: { user_id: userId, completed: false },
      order: { sort_order: 'DESC' },
      select: ['sort_order'],
    });

    await repo.save(repo.create({
      user_id: userId,
      title: data.text,
      description_markdown: '',
      due_date: parseDueDate(data.due),
      priority: 'medium',
      tags_json: null,
      is_daily: false,
      recurrence_type: 'none',
      recurrence_config: null,
      completed: false,
      completed_at: null,
      last_completed_date: null,
      trashed_at: null,
      sort_order: (lastTask?.sort_order ?? -1) + 1,
    }));

    return `📋 待办已添加：${data.text}${data.due ? ` (${data.due})` : ''}`;
  }

  // done: 模糊匹配未完成的待办并标记完成
  const tasks = await repo.find({
    where: { user_id: userId, completed: false, trashed_at: null as any },
    take: 20,
  });

  const target = tasks.find((t) => t.title.includes(data.text));
  if (target) {
    target.completed = true;
    target.completed_at = new Date();
    target.last_completed_date = dayjs().format('YYYY-MM-DD');
    await repo.save(target);
    return `✅ 待办已完成：${target.title}`;
  }

  return `❌ 未找到待办：${data.text}`;
}
