# Pursberry — Sprint Backlog
### Ticket-level breakdown of the Phased Delivery Plan, organized by module

Ticket IDs are prefixed by module for traceability: `TEN` (Tenant/Platform), `PROD` (Product/Inventory), `ACC` (Accounting), `POS` (POS/Checkout), `SYNC` (Offline/Sync), `PROC` (Procurement/PO), `PAY` (Payments), `BILL` (Subscription/Billing), `MIG` (Data Migration), `WEB` (Web App), `OPS` (Hardening/Rollout).

Each ticket includes a one-line scope and acceptance criteria a QA pass would check against — refine estimates once the team is assembled.

---

## Phase 1 — Foundation (Sprints 1–3)

### Module: Tenant & Platform Core
- **TEN-101 — Tenant provisioning schema.** Create `tenants` table + provisioning flow (create tenant, assign initial admin user). *AC: a new tenant record exists with a unique ID and an owner user before any other data can be written for it.*
- **TEN-102 — Auth: signup, login, JWT + refresh tokens.** *AC: a user can register, log in, and stay authenticated across a token refresh without re-entering credentials.*
- **TEN-103 — RBAC roles & permissions.** Define role set (Owner, Branch Manager, Cashier, Accountant, minimum) and permission checks on API routes. *AC: a Cashier role cannot access accounting or user-management endpoints.*
- **TEN-104 — Branch & warehouse setup.** CRUD for `branches`, `warehouses` scoped to tenant. *AC: creating a branch under Tenant A is invisible to Tenant B.*
- **TEN-105 — Row-Level Security enforcement.** Apply Postgres RLS policies keyed on `tenant_id` across core tables. *AC: a direct query without the correct tenant context returns zero rows, even with a valid but wrong-tenant session.*

### Module: Product & Inventory Foundations
- **PROD-101 — Product catalog CRUD.** Base product model (name, SKU, category, VAT flag). *AC: product create/edit/list scoped correctly per tenant/branch.*
- **PROD-102 — Multi-unit packaging model.** `product_units` table + conversion factors (Carton→Pack→Unit). *AC: defining 1 Carton = 12 Packs = 120 Units correctly converts stock quantities entered in any unit to base-unit storage.*
- **PROD-103 — Shelf-location model.** `shelf_locations` table (aisle/rack/bin) per branch, linked to `stock_levels`. *AC: stock for a SKU can be split across multiple shelf locations within one branch and sums correctly to a branch total.*

### Module: Accounting Foundations
- **ACC-101 — Chart of Accounts template.** Default retail/wholesale CoA seeded per tenant on signup, editable. *AC: a new tenant has a working CoA (Assets/Liabilities/Equity/Revenue/COGS) without manual setup.*
- **ACC-102 — Journal entry engine.** Core primitive: post balanced `journal_entries`/`journal_lines`; reject unbalanced entries. *AC: attempting to post a journal entry where debits ≠ credits fails validation.*

### Module: Platform/Billing Foundations
- **BILL-101 — Subscription plan schema.** `subscription_plans` with branch-count and volume-tier fields (Starter/Growth/Enterprise). *AC: each plan stores its register/SKU/transaction limits and base fee.*
- **BILL-102 — Super-admin panel: plan management.** Web UI (separate role hierarchy) to create/edit plans. *AC: a super-admin can create a new plan tier without a deploy.*
- **BILL-103 — Super-admin panel: tenant list & basic billing view.** *AC: super-admin can see all tenants, their current plan, and `first_use_date`.*
- **BILL-104 — `first_use_date` tracking.** Set on tenant's first real usage (not just signup) to anchor the 30-day free window. *AC: field is set once and doesn't reset on subsequent logins.*

---

## Phase 2 — Core POS (Sprints 4–6)

### Module: POS/Checkout
- **POS-101 — Electron shell + shared React UI bootstrap.** Package the web UI into an Electron app targeting Windows/Mac. *AC: same component tree renders in both Electron and browser builds.*
- **POS-102 — Barcode-driven checkout cart.** Scan/add items, quantity adjust, remove line. *AC: scanning a known barcode adds the correct product/unit to cart.*
- **POS-103 — Multi-payment split.** Support Cash + gateway payment on one sale. *AC: a sale can be paid partly by cash, partly by card, summing to the total.*
- **POS-104 — Shelf-location-aware stock deduction.** Checkout decrements stock at the specific shelf location picked from, not just branch total. *AC: selling from Shelf A doesn't affect Shelf B's recorded quantity for the same SKU.*
- **POS-105 — VAT calculation at checkout.** Apply 7.5% to VAT-able line items only; itemize on receipt. *AC: a cart with mixed VAT-able and VAT-exempt items computes tax correctly per line.*
- **POS-106 — Cash drawer / receipt printer / barcode scanner integration.** Native hardware bridge via Electron. *AC: completing a sale opens the cash drawer and prints a receipt on connected hardware.*

