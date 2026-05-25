import { Entity } from 'typeorm';

import { ImportBatchEntity } from '../../../shared/persistence/import-batch.entity';

@Entity('finance_travel_import_batch')
export class FinanceTravelImportBatchEntity extends ImportBatchEntity {}
