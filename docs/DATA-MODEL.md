# Data model notes

`packages/db/prisma/schema.prisma` currently covers the Phase 1 tenancy spine only. This file records the shape the rest of plan §3 is expected to take and — more importantly — the invariants each group has to keep, so they don't get rediscovered halfway through a sprint.

## Rules that apply to every table

1. **Carry `tenant_id`** unless the table is platform-level (`subscription_plans`, `super_admin_users`). `users` is the deliberate exception: one human can belong to several tenants, and authorisation resolves through `memberships`, which _is_ scoped.
2. **Add an RLS policy in the same migration that creates the table**, and append the table name to the array in `prisma/sql/10_rls_policies.sql`. A table without a policy is readable across tenants.
3. **Index `tenant_id`**, and prefer composite indexes led by it — nearly every query filters on it first.
4. **Money is an integer column of minor units** (`Int`/`BigInt`), never `Float`.
5. **Quantities are stored in base units.** Packaging units are a presentation concern; conversion happens at the edge via `packages/shared/src/units.ts`.

## Groups still to land

### Product & Inventory (PROD-1xx, PROD-2xx)

`products`, `product_units`, `batches`, `shelf_locations`, `stock_levels`, `stock_movements`, `stock_transfers`.

- `stock_levels` is keyed on (product, **shelf_location**, batch), not (product, branch). Plan §4.3 tracks stock to a physical shelf slot so an offline sale decrements a specific location rather than a pooled branch total. A branch total is a `SUM`, not a stored column — storing both invites drift.
- `stock_movements` is append-only. Every level change is a movement; nothing edits a level directly. This is what makes a stocktake reconcilable and what SYNC-104 replays against.
- `batches` carries expiry + unit cost. FEFO deduction (PROD-202) orders by expiry across shelf locations, and FIFO COGS (PROD-205) reads cost from the same rows — one source, two consumers.

### Accounting (ACC-1xx, ACC-2xx)

`chart_of_accounts`, `journal_entries`, `journal_lines`, `fiscal_periods`, `tax_rates`.

- **No balance columns anywhere.** Trial Balance, P&L and Balance Sheet are aggregates over `journal_lines` (plan §4.4). A stored balance is a figure that can silently disagree with the transactions beneath it.
- Unbalanced entries must be rejected at write time (ACC-102), enforced in the posting function rather than trusted to callers.
- Posting is a side effect of an operational event, never a separate user action — a sale, GRN, payment or adjustment writes its journal entry in the same transaction that writes the operational rows. If the two can fail independently, they will.

### Sales & POS (POS-1xx)

`sales_orders`, `sales_lines`, `payments`, `refunds`, `pos_shifts`, `cash_drops`.

- The **client-generated UUID is the primary key**, assigned on the till at creation (plan §4.3). This is what makes sync idempotent: the server upserts on it, so a replayed outbox flush cannot double-count. Do not add a server-side surrogate key and treat the UUID as a secondary field.
- Store VAT per line (rate and amount as charged), not just a cart total. Rates change; a reprinted receipt from last year must show last year's rate.

### Sync (SYNC-1xx)

`sync_queue`, `device_registry`, `conflict_log`.

- Client timestamps are untrusted — tills drift and can be wrong by hours. Record both the client timestamp and the server receipt time. SYNC-104's "earlier sale wins" rule runs on the client timestamp because that is what reflects physical reality at the till, but a large client/server skew is itself a signal worth flagging into `conflict_log` for manual review (SYNC-105).

### Procurement (PROC-1xx)

`suppliers`, `vendor_contacts`, `purchase_orders`, `goods_received_notes`, `landed_costs`, `supplier_payments`.

- A GRN creates batches and posts a journal entry; landed cost (PROC-104) then adjusts unit cost, which means COGS for anything already sold from that batch needs a correcting entry rather than a silent restatement.
- Use `allocateByWeights()` from `packages/shared/src/money.ts` to spread landed cost, so the allocated parts sum exactly to the cost entered.

### Billing (BILL-1xx, BILL-2xx)

`tenant_subscriptions` (exists), `invoices`, usage counters.

- `first_use_date` is set once on first real usage and must never reset (BILL-104). Every cycle boundary derives from it, so a reset silently gives a tenant another free month.
- Cycles are anchored per tenant, not to a shared calendar month (BILL-202). The day-30 job sweeps tenants whose anchor has elapsed; it runs unscoped by necessity.
