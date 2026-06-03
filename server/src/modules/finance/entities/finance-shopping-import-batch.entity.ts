import { Entity } from 'typeorm';

import { ImportBatchEntity } from '../../../shared/persistence/import-batch.entity';

@Entity('finance_shopping_import_batch')
export class FinanceShoppingImportBatchEntity extends ImportBatchEntity {}
