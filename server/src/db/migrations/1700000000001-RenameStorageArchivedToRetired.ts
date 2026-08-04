import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameStorageArchivedToRetired1700000000001 implements MigrationInterface {
  name = 'RenameStorageArchivedToRetired1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 重命名 life_storage_item 表的 archived_at 列为 retired_at
    await queryRunner.query(`
      ALTER TABLE life_storage_item
      CHANGE COLUMN archived_at retired_at DATETIME NULL DEFAULT NULL
    `);

    // 2. 重命名 life_storage_setting 表的 include_archived_in_dashboard 列为 include_retired_in_dashboard
    await queryRunner.query(`
      ALTER TABLE life_storage_setting
      CHANGE COLUMN include_archived_in_dashboard include_retired_in_dashboard TINYINT(1) NOT NULL DEFAULT 1
    `);

    // 3. 更新 status 数据：将 'archived' 改为 'retired'
    await queryRunner.query(`
      UPDATE life_storage_item SET status = 'retired' WHERE status = 'archived'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：将 'retired' 改回 'archived'
    await queryRunner.query(`
      UPDATE life_storage_item SET status = 'archived' WHERE status = 'retired'
    `);

    // 回滚列名
    await queryRunner.query(`
      ALTER TABLE life_storage_setting
      CHANGE COLUMN include_retired_in_dashboard include_archived_in_dashboard TINYINT(1) NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE life_storage_item
      CHANGE COLUMN retired_at archived_at DATETIME NULL DEFAULT NULL
    `);
  }
}
