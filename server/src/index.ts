import 'reflect-metadata';

import { createApp } from './app';
import { env } from './config/env';
import { ensureDatabaseSchema } from './db/bootstrap';
import { appDataSource } from './db/data-source';

async function bootstrap() {
  try {
    await appDataSource.initialize();

    if (!appDataSource.entityMetadatas.length) {
      throw new Error('No entity metadata discovered during startup.');
    }

    // eslint-disable-next-line no-console
    console.log(`LifeOS entity metadata loaded: ${appDataSource.entityMetadatas.length}`);

    const schemaState = await ensureDatabaseSchema();
    if (schemaState.synchronized) {
      // eslint-disable-next-line no-console
      console.log('LifeOS database schema synchronized automatically on startup.');
    }
    if (!schemaState.databaseReady) {
      // eslint-disable-next-line no-console
      console.warn(
        `LifeOS database schema is not ready. Missing core table "${schemaState.coreTable}". ` +
        'The server will stay online so /api/system/health can report bootstrap status.',
      );
    }

    const app = createApp();

    app.listen(env.PORT, () => {
      // Keep startup logging minimal until a real logger is wired in.
      // eslint-disable-next-line no-console
      console.log(`LifeOS server listening on :${env.PORT}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('LifeOS server failed to start.', error);
    process.exit(1);
  }
}

void bootstrap();
