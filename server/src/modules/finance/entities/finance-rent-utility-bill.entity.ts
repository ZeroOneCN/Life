import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

/** 租房月度水电燃气账单 */
@Entity('finance_rent_utility_bill')
export class FinanceRentUtilityBillEntity extends UserScopedEntity {
  /** 关联的住房记录 ID */
  @Column({ type: 'varchar', length: 36 })
  record_id!: string;

  /** 账单年月，格式 YYYY-MM */
  @Column({ type: 'varchar', length: 7 })
  year_month!: string;

  /** 电费金额 */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  electricity_fee!: number;

  /** 水费金额 */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  water_fee!: number;

  /** 燃气费金额 */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  gas_fee!: number;
}
