import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceToStorageItem1700000000000 implements MigrationInterface {
  name = 'AddSourceToStorageItem1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE life_storage_item
      ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'manual' AFTER archived_at,
      ADD COLUMN shopping_record_id VARCHAR(36) NULL DEFAULT NULL AFTER source
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE life_storage_item
      DROP COLUMN shopping_record_id,
      DROP COLUMN source
    `);
  }
}
