import { Entity } from 'typeorm';

import { ImportBatchEntity } from '../../../shared/persistence/import-batch.entity';

@Entity('life_card_bill_import_batch')
export class LifeCardBillImportBatchEntity extends ImportBatchEntity {}
