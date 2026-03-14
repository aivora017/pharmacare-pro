# Post-Restore UI Smoke Report

Date: 2026-03-11 18:35:01 UTC
Tester: <fill-name>
Build Ref: <fill-branch-or-commit>
Database: src-tauri/pharmacare_pro.db

## Preconditions
- [x] Restore completed from known backup.
- [ ] App restarted after restore.
- [ ] Login works with expected user accounts.

## Automation Evidence
- [x] PASS [ ] FAIL - Seeded backup/restore drill passed via `scripts/run-golden-backup-drill.sh`.
- [x] PASS [ ] FAIL - Post-restore DB smoke checks passed via `scripts/post-restore-smoke-check.sh`.
- [x] PASS [ ] FAIL - P0 validation pack passed via `scripts/run-p0-validation-pack.sh`.
- [ ] PASS [ ] FAIL - Manual UI walkthrough completed end-to-end.

## Billing Smoke
- [ ] Open Billing page without errors.
- [ ] Latest bill history row visible (expected golden bill id/number).
- [ ] Reprint action queues successfully.
- [ ] Sales return modal opens and recent returns list loads.

## Customer/Supplier Balances
- [ ] Customer outstanding values load and match expected baseline.
- [ ] Supplier outstanding values load and match expected baseline.

## Inventory/Expiry
- [ ] Medicine list loads and active stock values appear sane.
- [ ] Expiry screen opens and data loads.

## Reports
- [ ] Sales report loads for default date range.
- [ ] GST report loads and shows non-error output.
- [ ] Stock report loads and valuation section renders.

## Settings/Backup
- [ ] Backup list loads.
- [ ] License status panel loads.
- [ ] Printer defaults list loads.

## Final Verdict
- Post-restore UI smoke: [ ] PASS [ ] FAIL
- Release recommendation: [ ] GO [ ] NO-GO

## Issues Found
1.
2.
3.

## Attachments
- Screenshot set:
- Logs:
