# Production Readiness Checklist

Last Updated: 2026-03-12
Owner: Solo
Status Legend: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`

## How To Use

- Pick one item at a time (top-down by priority).
- Implement fully.
- Validate with build/tests/manual checks listed under each item.
- Mark `DONE` only when acceptance criteria are all met.

## P0 (Launch Blockers)

1. `IN_PROGRESS` Real Printer Discovery + Mapping

- Scope:
  - Detect actual installed printers per OS.
  - Keep configured defaults for thermal/normal/barcode printer selection.
  - Ensure Billing print and printer test use real targets.
- Acceptance Criteria:
  - Printer list includes real system printers (where available).
  - Settings can persist default printer names.
  - Print commands respect explicit printer and fallback to saved default.
  - Queue status updates (`queued/sent/failed`) correctly for bill/test/retry.
- Validation:
  - `cargo check`
  - `npm run build`
  - Manual: Settings save + Billing print + retry failed print.
- Progress Note:
  - Implemented OS-level printer detection (`Get-Printer` on Windows, `lpstat -a` on Linux/macOS-like CUPS setups).
  - Pending final manual verification on Windows host printer inventory.

2. `IN_PROGRESS` True Thermal ESC/POS Pipeline

- Scope:
  - Raw ESC/POS output path with width profiles (58/80 mm).
  - Cut command support where supported.
  - Better alignment and multilingual safety.
- Acceptance Criteria:
  - Thermal receipts are aligned and physically printable on configured thermal printers.
  - GST/totals/footer render consistently.
- Validation:
  - Manual on target thermal printer models.
- Progress Note:
  - Implemented configurable thermal width profiles (58mm/80mm) for formatted text receipts.
  - Added aligned two-column totals and payment mode breakdown rendering.
  - Added ESC/POS byte rendering (`ESC @`, emphasis header, feed, partial cut) for thermal bill and test prints.
  - Linux/macOS CUPS thermal dispatch now uses `lp -o raw` for byte-accurate jobs.
  - Added Windows RAW spool attempt for thermal jobs using `WritePrinter` via PowerShell (`winspool.drv`), with safe fallback to existing dispatch path.
  - Added deterministic dispatch simulation override (`PHARMACARE_PRINT_SIMULATE=success|fail`) and queue-status smoke coverage in Rust tests.
  - Extended deterministic simulation and queue-status tests to barcode dispatch path (`src-tauri/src/commands/barcode.rs`).
  - Expanded smoke runner coverage for both thermal and barcode dispatch tests: `scripts/printer-dispatch-smoke.sh`.
  - Added manual QA workflow generator: `scripts/printer-manual-qa-report.sh` with guide `docs/PRINTER_QA_WORKFLOW.md`.
  - Refreshed manual QA artifact: `docs/printer-qa-reports/manual-printer-qa-20260311_184202.md` (detected printer inventory captured).
  - Added one-command P0 validation pack: `scripts/run-p0-validation-pack.sh`.
  - Added P0 release gate script: `scripts/release-gate-p0.sh` with guide `docs/RELEASE_GATE_P0.md`.
  - Validation run passed on 2026-03-12:
    - `./scripts/printer-dispatch-smoke.sh` (thermal + barcode dispatch smoke tests)
    - `cargo check`
    - `npm run build`
    - `./scripts/run-p0-validation-pack.sh src-tauri/pharmacare_pro.db`
    - `./scripts/release-gate-p0.sh src-tauri/pharmacare_pro.db`
    - `STRICT_MANUAL=1 ./scripts/release-gate-p0.sh src-tauri/pharmacare_pro.db`
  - Prior validation snapshot on 2026-03-11:
    - `cargo test --lib printer::tests::simulated_dispatch_override_parses_success_and_failure`
    - `cargo test --lib printer::tests::apply_dispatch_status_updates_sent_failed_and_retry_count`
    - `cargo check`
  - Pending physical device verification on target thermal models and fallback-path QA.

3. `IN_PROGRESS` Barcode Printer Dispatch (ZPL Spool)

- Scope:
  - Send ZPL jobs to selected barcode printer.
  - Report spool success/failure in queue status.
- Acceptance Criteria:
  - Barcode label print reaches printer without manual file handling.
- Validation:
  - Manual print test on barcode printer.
- Progress Note:
  - Implemented OS-level dispatch attempt for barcode ZPL jobs (`Out-Printer` on Windows, `lp -o raw` on CUPS environments).
  - Print queue status now transitions to `sent`/`failed` for barcode jobs.
  - Pending real-device validation on target barcode printer models.

4. `TODO` Real License Provider Integration (LemonSqueezy)

- Scope:
  - Replace scaffold with real validate/activate/deactivate flow.
  - Persist license state securely and refresh status.
- Acceptance Criteria:
  - Valid key activates.
  - Invalid/expired key rejected with clear reason.
- Validation:
  - Integration tests with provider sandbox.

5. `IN_PROGRESS` Security Command Audit (Permissions)

- Scope:
  - Enforce permission checks for all sensitive commands.
- Acceptance Criteria:
  - Unauthorized roles cannot invoke restricted operations.
- Validation:
  - Command-level tests per role.
- Progress Note:
  - Added shared command-level permission guard in Rust (`commands/permission.rs`) using role JSON + role fallback logic.
  - Enforced permission checks on sensitive write paths for billing, purchase/suppliers, medicine, customers/doctors, inventory adjustments, settings writes, backup restore, and email import bill commit.
  - Extended enforcement to report-generation commands and backup create/list by requiring actor `user_id` at command boundary.
  - Extended enforcement to printer/barcode command endpoints (print bill/labels/test, queue listing/retry, barcode generate/print) by requiring actor `user_id` and permission checks.
  - Hardened auth user-management commands with explicit admin-only checks (`auth_create_user`, `auth_list_users`, `auth_update_user`).
  - Secured `license_activate` behind settings permission and actor `user_id`.
  - Added Rust denial tests for permission matrix and admin guard checks in `src-tauri/src/commands/permission.rs` and `src-tauri/src/commands/auth.rs`.
  - Validation run passed: `cargo test --lib permission::tests` (3 passed) and `cargo test --lib auth::tests` (2 passed).
  - Added automated permission command audit script: `scripts/permission-command-audit.sh`.
  - Validation run passed on 2026-03-12: `./scripts/permission-command-audit.sh` (all targeted sensitive command files reported guard coverage).
  - Pending: broader command-invocation integration tests for protected Tauri endpoints.

6. `IN_PROGRESS` Backup/Restore Drill (Golden Dataset)

- Scope:
  - Backup create/restore verified against a realistic seeded DB.
- Acceptance Criteria:
  - Restored DB matches expected key records and balances.
- Validation:
  - Automated verification script + manual smoke run.
- Progress Note:
  - Added automated drill script: `scripts/backup-restore-drill.sh`.
  - Script now verifies baseline metrics, performs controlled mutation, restores from backup, and confirms full rollback (including marker removal).
  - Added idempotent golden dataset seeder: `scripts/seed-golden-dataset.sh`.
  - Added wrapper for seeded drill run: `scripts/run-golden-backup-drill.sh`.
  - Verified successful seeded drill run against `src-tauri/pharmacare_pro.db` with non-zero metrics:
    - users=2, bills=1, bill_items=1
    - customers_outstanding=250.0, suppliers_outstanding=1250.0
    - batch_units_on_hand=110
  - Added post-restore smoke verification script: `scripts/post-restore-smoke-check.sh`.
  - Executed seeded drill + smoke verifier successfully on 2026-03-11:
    - `./scripts/run-golden-backup-drill.sh src-tauri/pharmacare_pro.db`
    - `./scripts/post-restore-smoke-check.sh src-tauri/pharmacare_pro.db`
    - latest_bill=POS-GOLDEN-00001, users=2, bills=1, bill_items=1
  - Added post-restore UI smoke workflow and report generator:
    - `docs/POST_RESTORE_UI_SMOKE_WORKFLOW.md`
    - `scripts/post-restore-ui-smoke-report.sh`
    - refreshed template: `docs/post-restore-smoke-reports/post-restore-ui-smoke-20260311_184203.md`
  - Pending: complete manual in-app smoke run after restore UI flow.
  - Strict release gate currently passes using recorded automation evidence markers; full human UI walkthrough signoff remains pending.

## P1 (High Priority)

7. `TODO` Accounting Correctness Pack

- GST and rounding edge cases.
- Return/cancel reversal correctness.
- Validation with CA-reviewed samples.

8. `TODO` Import Robustness

- Duplicate invoice detection.
- Supplier-specific CSV/Excel templates.
- Better import error diagnostics.

9. `TODO` Reliability Tests

- Rust transactional tests for billing/returns/reports/backup.
- Frontend integration smoke tests for critical paths.

10. `TODO` Observability + Supportability

- Structured error logging.
- Diagnostics export bundle.
- Crash triage workflow.

## P2 (Polish + Scale)

11. `DONE` Route-level lazy loading and prefetch
12. `DONE` Dynamic `xlsx` loading for export
13. `TODO` Additional performance tuning with large datasets
14. `TODO` Advanced print templates and branding customization
15. `TODO` Staff SOP docs and in-app guided onboarding

## Current Execution Order

1. Real Printer Discovery + Mapping
2. True Thermal ESC/POS Pipeline
3. Barcode Printer Dispatch
4. License Provider Integration
5. Permission Audit
6. Backup/Restore Drill

## Gate For Production Release

- All P0 items `DONE`
- No unresolved P0/P1 defects
- `npm run build` and `cargo check` pass on release branch
- Manual UAT signoff on billing, printing, reports, backup/restore