### Module: Offline/Sync
- **SYNC-101 — Local SQLite store setup.** Embed `better-sqlite3` in Electron; schema mirrors server-side product/stock/price essentials. *AC: app launches and displays catalog with no network connection.*
- **SYNC-102 — Outbox pattern for offline transactions.** Client-generated UUID + timestamp per offline sale, queued locally. *AC: a sale made offline persists locally and survives an app restart before syncing.*
- **SYNC-103 — Sync endpoint: idempotent replay.** Server accepts queued transactions keyed by UUID, ignores duplicates. *AC: replaying the same synced transaction twice does not double-count stock or sales.*
- **SYNC-104 — Cross-branch conflict rule (automated).** On sync, if resulting stock at a shared SKU goes negative across branches, honor the earlier-timestamped sale and flag the later one as backorder. *AC: two offline branches selling the last unit of a SKU resolve deterministically to one fulfilled sale + one backorder, matching timestamp order.*
- **SYNC-105 — Manual conflict resolution screen.** UI for staff to review/override flagged conflicts SYNC-104 doesn't cleanly resolve. *AC: a flagged conflict appears in a review queue and can be manually reassigned.*

### Module: Payments
- **PAY-101 — Moniepoint integration.** API/webhook integration for in-store transactions. *AC: a Moniepoint terminal payment reflects as completed on the POS sale within expected latency.*
- **PAY-102 — Paystack integration.** Card/transfer payment support at checkout. *AC: a Paystack transaction completes and reconciles against the sale record.*

---

## Phase 3 — Inventory, Procurement & Onboarding (Sprints 7–9)

### Module: Product & Inventory
- **PROD-201 — Batch/expiry tracking.** `batches` table (batch number, expiry, quantity, unit cost) created on goods-received. *AC: receiving stock with an expiry date creates a traceable batch record.*
- **PROD-202 — FEFO deduction logic.** Sales/stock deduction automatically selects nearest-expiry batch first, across shelf locations. *AC: selling a SKU with two batches of differing expiry deducts from the soonest-expiring batch first.*
- **PROD-203 — Near-expiry alerts & waste report.** Configurable threshold (e.g. 7/14/30 days) triggers alerts; report of expired/wasted stock. *AC: a batch within the alert threshold surfaces in a dashboard notification.*
- **PROD-204 — Stock transfers between branches/warehouses.** Transfer request → in-transit → received flow. *AC: stock leaves the source branch's total and only lands in the destination after a receive action, not on transfer creation.*
- **PROD-205 — Per-tenant costing method setting.** Toggle WAC (default) vs. FIFO (auto-suggested when batch tracking is enabled). *AC: switching a tenant to FIFO uses batch-level cost data for COGS on subsequent sales.*

### Module: Procurement/PO
- **PROC-101 — Vendor management.** CRUD for `suppliers` (contact info, payment terms, credit history). *AC: a vendor record can be created and linked to purchase orders.*
- **PROC-102 — Purchase Order lifecycle.** Draft → sent → partially/fully received → matched → paid. *AC: a PO's status updates correctly through each stage and blocks invalid transitions (e.g. paying an unreceived PO).*
- **PROC-103 — Goods-received note (GRN).** Receiving against a PO creates batch(es) and updates stock/shelf location. *AC: a GRN for a PO line creates the correct batch and increments stock at the assigned shelf location.*
- **PROC-104 — Landed cost allocation.** Distribute shipping/duty/other costs across received line items. *AC: landed cost entered on a GRN adjusts unit cost used for COGS.*

### Module: Data Migration & Onboarding
- **MIG-101 — CSV/Excel import pipeline (product catalog + current stock).** Upload, field mapping, validation, error reporting. *AC: a correctly formatted CSV imports product and stock records into the tenant's catalog; a malformed file surfaces row-level errors rather than failing silently.*
- **MIG-102 — Import defaults for unit/shelf-location gaps.** Auto-assign base unit and an "unassigned" shelf location where the source data lacks them. *AC: an imported product with no unit info lands in a valid, sellable state.*
- **TEN-201 — Self-service onboarding wizard.** Guided setup: plan selection, branch creation, CoA confirmation, first products. *AC: a new tenant can go from signup to first sale without staff assistance.*
- **TEN-202 — Assisted-setup flow trigger.** Flag/route larger tenants to a staff-assisted onboarding path centered on MIG-101. *AC: a tenant marked "assisted" surfaces in an internal queue for staff follow-up.*

---

## Phase 4 — Financial Reporting (Sprints 10–11)

