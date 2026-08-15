-- Run ONCE per database, as the owner/superuser, BEFORE the first migration.
--   psql "$DIRECT_DATABASE_URL" -f packages/db/prisma/sql/00_bootstrap_roles.sql
--
-- Why this exists: Postgres Row-Level Security is BYPASSED by superusers and by
-- the table owner unless FORCE ROW LEVEL SECURITY is set. If the API connects as
-- the same role that owns the tables, every policy written for TEN-105 is inert
-- and cross-tenant reads succeed. So the app gets its own non-owner role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pursberry_app') THEN
    -- Dev-only password; production provisions this out of band.
    CREATE ROLE pursberry_app LOGIN PASSWORD 'pursberry_dev';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE pursberry_dev TO pursberry_app;
GRANT USAGE ON SCHEMA public TO pursberry_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pursberry_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pursberry_app;

-- Tables created by future migrations get the same grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pursberry_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO pursberry_app;

-- Explicitly NOT granted: CREATE on schema public, and ownership of any table.
REVOKE CREATE ON SCHEMA public FROM pursberry_app;
