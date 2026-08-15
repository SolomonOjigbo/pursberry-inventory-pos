# Pursberry

Multi-tenant SaaS POS, inventory and double-entry accounting for Nigerian retail and wholesale MSMEs.

- [Development plan](pursberry-development-plan.md) — architecture, scope decisions, phased delivery
- [Sprint backlog](pursberry-sprint-backlog.md) — ticket-level breakdown with acceptance criteria
- [Data model notes](docs/DATA-MODEL.md) — invariants every new table has to keep

## Layout

```
apps/
  api/       Node + Express + TypeScript. Auth, RBAC, tenant scoping, /sync.
  web/       React + Vite. Always-online surface (WEB-101).
  admin/     React + Vite. Super-admin panel — separate role hierarchy (BILL-102/103).
  desktop/   Electron POS terminal. Offline-first, local SQLite (POS-101, SYNC-101).
packages/
  shared/    Money, packaging units, VAT, tenant context. No I/O — pure and tested.
  db/        Prisma schema, RLS policies, seed.
  ui/        React components shared by web / admin / desktop.
```

## First run

Requires Node 22.12+ (`.nvmrc`), pnpm 10, Docker, and `psql` on PATH.

```bash
pnpm install
```

```bash
cp .env.example .env
```

Generate real secrets into `.env` before starting the API — `loadEnv()` rejects the placeholders:

```bash
printf 'JWT_ACCESS_SECRET=%s\nJWT_REFRESH_SECRET=%s\n' "$(openssl rand -base64 48)" "$(openssl rand -base64 48)"
```

Bring up Postgres and Redis:

```bash
pnpm infra:up
```

Create the app role, run migrations, apply RLS, seed:

```bash
./scripts/setup-db.sh
```

Then run whichever surface you're working on:

```bash
pnpm dev
```

| Command            | Surface                           |
| ------------------ | --------------------------------- |
| `pnpm dev`         | API on `:4000`                    |
| `pnpm dev:web`     | Web app on `:5173`                |
| `pnpm dev:admin`   | Super-admin panel on `:5174`      |
| `pnpm dev:desktop` | Electron POS (renderer on `5175`) |

Verify everything the way CI does:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Things worth knowing before you write code

**Postgres runs on 5433, not 5432.** The compose file deliberately avoids colliding with a local Postgres.app install.

**The API connects as `pursberry_app`, a non-owner role.** Row-Level Security is bypassed by superusers and by the table owner. If you point `DATABASE_URL` at the owner role, every RLS policy silently stops applying and cross-tenant reads succeed — which is exactly the failure TEN-105 exists to prevent. `DIRECT_DATABASE_URL` (owner) is only for migrations and seeding.

**Tenant-scoped queries go through `withTenant()`,** which opens a transaction and sets `app.current_tenant_id` with `SET LOCAL`. It has to be a transaction: with connection pooling a plain `SET` would leak one tenant's context onto whichever request reuses that connection next. `unscoped()` is the deliberate escape hatch and requires a written justification at the call site.

**Money is integer minor units (kobo), never a float.** See `packages/shared/src/money.ts`. A double-entry ledger that has to balance exactly cannot tolerate `0.1 + 0.2`. Use `allocate()` / `allocateByWeights()` for splits so the parts always sum back to the whole.

**VAT is computed per line, never on the cart total.** Staples and fresh produce are zero-rated, so a mixed cart has no single applicable rate. The rate lives in basis points (750 = 7.5%).

**Every new tenant-scoped table needs three things** in the same migration: a `tenant_id` column, an entry in the array in `packages/db/prisma/sql/10_rls_policies.sql`, and an index on `tenant_id`. A table without a policy is readable across tenants.

**Electron: the renderer stays sandboxed.** `better-sqlite3` lives in the main process; the renderer reaches it only through named IPC channels on the `pursberry` bridge. Never expose `ipcRenderer` or a generic `invoke(channel, ...)` passthrough.

## Known gaps in this scaffold

- **No Prisma migration has been generated yet** — the schema exists but `prisma migrate dev --name init` still needs a running database. RLS policies are staged in `packages/db/prisma/sql/` rather than folded into migration files; a `prisma migrate reset` will drop them, so re-run `scripts/setup-db.sh`.
- **`authenticate` (TEN-102) returns 501 by design.** It is a hard failure rather than a permissive stub so nothing gets built against an auth layer that does not exist.
- **The Prisma schema covers the Phase 1 tenancy spine only.** Product, inventory, accounting, POS, sync and procurement models land with their tickets — see [docs/DATA-MODEL.md](docs/DATA-MODEL.md).
- **`better-sqlite3` is installed but not yet wired up.** Running it under Electron needs `pnpm --filter @pursberry/desktop rebuild:native` first — the npm prebuild targets Node's ABI, not Electron's.
- **Plan prices are in USD.** `packages/db/prisma/seed.ts` converts at a hardcoded placeholder rate; the real NGN price list needs to replace it before BILL-101 ships.
