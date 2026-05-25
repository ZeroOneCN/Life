import { Entity } from 'typeorm';

import { ImportBatchEntity } from '../../../shared/persistence/import-batch.entity';

@Entity('investment_forex_import_batch')
export class InvestmentForexImportBatchEntity extends ImportBatchEntity {}
