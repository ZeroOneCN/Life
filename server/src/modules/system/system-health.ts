import { appDataSource } from '../../db/data-source';
import { env } from '../../config/env';
import { CORE_TABLE, inspectDatabaseSchema } from '../../db/bootstrap';
import { SystemUserAccountEntity } from './entities/system-user-account.entity';

export interface SystemHealthSnapshot {
  status: 'ok' | 'degraded';
  databaseReady: boolean;
  bootstrapRequired: boolean;
  hasUsers: boolean;
  registrationMode: 'first_admin_only';
  entityCount: number;
  schemaMode: 'synchronize' | 'auto_bootstrap' | 'migration_only';
  reason: string | null;
  coreTable: string;
}

function getSchemaMode(): SystemHealthSnapshot['schemaMode'] {
  if (env.DB_SYNCHRONIZE) {
    return 'synchronize';
  }

  if (env.DB_AUTO_BOOTSTRAP) {
    return 'auto_bootstrap';
  }

  return 'migration_only';
}

export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const schemaState = await inspectDatabaseSchema();

  if (!schemaState.hasCoreTable) {
    return {
      status: 'degraded',
      databaseReady: false,
      bootstrapRequired: true,
      hasUsers: false,
      registrationMode: 'first_admin_only',
      entityCount: appDataSource.entityMetadatas.length,
      schemaMode: getSchemaMode(),
      reason: 'core_table_missing',
      coreTable: CORE_TABLE,
    };
  }

  const accountRepo = appDataSource.getRepository(SystemUserAccountEntity);
  const userCount = await accountRepo.count();
  const hasUsers = userCount > 0;

  return {
    status: 'ok',
    databaseReady: true,
    bootstrapRequired: !hasUsers,
    hasUsers,
    registrationMode: 'first_admin_only',
    entityCount: appDataSource.entityMetadatas.length,
    schemaMode: getSchemaMode(),
    reason: null,
    coreTable: CORE_TABLE,
  };
}
