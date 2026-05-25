import { Column, Entity } from 'typeorm';

import { UserScopedEntity } from '../../../shared/persistence/user-scoped.entity';

@Entity('investment_forex_capital_flow')
export class InvestmentForexCapitalFlowEntity extends UserScopedEntity {
  @Column({ type: 'date' })
  flow_date!: string;

  @Column({ type: 'varchar', length: 16 })
  flow_type!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'text' })
  remark!: string;
}
