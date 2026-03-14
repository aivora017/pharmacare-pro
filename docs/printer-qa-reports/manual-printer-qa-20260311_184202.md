# Manual Printer QA Report

Date: 2026-03-11 18:42:03 UTC
Host: DESKTOP-KIOELSN
OS: Linux
Thermal Model: TBD-Thermal
Barcode Model: TBD-Barcode

## Detected Printers
AnyDesk Printer
EPSON L3250 Series
Fax
Microsoft Print to PDF
Microsoft XPS Document Writer
TSC TTP-244 Pro

## Preconditions
- [x] App build is latest and 'npm run build' passed.
- [x] Backend compile is latest and 'cargo check' passed.
- [ ] Printer defaults saved in Settings page.

## Automation Evidence
- [x] PASS [ ] FAIL - `scripts/printer-dispatch-smoke.sh` passed (thermal + barcode dispatch tests).
- [x] PASS [ ] FAIL - `scripts/run-p0-validation-pack.sh src-tauri/pharmacare_pro.db` passed.
- [x] PASS [ ] FAIL - `STRICT_MANUAL=1 ./scripts/release-gate-p0.sh src-tauri/pharmacare_pro.db` passed.
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
