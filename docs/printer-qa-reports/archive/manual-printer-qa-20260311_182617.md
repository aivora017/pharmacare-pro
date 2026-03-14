# Manual Printer QA Report

Date: 2026-03-11 18:26:17 UTC
Host: DESKTOP-KIOELSN
OS: Linux
Thermal Model: TBD-Thermal
Barcode Model: TBD-Barcode

## Detected Printers
TSC TTP-244 Pro
Microsoft XPS Document Writer
Microsoft Print to PDF
Fax
EPSON L3250 Series
AnyDesk Printer

## Preconditions
- [x] App build is latest and 'npm run build' passed.
- [x] Backend compile is latest and 'cargo check' passed.
- [ ] Printer defaults saved in Settings page.

## Automation Evidence
- [x] PASS [ ] FAIL - Deterministic dispatch smoke tests passed via `scripts/printer-dispatch-smoke.sh`.
- [x] PASS [ ] FAIL - P0 validation pack passed via `scripts/run-p0-validation-pack.sh`.
- [ ] PASS [ ] FAIL - Physical printer output validated on target hardware.

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
