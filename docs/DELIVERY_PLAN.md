# PharmaCare Pro Delivery Plan (Production)

## Goal

Ship a production-grade offline-first pharmacy desktop app with stable billing, inventory, and reporting.

## Current Status (March 2026)

- M0 Repo Stabilization: completed (scaffold alignment, compile stability, CI workflow presence).
- M1 Auth + App Shell: completed and running.
- M2 Medicine Master: completed baseline (list/create/edit/detail/batches, barcode lookup, rack validation, low-stock + expiry indicators).
- M3 Billing Core: completed baseline (search/barcode add, cart GST/discounts, split payments, hold/restore, transactional save).
- M4 Purchase + Supplier + Customer: completed baseline (supplier/customer/doctor flows, purchase bills/POs/returns, email import pipeline, credit payment).
- M5 Reports + Audit + Backup: in progress (audit capture is active; reports and backup commands are pending implementation).
- M6 Hardening + Release: in progress (strict hard-check gates now green; runtime panic paths replaced with safe user-facing errors for unfinished modules).

### Phase 6 Snapshot

- Expiry dashboard and barcode-based expiry lookup are live.
- Expiry return workflow can now create supplier debit notes from selected batches.
- Remaining Phase 6 work: barcode bulk generation, label template design, printer queue management.

## Milestones

1. M0 - Repo Stabilization (Week 1)

- Fix scaffold mismatches and missing imports/modules.
- Ensure app compiles in dev mode.
- Ensure Tauri backend starts without missing command modules.
- Configure CI as required check for PRs.

2. M1 - Auth + App Shell (Week 2)

- Complete login/logout/session restore.
- Build layout shell (sidebar/header/routes).
- Add role-based navigation visibility.

3. M2 - Medicine Master (Weeks 3-4)

- Medicine CRUD and batch CRUD.
- Barcode lookup and rack validation.
- Low-stock and near-expiry indicators.

4. M3 - Billing Core (Weeks 5-7)

- Fast medicine search/barcode scan.
- Cart + discount + GST + payment modes.
- Atomic bill save transaction.
- Hold/restore bill, bill print baseline.

5. M4 - Purchase + Supplier + Customer (Weeks 8-10)

- Supplier CRUD and manual purchase entry.
- Customer profile and credit balance flows.

6. M5 - Reports + Audit + Backup (Weeks 11-12)

- Sales/purchase/stock/GST reports.
- Audit log report.
- Backup/restore UI and flow.

7. M6 - Hardening + Release (Weeks 13-14)

- Performance tuning for POS latency.
- Security pass and dependency audit.
- Signed release build pipeline and installers.

## Non-Negotiable Release Criteria

- No P0/P1 open defects.
- Billing save and cancel flows transaction-safe.
- Backup/restore validated with test dataset.
- CI green on lint/typecheck/tests.
- Signed installers generated for target platforms.

## Weekly Cadence

- Monday: Sprint planning + issue assignment.
- Daily: Issue updates + PRs.
- Friday: Demo + risk review + release decision.

## Metrics

- POS add-item latency under 100ms.
- Search response under 50ms on realistic dataset.
- Crash-free sessions over 99% during pilot.
