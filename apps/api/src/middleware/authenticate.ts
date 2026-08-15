import type { RequestHandler } from 'express';
import { HttpError } from './errors.js';

export interface AccessTokenClaims {
  userId: string;
  tenantId: string;
  role: string;
  branchId?: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessTokenClaims;
    }
  }
}

/**
 * TEN-102 — NOT IMPLEMENTED YET.
 *
 * This is a deliberate hard failure rather than a permissive stub: a stub that
 * waved requests through would let the rest of the API be built and tested
 * against an auth layer that does not exist, and the gap would only show up in
 * production. Implement JWT verification here when TEN-102 is picked up:
 *
 *   1. Read the Bearer token from the Authorization header.
 *   2. Verify signature + expiry against JWT_ACCESS_SECRET.
 *   3. Populate req.auth from the verified claims — never from request input.
 */
export const authenticate: RequestHandler = (_req, _res, next) => {
  next(new HttpError(501, 'Authentication is not implemented yet (TEN-102)', 'not_implemented'));
};
