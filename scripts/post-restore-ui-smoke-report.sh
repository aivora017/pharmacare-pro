#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/docs/post-restore-smoke-reports"
mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT_PATH="$OUT_DIR/post-restore-ui-smoke-$STAMP.md"

cat > "$REPORT_PATH" <<EOF
# Post-Restore UI Smoke Report

Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Tester: <fill-name>
Build Ref: <fill-branch-or-commit>
Database: src-tauri/pharmacare_pro.db

## Preconditions
- [ ] Restore completed from known backup.
- [ ] App restarted after restore.
- [ ] Login works with expected user accounts.

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
EOF

echo "Created post-restore UI smoke report template: $REPORT_PATH"
