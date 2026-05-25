import { Column, Entity } from 'typeorm';

import { UserSettingEntity } from '../../../shared/persistence/user-setting.entity';

@Entity('investment_forex_setting')
export class InvestmentForexSettingEntity extends UserSettingEntity {
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 100 })
  leverage!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.5 })
  forced_liquidation_ratio!: number;

  @Column({ type: 'date', nullable: true })
  dashboard_start_date!: string | null;

  @Column({ type: 'date', nullable: true })
  dashboard_end_date!: string | null;
}
