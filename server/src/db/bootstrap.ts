import { appDataSource } from './data-source';
import { env } from '../config/env';

const CORE_TABLE = 'system_user_account';

export async function ensureDatabaseSchema(options?: { forceSync?: boolean }) {
  const queryRunner = appDataSource.createQueryRunner();

  try {
    const hasCoreTable = await queryRunner.hasTable(CORE_TABLE);
    if (hasCoreTable) {
      return {
        synchronized: false,
        reason: 'core_table_exists',
      } as const;
    }
  } finally {
    await queryRunner.release();
  }

  const shouldSynchronize = options?.forceSync || env.DB_SYNCHRONIZE || env.DB_AUTO_BOOTSTRAP;

  if (!shouldSynchronize) {
    throw new Error(
      `Database schema is missing core table "${CORE_TABLE}". ` +
      'Enable DB_SYNCHRONIZE=true, set DB_AUTO_BOOTSTRAP=true, or provide migrations before startup.',
    );
  }

  await appDataSource.synchronize();

  return {
    synchronized: true,
    reason: 'core_table_missing',
  } as const;
}
