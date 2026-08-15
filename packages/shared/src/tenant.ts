/**
 * Tenant context — the value that must be present on every request before any
 * tenant-scoped query runs, and that gets pushed into the Postgres session so
 * Row-Level Security can key off it (TEN-105, plan §2.1).
 */

import { z } from 'zod';

/** Tenant-facing roles (TEN-103). Super-admins are a separate hierarchy — see §4.9. */
export const TENANT_ROLES = ['OWNER', 'BRANCH_MANAGER', 'ACCOUNTANT', 'CASHIER'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

export const PLATFORM_ROLES = ['SUPER_ADMIN', 'SUPPORT'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const tenantContextSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(TENANT_ROLES),
  /** Null for tenant-wide (owner/accountant) sessions, set for till/branch staff. */
  branchId: z.string().uuid().nullable(),
});

export type TenantContext = z.infer<typeof tenantContextSchema>;

/** The Postgres session GUC that RLS policies read. Keep in sync with the SQL migration. */
export const TENANT_GUC = 'app.current_tenant_id';
