import { Column, Entity, Index } from 'typeorm';

import { TimestampedEntity } from '../../../shared/persistence/timestamped.entity';

/**
 * 食物营养成分缓存。
 * 饮食录入时由 DeepSeek 估算出 100g 基准下的 calories/protein/carbs/fat，
 * 写入此表；下次相同食物名（normalize 后）直接命中缓存，避免重复调用 AI。
 *
 * 注意：表不带 user_id，是全站共享的「食物字典」。
 * （食物营养是公开数据，每个用户查「鸡胸肉」结果都一致，没必要按用户隔离）
 */
@Entity('health_food_nutrition_cache')
@Index('idx_food_cache_key', ['food_key'], { unique: true })
export class HealthFoodNutritionCacheEntity extends TimestampedEntity {
  /** 归一化后的 key（去空格、lowercase），用于去重 */
  @Column({ type: 'varchar', length: 128, unique: true })
  food_key!: string;

  /** 用户输入的原始名称（保留展示用） */
  @Column({ type: 'varchar', length: 128 })
  food_name!: string;

  /** 100g 基准下的热量（千卡） */
  @Column({ type: 'double' })
  calories_per_100g!: number;

  /** 100g 基准下的蛋白质（克） */
  @Column({ type: 'double' })
  protein_per_100g!: number;

  /** 100g 基准下的碳水（克） */
  @Column({ type: 'double' })
  carbs_per_100g!: number;

  /** 100g 基准下的脂肪（克） */
  @Column({ type: 'double' })
  fat_per_100g!: number;

  /** 备注，例如「油炸类，脂肪偏高」 */
  @Column({ type: 'varchar', length: 255, default: '' })
  note!: string;

  /** 命中次数：用于评估缓存价值 */
  @Column({ type: 'int', default: 0 })
  hit_count!: number;
}
