import dayjs from 'dayjs';
import { appDataSource } from '../../../db/data-source';
import { HealthMedicationRecordEntity } from '../../health/entities/health-medication-record.entity';

/** 用药命令数据 */
interface MedicationData {
  name: string;
  schedule: string;
}

/**
 * 处理用药录入命令
 * 将用药记录写入数据库，schedule 文本存为备注
 * @param userId - LifeOS 用户 ID
 * @param data - 解析后的用药数据
 * @returns 操作结果消息
 */
export async function handleMedication(userId: string, data: MedicationData): Promise<string> {
  const repo = appDataSource.getRepository(HealthMedicationRecordEntity);

  await repo.save(repo.create({
    user_id: userId,
    date: dayjs().format('YYYY-MM-DD'),
    medicine_name: data.name,
    breakfast: 0,
    lunch: 0,
    dinner: 0,
  }));

  return `💊 用药已记录：${data.name}${data.schedule ? `（${data.schedule}）` : ''}`;
}
