import { CreateDateColumn, DeleteDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { randomUUID } from 'node:crypto';

export abstract class TimestampedEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = randomUUID();

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deleted_at!: Date | null;
}
