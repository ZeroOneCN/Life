import 'reflect-metadata';

import { createApp } from './app';
import { env } from './config/env';
import { appDataSource } from './db/data-source';

async function bootstrap() {
  await appDataSource.initialize();
  const app = createApp();

  app.listen(env.PORT, () => {
    // Keep startup logging minimal until a real logger is wired in.
    // eslint-disable-next-line no-console
    console.log(`LifeOS server listening on :${env.PORT}`);
  });
}

void bootstrap();
