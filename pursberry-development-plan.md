# Pursberry — Development Plan
### Multi-Tenant SaaS POS, Inventory & Financial Accounting System for Nigerian Retail & Wholesale MSMEs

*(Formerly referred to as Octa App)*

**Target customers:** Nigerian supermarket chains (e.g. Shoprite, Justrite, Jendol), enterprise wholesalers, SMEs, and MSMEs — sold as a subscription, onboarding many independent businesses onto a shared platform.

---

## 1. Confirmed Requirements

| Area | Decision |
|---|---|
| Business model | Subscription SaaS, sold to many separate MSME tenants (not a single-client deployment) |
| Tenancy | Multi-tenant backend, shared infrastructure |
| Client platform | React codebase, packaged as an **Electron desktop app** (Windows/Mac) for in-store POS use, plus a **web version** for remote access and cloud backup |
| Accounting | Full double-entry ledger built in (Chart of Accounts, Journal Entries, GL, Trial Balance, Balance Sheet, P&L) |
| POS connectivity | Offline-first — local caching, queued transactions, auto-sync when online |
| Cross-tenant trade | None — tenants don't transact with each other. Instead, a robust internal **Purchase Order & vendor management system** per tenant |
| Tax | Basic VAT (7.5%) calculation at POS/invoices at launch. WHT tracking and FIRS e-invoicing are Phase 2 |
| Integrations (launch) | Nigerian payment gateways (Moniepoint/Paystack/Flutterwave/bank transfer) + POS hardware (thermal receipt printers, barcode scanners, cash drawers) |
| Integrations (Phase 2) | Weighing scales, dual customer-facing displays |
| Wholesale | Multi-unit packaging hierarchies (Carton → Pack → Unit) and batch/expiry (FEFO) tracking — both core at launch |
| Costing method | Per-tenant setting: Weighted Average by default; FIFO auto-enabled for tenants using batch/expiry tracking (see §5.4) |
| Oversell handling | Location-based shelf identifiers per product unit — stock is tracked to a physical shelf location, not just a SKU/branch total |
| Billing model | Post-paid monthly subscription across three tiers — Starter (~$20/mo), Growth (~$50/mo), Enterprise (custom, ~$150+/mo base + per-register/branch add-ons) — see §4.9 for full tier breakdown. First 30 days free, billing starts after day 30. SKU/transaction limits are soft caps; overage triggers an upgrade prompt with a 7-day grace period. Payment via saved cards or invoice-and-manual-transfer. Super-admin web panel manages plans, tenants, and billing |
| Onboarding | Self-service signup by default, with an assisted-setup path for large businesses needing bulk inventory migration |
| Payment gateways (priority) | Moniepoint and Paystack — Moniepoint in particular due to widespread use of Moniepoint POS terminals in the Nigerian market |
| Data migration | CSV/Excel import of current stock and product catalog only (no historical transactions) — sufficient scope for launch |

---

## 2. System Architecture

**Core principle:** multi-tenant on the backend (one shared platform, cheap to onboard and update), tenant-*scoped* — not tenant-*isolated* — on the client, with Electron providing a real embedded database for offline POS use.

```
                    ┌───────────────────────────────────────────────────┐
                    │                  CLIENT LAYER                      │
                    │                                                     │
                    │  ┌───────────────────┐    ┌───────────────────┐   │
                    │  │  Electron Desktop  │    │     Web App        │   │
                    │  │  (POS terminal)     │    │  (remote/admin)    │   │
                    │  │  React + TS shared  │    │  React + TS shared  │   │
                    │  │  UI codebase         │    │  UI codebase         │   │
                    │  │  Local SQLite cache  │    │  (no local cache;    │   │
                    │  │  + outbox/sync engine│    │   always online)     │   │
                    │  └──────────┬──────────┘    └──────────┬──────────┘   │
                    └─────────────┼──────────────────────────┼──────────────┘
                                  │                           │
                                  └────────────┬──────────────┘
                                                │
                    ┌───────────────────────────▼───────────────────────────┐
                    │                     API GATEWAY                        │
                    │   Node.js / Express / TypeScript                        │
                    │   Auth (JWT + refresh) · RBAC · Tenant scoping middleware│
                    │   Sync endpoint for offline queue reconciliation        │
                    └───────────────────────────┬───────────────────────────┘
                                                │
         ┌────────────────────────────────────────┼────────────────────────────────────────┐
         │                                        │                                        │
┌────────▼─────────┐                    ┌─────────▼─────────┐                    ┌─────────▼─────────┐
│ Inventory & Stock  │                    │ Sales, Billing &   │                    │ Double-Entry         │
│ Ledger Engine       │                    │ Purchase Order      │                    │ Financial Ledger      │
│ (batches, units)     │                    │ Engine               │                    │ (per-tenant CoA)       │
└────────┬─────────┘                    └─────────┬─────────┘                    └─────────┬─────────┘
         │                                        │                                        │
         └────────────────────────────────────────┼────────────────────────────────────────┘
                                                │
                    ┌───────────────────────────▼───────────────────────────┐
                    │                       DATA LAYER                        │
                    │   PostgreSQL (Prisma ORM), every table carries          │
                    │   `tenant_id`, enforced via Row-Level Security          │
                    │   Redis — session cache, sync queue, rate limiting      │
                    └───────────────────────────────────────────────────────┘
```

