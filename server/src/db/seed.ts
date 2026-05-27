import 'reflect-metadata';

import { ensureDatabaseSchema } from './bootstrap';
import { appDataSource } from './data-source';
import { getSystemHealthSnapshot } from '../modules/system/system-health';

async function seed() {
  await appDataSource.initialize();
  await ensureDatabaseSchema({ forceSync: true });

  const snapshot = await getSystemHealthSnapshot();

  await appDataSource.destroy();
  // eslint-disable-next-line no-console
  console.log(
    `Seed completed. databaseReady=${snapshot.databaseReady} hasUsers=${snapshot.hasUsers} ` +
    'No demo user is created by default.',
  );
}

void seed();