### Module: Accounting
- **ACC-201 — Trial Balance report.** Sum of debits/credits per account, per tenant, per period. *AC: Trial Balance always sums to zero across all accounts.*
- **ACC-202 — General Ledger view.** Drill-down of journal lines per account. *AC: GL entries reconcile exactly with source transactions (sales, purchases, adjustments).*
- **ACC-203 — Balance Sheet.** Generated from CoA balances as of a date. *AC: Assets = Liabilities + Equity for any generated Balance Sheet.*
- **ACC-204 — Profit & Loss statement.** Revenue/COGS/Expenses over a period. *AC: P&L figures match the sum of underlying sales and COGS journal entries for that period.*
- **ACC-205 — Cash Flow statement.** Derived from cash-account movements. *AC: closing cash balance matches the cash account's ledger balance.*
- **ACC-206 — AR/AP: customer statements & aging.** Outstanding receivables/payables with aging buckets. *AC: an overdue invoice correctly appears in the 30/60/90-day aging bucket.*
- **ACC-207 — Supplier credit tracking.** Credit limits and outstanding balances per vendor. *AC: a PO exceeding a vendor's credit limit is flagged before submission.*
- **ACC-208 — VAT report for filing.** Aggregate VAT collected per period from the VAT-payable ledger account. *AC: report total matches the sum of VAT line items across all sales in the period.*

---

## Phase 5 — Web App & Cloud Backup (Sprints 12–13)

### Module: Web App
- **WEB-101 — Web build of shared UI (always-online).** Same React components, no local SQLite/offline layer. *AC: core POS/inventory/accounting screens render and function correctly in a browser without Electron.*
- **WEB-102 — Remote multi-branch reporting dashboard.** Owner/accountant view aggregating data across branches. *AC: dashboard totals match the sum of individual branch reports.*

### Module: Sync/Backup
- **SYNC-201 — Cloud backup flow for Electron installs.** Periodic backup of local state to the cloud copy. *AC: killing and reinstalling the Electron app on a new machine restores tenant data from the cloud backup.*
- **SYNC-202 — Restore flow.** Manual restore trigger from a selected backup point. *AC: restore completes without data corruption and reconciles with server state.*

---

## Phase 6 — Hardening & Rollout (Sprints 14–15)

### Module: Platform/Ops
- **OPS-101 — Multi-tenant load testing.** Simulate concurrent tenants/branches under load. *AC: system meets defined latency/throughput targets at target tenant volume.*
- **OPS-102 — Offline-sync stress testing.** Simulate extended offline periods + high-volume sync-on-reconnect. *AC: no data loss or duplicate transactions after a large queued-transaction sync.*
- **OPS-103 — Assisted-onboarding tooling refinement.** Staff-facing import/validation UI polish based on Phase 3 pilot feedback. *AC: staff can resolve a failed import row without engineering involvement.*
- **OPS-104 — Pilot tenant rollout + feedback loop.** Onboard a small set of real tenants, track issues. *AC: defined pilot exit criteria (e.g. N tenants live for M days with no P0/P1 bugs) are met before general rollout.*
- **OPS-105 — Staff training materials.** Onboarding docs/videos for internal support and self-service tenants. *AC: materials cover signup through first successful sale and first PO cycle.*

### Module: Billing (finalize)
- **BILL-201 — Day-30 immediate charge trigger.** Scheduled job fires at `first_use_date + 30 days`, computes usage-based charge, initiates payment. *AC: a tenant is charged automatically and immediately at the 30-day mark, not on a shared calendar-month cycle.*
- **BILL-202 — Per-tenant billing cycle anchoring.** Subsequent billing cycles recur every 30 days from each tenant's own anchor date. *AC: two tenants who signed up on different dates are billed on their own independent 30-day cycles.*
- **BILL-203 — Soft-cap overage detection.** Monitor branch/SKU/transaction usage against plan limits. *AC: crossing a limit triggers an upgrade-prompt notification.*
- **BILL-204 — 7-day grace period enforcement.** No restriction for 7 days post-overage; review what (if anything) restricts after. *AC: a tenant over their limit can continue normal operations for exactly 7 days before any enforcement action.*
- **BILL-205 — Saved card payment collection.** Tokenized card charge at day-30 and each subsequent cycle. *AC: a tenant with a saved card is charged automatically without manual intervention.*
- **BILL-206 — Invoice-and-manual-transfer flow.** Generate invoice, tenant pays via bank transfer, manual/virtual-account reconciliation. *AC: an invoice is marked paid once a matching transfer is reconciled.*
- **ACC-301 — WHT tracking groundwork.** Design-only in this phase — data model for Withholding Tax on corporate POs, ahead of full Phase-2-tax build-out.
- **ACC-302 — FIRS e-invoicing groundwork.** Design-only in this phase — research integration requirements ahead of full build-out.

---

## Notes for Sprint Planning
- Tickets within a module are listed in a sensible build order but aren't strictly sequential across modules — e.g. `SYNC-101` (local store) can start alongside `POS-101` (Electron shell) rather than waiting for all of `TEN-1xx` to close.
- Acceptance criteria above are a starting point for QA test cases, not exhaustive — expect them to grow once tickets are pulled into a sprint.
- `ACC-301`/`ACC-302` are intentionally scoped as design-only in Phase 6; their full implementation isn't sized here since it falls under the previously deferred WHT/FIRS e-invoicing tax scope.
