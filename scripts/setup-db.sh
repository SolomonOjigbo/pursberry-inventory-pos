#!/usr/bin/env bash
# One-shot local database setup. Idempotent — safe to re-run.
#
#   ./scripts/setup-db.sh
#
# Assumes `pnpm infra:up` has brought Postgres up on port 5433 and that .env exists.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "No .env found. Copy .env.example to .env first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a && source .env && set +a

: "${DIRECT_DATABASE_URL:?DIRECT_DATABASE_URL must be set in .env}"

echo "==> Waiting for Postgres"
for _ in $(seq 1 30); do
  if psql "$DIRECT_DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then break; fi
  sleep 1
done
psql "$DIRECT_DATABASE_URL" -c 'SELECT 1' >/dev/null

echo "==> Creating the non-owner app role (RLS does not apply to owners)"
psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/sql/00_bootstrap_roles.sql

echo "==> Generating Prisma client"
pnpm db:generate

echo "==> Applying migrations"
pnpm --filter @pursberry/db exec prisma migrate deploy

echo "==> Re-granting on newly created tables"
psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/sql/00_bootstrap_roles.sql

echo "==> Applying RLS policies"
psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/prisma/sql/10_rls_policies.sql

echo "==> Seeding development data"
pnpm --filter @pursberry/db seed

echo "Done."
