import type { RequestHandler } from 'express';
import { tenantContextSchema, type TenantContext } from '@pursberry/shared';
import { HttpError } from './errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * TEN-105 support. Resolves the tenant context that `withTenant()` will push
 * into the Postgres session.
 *
 * The context comes from the VERIFIED access token only. Never from a header,
 * query param, or request body — a client-supplied `X-Tenant-Id` would let any
 * authenticated user of tenant A read tenant B by editing one header, and RLS
 * would faithfully serve it because the GUC would say so.
 */
export const requireTenant: RequestHandler = (req, _res, next) => {
  const claims = req.auth;
  if (!claims) {
    next(new HttpError(401, 'Authentication required', 'unauthenticated'));
    return;
  }

  const parsed = tenantContextSchema.safeParse({
    tenantId: claims.tenantId,
    userId: claims.userId,
    role: claims.role,
    branchId: claims.branchId ?? null,
  });

  if (!parsed.success) {
    next(new HttpError(401, 'Token is missing a usable tenant context', 'invalid_tenant_context'));
    return;
  }

  req.tenant = parsed.data;
  next();
};

/** TEN-103. Use after requireTenant: `router.get('/', requireRole('OWNER','ACCOUNTANT'), ...)` */
export function requireRole(...roles: TenantContext['role'][]): RequestHandler {
  return (req, _res, next) => {
    if (!req.tenant) {
      next(new HttpError(401, 'Authentication required', 'unauthenticated'));
      return;
    }
    if (!roles.includes(req.tenant.role)) {
      next(new HttpError(403, 'Your role cannot perform this action', 'forbidden'));
      return;
    }
    next();
  };
}
