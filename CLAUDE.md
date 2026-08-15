# Pursberry — working notes

Multi-tenant POS + inventory + double-entry accounting for Nigerian MSMEs. Scope lives in [pursberry-development-plan.md](pursberry-development-plan.md); tickets and acceptance criteria in [pursberry-sprint-backlog.md](pursberry-sprint-backlog.md). Reference ticket IDs (`TEN-105`, `POS-104`, …) in commits and comments.

## Commands

| Task              | Command                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| Install           | `pnpm install`                                                                |
| Full verify (CI)  | `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build` |
| Single package    | `pnpm --filter @pursberry/shared test`                                        |
| Infra up/down     | `pnpm infra:up` / `pnpm infra:down`                                           |
| DB from scratch   | `./scripts/setup-db.sh`                                                       |
| After schema edit | `pnpm db:generate`                                                            |

Postgres is on **5433** (avoiding a local Postgres.app on 5432). Redis on 6379.

## Non-negotiables

**Tenant isolation.** Tenant-scoped reads/writes go through `withTenant()` in `packages/db/src/index.ts`. It opens a transaction and sets `app.current_tenant_id` via `SET LOCAL` — it must stay a transaction, or pooled connections leak one tenant's context into the next request. `unscoped()` requires a written justification. The tenant id comes from the verified access token only, never from a header or body — a client-supplied `X-Tenant-Id` would make RLS faithfully serve the wrong tenant.

**The app connects as a non-owner role.** Owners and superusers bypass RLS. `DATABASE_URL` = `pursberry_app`; `DIRECT_DATABASE_URL` = owner, migrations and seeding only.

**Money is integer minor units.** `packages/shared/src/money.ts`. No floats in prices, costs, tax or ledger amounts. Split with `allocate()` / `allocateByWeights()` so parts sum exactly to the whole.

**Stock is stored in base units,** converted at the edge (`packages/shared/src/units.ts`). Stock levels key on shelf location, not branch; a branch total is a `SUM`.

**No stored balances in accounting.** Reports aggregate `journal_lines`. Journal entries post in the same transaction as the operational rows that caused them.

**Offline sales are keyed by client-generated UUID.** That key is what makes `/sync` idempotent — never replace it with a server surrogate.

**Electron renderer stays sandboxed.** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. SQLite lives in the main process, reached only via named IPC on the `pursberry` bridge. Never expose `ipcRenderer` or a generic channel passthrough.

## Conventions

- TypeScript strict throughout, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. Access `process.env` with bracket notation.
- ESM everywhere except the Electron main/preload processes (CommonJS, `tsconfig.electron.json`). Relative imports carry the `.js` extension.
- `packages/shared` is pure — no I/O, no Prisma, no React. It is the one place both server and till agree on domain rules, so it stays testable in isolation.
- Comments explain _why_, especially where the safe-looking simplification is wrong. Don't narrate what the code already says.
- Adding a tenant-scoped table means: `tenant_id` column + index, an entry in `packages/db/prisma/sql/10_rls_policies.sql`, and a test that a wrong-tenant context returns zero rows.

## Current state

Scaffold only. `authenticate` (TEN-102) returns 501 by design; no Prisma migration has been generated yet; the schema covers the Phase 1 tenancy spine and nothing else. See "Known gaps" in [README.md](README.md).
