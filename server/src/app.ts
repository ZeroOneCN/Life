import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { mockJwtAuth } from './shared/http/auth-middleware';
import { errorHandler, notFoundHandler } from './shared/http/error-handler';
import { createApiRouter } from './routes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/healthz', (_request, response) => {
    response.json({
      code: 0,
      message: 'ok',
      data: {
        status: 'ok',
      },
    });
  });

  app.use('/api', mockJwtAuth, createApiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
