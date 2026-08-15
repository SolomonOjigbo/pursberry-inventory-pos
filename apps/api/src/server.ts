import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './lib/logger.js';

const env = loadEnv();
const server = createApp().listen(env.API_PORT, () => {
  logger.info(`Pursberry API listening on http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info(`${signal} received, closing server`);
    server.close(() => process.exit(0));
  });
}
