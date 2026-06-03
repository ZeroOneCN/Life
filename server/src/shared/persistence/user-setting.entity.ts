import { Column, PrimaryColumn } from 'typeorm';

export abstract class UserSettingEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  user_id!: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
