import { Column } from 'typeorm';

import { UserScopedEntity } from './user-scoped.entity';

export abstract class ImportBatchEntity extends UserScopedEntity {
  @Column({ type: 'varchar', length: 128 })
  file_name!: string;

  @Column({ type: 'int', default: 0 })
  total_rows!: number;

  @Column({ type: 'int', default: 0 })
  imported_count!: number;

  @Column({ type: 'int', default: 0 })
  duplicate_count!: number;

  @Column({ type: 'int', default: 0 })
  invalid_count!: number;

  @Column({ type: 'json', nullable: true })
  summary_json!: Record<string, unknown> | null;
}
