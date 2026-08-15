import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { loadEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { healthRouter } from './modules/health/health.routes.js';

export function createApp(): Express {
  const env = loadEnv();
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      // Explicit allowlist. The Electron POS client sends no Origin header, so
      // it is unaffected; this only constrains the browser surfaces.
      origin: [env.WEB_URL, env.ADMIN_URL],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(pinoHttp({ logger }));

  app.use('/', healthRouter);

  // Tenant-facing and platform routes mount here as their tickets land:
  //   app.use('/v1/auth',      authRouter);       // TEN-102
  //   app.use('/v1/branches',  branchRouter);     // TEN-104
  //   app.use('/v1/products',  productRouter);    // PROD-101
  //   app.use('/v1/sync',      syncRouter);       // SYNC-103
  //   app.use('/platform',     superAdminRouter); // BILL-102/103
  // Everything under /v1 must sit behind authenticate + requireTenant.

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
