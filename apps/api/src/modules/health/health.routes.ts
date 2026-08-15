import { Router } from 'express';
import { prisma } from '@pursberry/db';
import { logger } from '../../lib/logger.js';

export const healthRouter: Router = Router();

/** Liveness — process is up. Used by the container orchestrator. */
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
});

/**
 * Readiness — dependencies are reachable. Deliberately separate from liveness:
 * a Postgres blip should stop traffic being routed here, not restart the process.
 */
healthRouter.get('/ready', async (_req, res) => {
  const checks: Record<string, 'ok' | 'unavailable'> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks['postgres'] = 'ok';
  } catch (error) {
    logger.warn({ err: error }, 'readiness: postgres unreachable');
    checks['postgres'] = 'unavailable';
  }

  const healthy = Object.values(checks).every((v) => v === 'ok');
  res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'degraded', checks });
});