### 2.1 Why multi-tenant, shared database + Row-Level Security
- One codebase, one deployment, one migration path — critical for a subscription product where you're onboarding tenants continuously and shipping features to everyone at once.
- Every table carries `tenant_id`; **Postgres Row-Level Security** enforces isolation at the database layer, so a bug in application query logic can't leak one business's data into another's.
- Database-per-tenant or schema-per-tenant remains an escape hatch for a future large chain tenant that demands stronger isolation guarantees — moving a single tenant to its own database later is a targeted migration, not a redesign.

### 2.2 Why Electron for the POS client
- Electron wraps the same React/TypeScript UI used on the web, but adds full filesystem and native-module access — enough to run a real embedded database (SQLite via `better-sqlite3`) on the till machine instead of browser storage (IndexedDB), which is more robust for an offline-first POS under real-world Nigerian connectivity conditions.
- Each Electron install logs into one tenant's account against the shared multi-tenant backend — it's *tenant-scoped* (shows only that business's data), not *tenant-isolated* at the infrastructure level. Isolation is enforced server-side by RLS, not by having separate installs.
- The web app reuses the same UI components without the local DB/offline layer — it's the "always-online" surface for remote access, reporting, and as the durable cloud copy Electron clients sync up to.

---

## 3. Core Data Model (high level)

- **Tenant/Org:** `tenants`, `subscriptions`, `branches`, `warehouses`, `users`, `roles`, `permissions` — all scoped by `tenant_id`
- **Product & Inventory:** `products`, `product_units` (Carton/Pack/Unit conversions), `batches` (expiry, FEFO), `shelf_locations` (aisle/rack/bin per branch), `stock_levels` (per branch/warehouse/shelf location), `stock_movements`, `stock_transfers`
- **Platform/Billing:** `subscription_plans`, `tenant_subscriptions`, `invoices`, `super_admin_users` — managed via a dedicated super-admin panel, separate from tenant-facing roles
- **Sales:** `sales_orders`, `sales_lines`, `payments`, `refunds`, `pos_shifts`, `cash_drops`
- **Procurement & Vendors:** `suppliers`, `vendor_contacts`, `purchase_orders`, `goods_received_notes`, `landed_costs`, `supplier_payments`
- **Accounting:** `chart_of_accounts` (per-tenant, seeded from a default template), `journal_entries`, `journal_lines`, `fiscal_periods`, `tax_rates`
- **Sync:** `sync_queue`, `device_registry`, `conflict_log`

---

## 4. Key Engineering Challenges & Approach

### 4.1 Multi-unit packaging (Carton → Pack → Unit)
- Each product has a **base unit** (smallest stockable unit) and a `product_units` table defining conversion factors (e.g. 1 Carton = 12 Packs = 120 Units).
- Stock is always stored internally in base units; POS and purchase-order UIs let staff sell/receive in any defined unit, converting on the fly.

### 4.2 Batch/expiry tracking with FEFO
- Every goods-received line creates a `batches` record (batch number, expiry date, quantity, unit cost).
- Stock deduction on sale automatically selects the batch with the nearest expiry date first (FEFO), across base-unit-converted quantities.
- Near-expiry alerts and an expiry/waste report ship as part of the inventory module from day one.

### 4.3 Offline-first POS (Electron + SQLite)
- The Electron client stores product catalog, prices, and stock snapshots locally, refreshed periodically, plus a local **outbox** of unsynced transactions.
- Each offline sale gets a client-generated UUID and timestamp at creation, giving it a stable identity before it ever reaches the server.
- On reconnect, the client flushes the outbox to a `/sync` endpoint; the server applies transactions idempotently (keyed by UUID) and returns authoritative stock levels back down.
- **Oversell handling via shelf-location tracking:** rather than treating stock as one pooled number per SKU per branch, each unit is tracked against a `shelf_locations` record (aisle/rack/bin). A sale decrements stock at the specific shelf location it was picked from, not from a branch-wide total. This narrows — though doesn't fully eliminate — the offline double-sell window, since two tills within the same branch are less likely to be drawing from the same physical shelf slot simultaneously; it also gives staff a real answer to "where is this item" during stocktakes and fulfillment.
- **Cross-branch oversell resolution:** if two separate branches sell the same SKU while both offline and the resulting stock goes negative after sync, an **automated rule** resolves it: the earlier-timestamped sale is honored, and the later sale is automatically converted to a backorder/short-pick for staff to fulfil from the next restock. A **manual-resolution screen** is available for edge cases the automated rule doesn't handle cleanly (e.g. disputed timestamps, high-value items).

### 4.4 Double-entry ledger integration
- Every event with financial consequence (sale, stock adjustment, purchase, payment, refund) triggers an automatic, balanced journal entry against that tenant's Chart of Accounts — never a direct balance update.
- Trial Balance, P&L, and Balance Sheet become SQL views/reports over `journal_lines`, rather than separately maintained figures that can drift from operational data.
- Chart of Accounts is seeded per-tenant from a default retail/wholesale template on signup, editable per business.

### 4.5 Costing method — per-tenant configurable
- **Weighted Average Cost (WAC)** — default for simple retail tenants without batch tracking. Recalculates a blended average cost on each goods-received event; simple, smooths price volatility.
- **FIFO** — auto-enabled for any tenant using batch/expiry (FEFO) tracking, since the batch records driving physical stock deduction already carry the cost data needed for FIFO COGS. No separate averaging logic needed, and it's IFRS-compliant (relevant if a tenant needs audited financials).
- LIFO is excluded — not IFRS-compliant, and IFRS is the standard Nigeria follows.

### 4.6 VAT at POS
- Product-level VAT flag (VAT-able vs. exempt, since staples/fresh produce are typically zero-rated).
- 7.5% computed at checkout, itemized on receipts/invoices, posted to a dedicated VAT-payable ledger account per tenant for filing.

### 4.7 Purchase Order & vendor management
- Full PO lifecycle per tenant: draft → sent to vendor → partially/fully received (goods-received note) → matched against invoice → vendor payment.
- Vendor records carry contact info, payment terms, and credit history; PO receiving feeds directly into `batches` and `landed_costs`, keeping procurement, inventory, and accounting in sync.

### 4.8 Payment gateway & hardware integration
- **Moniepoint and Paystack are the launch priority**, ahead of Flutterwave — Moniepoint specifically because of how widely its physical POS terminals are already used by Nigerian retail/wholesale businesses, so integrating with it (transaction webhooks, reconciliation) meets merchants where they already are rather than asking them to switch payment hardware.
- Gateways integrated per-tenant via their APIs/webhooks; bank-transfer reconciliation via virtual accounts where the provider supports it. Flutterwave and other providers can follow in a later phase.
- Hardware (receipt printers, barcode scanners, cash drawers) integrated through Electron's native module access — a real advantage over the earlier PWA/browser approach, since thermal printers and cash drawers generally need native USB/serial access that browsers restrict.

### 4.9 Subscription billing & super-admin panel
- A separate **super-admin web panel** (not part of the tenant-facing app) for the Pursberry team to create/edit subscription plans, view and manage tenants, and handle billing — distinct role hierarchy from tenant admins/staff.
- **Pricing tiers:**

| Tier | Base Fee | Limits | Key Features |
|---|---|---|---|
| Starter | ~$20/mo | 1 register, up to 2,500 active SKUs, up to 1,000 POS transactions/month | Core POS, local inventory, quotations & invoicing, basic reports |
| Growth | ~$50/mo | Up to 3 registers, 10,000 SKUs, up to 5,000 transactions/month | Cloud backups, multi-branch/warehouse transfers, advanced reporting |
| Enterprise | Custom, ~$150+/mo base | Unlimited registers/SKUs/transactions, multi-branch network access | Base plan covers 1 branch/register; additional branches/registers billed at $20–40/mo each |

  SKU and transaction-volume limits act as **soft caps** — the intent is to nudge a growing tenant from Starter toward Growth or Enterprise as they approach their tier's ceiling, rather than to hard-cut them off (consistent with the upgrade-prompt-plus-grace-period enforcement below).
- **Billing is post-paid:** a tenant's first 30 days of use are free (no card/payment required to onboard). At the end of day 30, the system **immediately charges the tenant** based on usage accrued during that first 30-day window — it's a trigger-at-day-30 event, not a wait for a fixed monthly billing date. Practically, this means the billing engine needs a per-tenant `first_use_date`, a scheduled job (or event) that fires exactly 30 days later to compute and charge usage, and then a recurring cycle from that anchor date going forward (i.e. each tenant's billing cycle is anchored to their own signup date, not a shared calendar-month cycle across all tenants).
- **Plan enforcement:** exceeding a tier's branch/SKU/transaction limit triggers an upgrade prompt and a **7-day grace period** before any restriction applies — long enough to not disrupt daily sales, short enough to push a genuine upgrade decision.
- **Payment collection:** two paths — **saved cards** (charged automatically after the free period or at each billing cycle) and **invoice-and-manual-transfer** (an invoice is generated and the tenant pays via bank transfer, reconciled manually or via virtual account). This is separate from the Moniepoint/Paystack integration used for in-store customer payments — though Paystack's recurring-billing/card-tokenization APIs are a reasonable fit for the saved-card path, worth confirming during Phase 1 billing design.

### 4.10 Data migration tooling
- **Launch scope: CSV/Excel import of current stock and product catalog only** — no historical sales or accounting transactions. This keeps the import pipeline focused on getting a tenant's live inventory into Pursberry accurately, without the added complexity of reconciling imported historical transactions against the double-entry ledger (which would require validating an entire external accounting history, not just current state).
- The import pipeline maps external product and stock records into Pursberry's schema — product catalog, quantities, and (if available) unit-of-measure/pricing data.
- Needs to handle unit conversions and shelf-location assignment during import, since most competing systems won't have either concept — sensible defaults (e.g. a single "unassigned" shelf location per branch) let migrated stock land in a valid state before staff refine it.
- Direct connectors to specific competitor systems are out of scope for launch; CSV/Excel is sufficient. Named-system connectors can be revisited later if a specific migration source proves common enough to justify the engineering investment.

### 4.11 Onboarding: self-service vs. assisted
- **Self-service:** a business signs up, picks a plan, and configures its own branches, products, and Chart of Accounts template through guided setup screens — no Pursberry staff involvement required. The free 30-day window applies here too, letting a business trial the product before any billing commitment.
- **Assisted setup:** offered for larger businesses, centered on the CSV/Excel data migration tooling above — Pursberry staff (or a guided wizard) help import a business's current stock and product catalog from its prior system.

---

## 5. Phased Delivery Plan

### Phase 1 — Foundation (Sprints 1–3)
- Multi-tenant auth, RBAC, tenant/branch/warehouse setup
- Subscription plan schema (branch-count + volume tiers, post-paid/30-day-free logic) and super-admin panel (plan management, tenant list, basic billing view)
- Product catalog + multi-unit packaging model + shelf-location model
- Chart of Accounts template + journal engine (core double-entry primitives)
- Base PostgreSQL schema + Prisma models with Row-Level Security

### Phase 2 — Core POS (Sprints 4–6)
- Electron shell + shared React UI; SQLite local store
- POS checkout UI (barcode scan, cart, multi-payment split), shelf-location-aware stock deduction
- Offline-first caching + sync engine (outbox pattern, idempotent replay, automated cross-branch conflict rule + manual-resolution screen)
- Cash drawer / receipt printer / barcode scanner integration via Electron
- Payment gateway integration: Moniepoint and Paystack first
- VAT calculation at checkout

### Phase 3 — Inventory, Procurement & Onboarding (Sprints 7–9)
- Batch/expiry tracking + FEFO deduction logic, integrated with shelf locations
- Stock transfers between a tenant's branches/warehouses
- Purchase Order & vendor management module, goods-received notes, landed cost
- Per-tenant costing method setting (WAC / FIFO)
- Self-service onboarding wizard + CSV/Excel import (current stock & product catalog) for assisted setup

### Phase 4 — Financial Reporting (Sprints 10–11)
- Trial Balance, General Ledger view, Balance Sheet, P&L, Cash Flow — per tenant
- AR/AP: customer statements, aging reports, supplier credit tracking
- VAT report for filing

### Phase 5 — Web App & Cloud Backup (Sprints 12–13)
- Web version of the shared UI (always-online, no local cache)
- Cloud backup/restore flow for Electron installs
- Remote multi-branch reporting dashboards for owners/accountants

### Phase 6 — Hardening & Rollout (Sprints 14–15)
- Multi-tenant load and offline-sync stress testing
- Assisted-onboarding tooling refinement (staff-facing import/validation UI) alongside pilot tenant rollout, staff training materials, feedback loop
- WHT tracking + FIRS e-invoicing groundwork (Phase 2 tax scope, design starts here)

---

## 6. Remaining Scope Question

Every open question raised through this planning process is now resolved (see §1, §4.3, and §4.9). No new scope questions are outstanding — the pricing structure, oversell conflict rule, billing model, and migration scope are all settled. The next step is breaking this into ticket-level sprint backlogs.

---

*Next step: with core scope settled, this can be broken into ticket-level sprint backlogs per module.*
