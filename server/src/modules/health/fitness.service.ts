import dayjs from 'dayjs';

import { appDataSource } from '../../db/data-source';
import { HealthFitnessWeightRecordEntity } from './entities/health-fitness-weight-record.entity';
import { normalizeDate } from '../../shared/utils/date';
import { AppError } from '../../shared/errors/app-error';

/** 体重记录创建入参（完整 18 字段，与 fitness.router.ts weightSchema 对齐） */
export interface CreateWeightInput {
  date: string;
  weight: number;
  height?: number;
  bodyFat?: number;
  visceralFat?: number;
  fatMass?: number;
  muscleRate?: number;
  muscleMass?: number;
  bodyWaterRate?: number;
  bodyWaterMass?: number;
  proteinRate?: number;
  proteinMass?: number;
  boneRate?: number;
  boneMass?: number;
  skeletalMuscleRate?: number;
  skeletalMuscleMass?: number;
  subcutaneousFatRate?: number;
  subcutaneousFatMass?: number;
}

/** 体重记录响应 DTO */
export interface WeightRecordDto {
  id: string;
  userId: string;
  date: string;
  weight: number;
  height: number;
  bodyFat: number;
  visceralFat: number;
  fatMass: number;
  muscleRate: number;
  muscleMass: number;
  bodyWaterRate: number;
  bodyWaterMass: number;
  proteinRate: number;
  proteinMass: number;
  boneRate: number;
  boneMass: number;
  skeletalMuscleRate: number;
  skeletalMuscleMass: number;
  subcutaneousFatRate: number;
  subcutaneousFatMass: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * 将体重记录实体转为前端响应对象（完整 18 字段映射）。
 * @param entity 体重记录实体
 * @returns 前端响应 DTO
 */
export function mapWeightRecord(entity: HealthFitnessWeightRecordEntity): WeightRecordDto {
  return {
    id: entity.id,
    userId: entity.user_id,
    date: entity.date,
    weight: Number(entity.weight),
    height: Number(entity.height),
    bodyFat: Number(entity.body_fat),
    visceralFat: Number(entity.visceral_fat),
    fatMass: Number(entity.fat_mass),
    muscleRate: Number(entity.muscle_rate),
    muscleMass: Number(entity.muscle_mass),
    bodyWaterRate: Number(entity.body_water_rate),
    bodyWaterMass: Number(entity.body_water_mass),
    proteinRate: Number(entity.protein_rate),
    proteinMass: Number(entity.protein_mass),
    boneRate: Number(entity.bone_rate),
    boneMass: Number(entity.bone_mass),
    skeletalMuscleRate: Number(entity.skeletal_muscle_rate),
    skeletalMuscleMass: Number(entity.skeletal_muscle_mass),
    subcutaneousFatRate: Number(entity.subcutaneous_fat_rate),
    subcutaneousFatMass: Number(entity.subcutaneous_fat_mass),
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
}

/**
 * 创建体重记录（含完整 18 字段映射、normalizeDate、范围校验）。
 * @param userId 用户 ID
 * @param input 创建入参
 * @returns 保存后的实体
 */
export async function createWeightRecord(
  userId: string,
  input: CreateWeightInput,
): Promise<HealthFitnessWeightRecordEntity> {
  if (!input.date || !input.weight) {
    throw new AppError('缺少必填字段：date/weight', 400, 400);
  }
  if (!dayjs(input.date, 'YYYY-MM-DD', true).isValid() && !dayjs(input.date, 'YYYY/MM/DD', true).isValid()) {
    throw new AppError('date 格式无效，应为 YYYY-MM-DD', 400, 400);
  }
  if (input.weight < 1 || input.weight > 1000) {
    throw new AppError('weight 范围无效（应为 1-1000）', 400, 400);
  }

  const repository = appDataSource.getRepository(HealthFitnessWeightRecordEntity);
  const item = await repository.save(repository.create({
    user_id: userId,
    date: normalizeDate(input.date),
    weight: input.weight,
    height: input.height,
    body_fat: input.bodyFat,
    visceral_fat: input.visceralFat,
    fat_mass: input.fatMass,
    muscle_rate: input.muscleRate,
    muscle_mass: input.muscleMass,
    body_water_rate: input.bodyWaterRate,
    body_water_mass: input.bodyWaterMass,
    protein_rate: input.proteinRate,
    protein_mass: input.proteinMass,
    bone_rate: input.boneRate,
    bone_mass: input.boneMass,
    skeletal_muscle_rate: input.skeletalMuscleRate,
    skeletal_muscle_mass: input.skeletalMuscleMass,
    subcutaneous_fat_rate: input.subcutaneousFatRate,
    subcutaneous_fat_mass: input.subcutaneousFatMass,
  }));
  return item;
}
