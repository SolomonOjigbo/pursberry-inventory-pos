-- TEN-105 — Row-Level Security.
--
-- Apply as the table OWNER, after migrations:
--   psql "$DIRECT_DATABASE_URL" -f packages/db/prisma/sql/10_rls_policies.sql
--
-- Long term this belongs inside the Prisma migration that creates each table:
--   pnpm --filter @pursberry/db exec prisma migrate dev --create-only --name <x>
--   ...then paste the matching block below into the generated migration.sql.
-- Keeping it out-of-band means a fresh `prisma migrate reset` leaves the
-- database with NO policies until this file is re-run — do not rely on that.
--
-- The session variable is set per transaction by withTenant() in
-- packages/db/src/index.ts. `current_setting(..., true)` returns NULL rather
-- than erroring when unset, and `tenant_id = NULL` is never true — so a
-- connection that forgot to set the tenant sees zero rows instead of everything.

CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

DO $$
DECLARE
  t text;
  tenant_scoped_tables text[] := ARRAY[
    'memberships',
    'branches',
    'warehouses',
    'tenant_subscriptions'
    -- APPEND EVERY NEW TENANT-SCOPED TABLE HERE (products, stock_levels,
    -- shelf_locations, batches, sales_orders, journal_entries, sync_queue, ...).
  ];
BEGIN
  FOREACH t IN ARRAY tenant_scoped_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- FORCE so the owner is subject to the policy too; without it, seeds and
    -- admin scripts quietly read across tenants and mask policy bugs.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = app_current_tenant_id())
         WITH CHECK (tenant_id = app_current_tenant_id())', t);
  END LOOP;
END
$$;

-- `tenants` keys on its own id rather than a tenant_id column.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
  USING (id = app_current_tenant_id())
  WITH CHECK (id = app_current_tenant_id());

-- Migrations and the provisioning path (TEN-101) must create tenants and look
-- users up by email BEFORE any tenant context exists, so they run as the owner
-- role over `tenants`/`users` with RLS bypassed via a dedicated connection.
-- `users` is deliberately NOT tenant-scoped: one human can belong to several
-- tenants, and authorisation is resolved through `memberships`, which IS scoped.

-- Platform tables (subscription_plans, super_admin_users) are intentionally not
-- under RLS — they are global and reachable only from the super-admin panel,
-- which authenticates against a separate role hierarchy (plan §4.9).
