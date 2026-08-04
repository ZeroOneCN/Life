import { appDataSource } from '../../db/data-source';
import { HealthMedicationRecordEntity } from './entities/health-medication-record.entity';
import { AppError } from '../../shared/errors/app-error';

/** 用药记录创建入参（与 assistant.tools.ts createMedication 字段对齐） */
export interface CreateMedicationInput {
  date: string;
  medicineName: string;
  breakfast?: number;
  lunch?: number;
  dinner?: number;
}

/**
 * 创建用药记录（含必填校验、剂量非负处理、repo.create + save）。
 * @param userId 用户 ID
 * @param input 创建入参
 * @returns 保存后的实体
 */
export async function createMedicationRecord(
  userId: string,
  input: CreateMedicationInput,
): Promise<HealthMedicationRecordEntity> {
  if (!input.date || !input.medicineName) {
    throw new AppError('缺少必填字段：date/medicineName', 400, 400);
  }
  const repository = appDataSource.getRepository(HealthMedicationRecordEntity);
  const item = await repository.save(repository.create({
    user_id: userId,
    date: input.date,
    medicine_name: input.medicineName,
    breakfast: Math.max(0, input.breakfast ?? 0),
    lunch: Math.max(0, input.lunch ?? 0),
    dinner: Math.max(0, input.dinner ?? 0),
  }));
  return item;
}
