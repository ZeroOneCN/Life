import { appDataSource } from './data-source';
import { env } from '../config/env';

export const CORE_TABLE = 'system_user_account';

export interface DatabaseSchemaState {
  coreTable: string;
  hasCoreTable: boolean;
  databaseReady: boolean;
  synchronized: boolean;
  reason: 'core_table_exists' | 'core_table_missing';
}

export async function inspectDatabaseSchema() {
  const queryRunner = appDataSource.createQueryRunner();

  try {
    const hasCoreTable = await queryRunner.hasTable(CORE_TABLE);
    return {
      coreTable: CORE_TABLE,
      hasCoreTable,
      databaseReady: hasCoreTable,
      synchronized: false,
      reason: hasCoreTable ? 'core_table_exists' : 'core_table_missing',
    } satisfies DatabaseSchemaState;
  } finally {
    await queryRunner.release();
  }
}

export async function ensureDatabaseSchema(options?: { forceSync?: boolean }) {
  const schemaState = await inspectDatabaseSchema();
  if (schemaState.hasCoreTable) {
    return schemaState;
  }

  const shouldSynchronize = options?.forceSync || env.DB_SYNCHRONIZE || env.DB_AUTO_BOOTSTRAP;

  if (!shouldSynchronize) {
    return schemaState;
  }

  await appDataSource.synchronize();

  return {
    coreTable: CORE_TABLE,
    hasCoreTable: true,
    databaseReady: true,
    synchronized: true,
    reason: 'core_table_missing',
  } satisfies DatabaseSchemaState;
}
