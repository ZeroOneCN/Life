import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { HealthMedicationRecordEntity } from '../../health/entities/health-medication-record.entity';

/**
 * 处理用药录入命令
 * 将用药记录写入数据库，schedule 文本存为备注
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的用药数据
 * @returns 操作结果消息
 */
export async function handleMedication(userId: string, data: Record<string, unknown>): Promise<string> {
  const name = String(data.name ?? '').trim();

  if (!name) {
    return '❌ 药品名称不能为空。格式：药 维C 每日1粒';
  }

  const schedule = String(data.schedule ?? '');

  const repo = appDataSource.getRepository(HealthMedicationRecordEntity);

  await repo.save(repo.create({
    user_id: userId,
    date: dayjs().format('YYYY-MM-DD'),
    medicine_name: name,
    breakfast: 0,
    lunch: 0,
    dinner: 0,
  }));

  return `💊 用药已记录：${name}${schedule ? `（${schedule}）` : ''}`;
}
