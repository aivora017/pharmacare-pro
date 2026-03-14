#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/docs/printer-qa-reports"
mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT_PATH="$OUT_DIR/manual-printer-qa-$STAMP.md"

OS_NAME="$(uname -s)"
HOST_NAME="$(hostname)"

THERMAL_MODEL="${1:-<fill-thermal-printer-model>}"
BARCODE_MODEL="${2:-<fill-barcode-printer-model>}"

DETECTED_PRINTERS=""
if command -v powershell.exe >/dev/null 2>&1; then
  DETECTED_PRINTERS="$(powershell.exe -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name" 2>/dev/null | tr -d '\r' || true)"
elif command -v powershell >/dev/null 2>&1; then
  DETECTED_PRINTERS="$(powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name" 2>/dev/null | tr -d '\r' || true)"
elif command -v lpstat >/dev/null 2>&1; then
  DETECTED_PRINTERS="$(lpstat -a 2>/dev/null | awk '{print $1}' || true)"
fi

if [[ -z "${DETECTED_PRINTERS// }" ]]; then
  DETECTED_PRINTERS="<no-printers-detected-automatically>"
fi

cat > "$REPORT_PATH" <<EOF
# Manual Printer QA Report

Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Host: $HOST_NAME
OS: $OS_NAME
Thermal Model: $THERMAL_MODEL
Barcode Model: $BARCODE_MODEL

## Detected Printers
$DETECTED_PRINTERS

## Preconditions
- [ ] App build is latest and 'npm run build' passed.
- [ ] Backend compile is latest and 'cargo check' passed.
- [ ] Printer defaults saved in Settings page.

## Thermal RAW QA
- [ ] Settings -> thermal printer selected correctly.
- [ ] Billing -> print thermal bill from live bill.
- [ ] Output contains aligned totals and GST lines.
- [ ] ESC/POS cut executes correctly (or acceptable no-cut behavior recorded).
- [ ] Queue status moves to 'sent' for success case.
- [ ] Force printer-offline scenario and verify queue status moves to 'failed'.
- [ ] Retry failed job and verify 'retry_count' increments.

### Thermal Observations
- Alignment notes:
- Multilingual rendering notes:
- Cut behavior notes:
- Failure-mode notes:

## Windows Fallback QA (if on Windows)
- [ ] Simulate RAW failure path and verify fallback dispatch still attempts print.
- [ ] Confirm no app crash and user sees clear failure/success feedback.

### Fallback Observations
-

## Barcode Printer QA
- [ ] Barcode labels generated and queued.
- [ ] ZPL reaches printer without manual file handling.
- [ ] Queue status updates to 'sent'/'failed' correctly.

### Barcode Observations
-

## Final Verdict
- Thermal RAW: [ ] PASS [ ] FAIL
- Thermal fallback: [ ] PASS [ ] FAIL
- Barcode dispatch: [ ] PASS [ ] FAIL
- Release recommendation: [ ] GO [ ] NO-GO

## Issues Found
1.
2.
3.

## Attachments
- Photos of printed output:
- Logs/screenshots:
EOF

echo "Created QA report template: $REPORT_PATH"
