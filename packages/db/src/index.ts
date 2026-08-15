import { PrismaClient } from '../generated/client/index.js';

export * from '../generated/client/index.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Shared client. Reused across hot reloads so dev doesn't exhaust the pool.
 * Connects as the NON-OWNER app role (DATABASE_URL) so RLS applies.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Kept in sync with app_current_tenant_id() in prisma/sql/10_rls_policies.sql. */
const TENANT_GUC = 'app.current_tenant_id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TenantScopeError extends Error {}

/**
 * Run `fn` inside a transaction with the tenant GUC set, so every statement it
 * issues is filtered by the RLS policies.
 *
 * It MUST be a transaction: `SET LOCAL` is scoped to the transaction, and
 * connection pooling means a plain `SET` would leak one tenant's context onto
 * the next request that happens to reuse the connection. That is the exact
 * cross-tenant leak TEN-105 exists to prevent — do not "optimise" this away.
 *
 *   const branches = await withTenant(ctx.tenantId, (tx) => tx.branch.findMany());
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (
    tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>,
  ) => Promise<T>,
  client: PrismaClient = prisma,
): Promise<T> {
  // Validated rather than interpolated blindly: set_config takes text, so a
  // malformed value would otherwise reach the cast in app_current_tenant_id().
  if (!UUID_RE.test(tenantId)) {
    throw new TenantScopeError(`Refusing to open a tenant scope for invalid id "${tenantId}"`);
  }

  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config(${TENANT_GUC}, ${tenantId}, true)`;
    return fn(tx);
  });
}

/**
 * Escape hatch for the few paths that legitimately run before a tenant exists:
 * tenant provisioning (TEN-101), login by email (TEN-102), super-admin panel
 * queries, and the day-30 billing job (BILL-201) which sweeps all tenants.
 * Every use is a deliberate RLS bypass — justify it at the call site.
 */
export function unscoped(reason: string): PrismaClient {
  if (!reason.trim()) {
    throw new TenantScopeError('unscoped() requires a written justification');
  }
  return prisma;
}
