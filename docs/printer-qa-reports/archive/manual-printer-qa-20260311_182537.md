# Manual Printer QA Report

Date: 2026-03-11 18:25:38 UTC
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
- [ ] App build is latest and 
> pharmacare-pro@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 1425 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                               0.46 kB │ gzip:   0.29 kB
dist/assets/index-DlLqb3Z-.css               27.42 kB │ gzip:   5.47 kB
dist/assets/emailImportService-Db92spRX.js    0.29 kB │ gzip:   0.21 kB
dist/assets/PageHeader-CS_G3b0O.js            0.41 kB │ gzip:   0.25 kB
dist/assets/LoadingSpinner-w6VHc3Xg.js        0.42 kB │ gzip:   0.30 kB
dist/assets/supplierService-Br3sjBFB.js       0.57 kB │ gzip:   0.26 kB
dist/assets/index-DJw2g-iE.js                 7.08 kB │ gzip:   1.93 kB
dist/assets/index-DeOEs8tF.js                 8.68 kB │ gzip:   2.34 kB
dist/assets/index-CacnS53q.js                 8.96 kB │ gzip:   3.13 kB
dist/assets/index-0-_YPkDr.js                 9.27 kB │ gzip:   2.63 kB
dist/assets/index-CkPV2gWa.js                12.05 kB │ gzip:   3.00 kB
dist/assets/index-CHH6zJ_4.js                14.93 kB │ gzip:   3.30 kB
dist/assets/index-DSVlxHB3.js                15.71 kB │ gzip:   3.65 kB
dist/assets/index-BGCoRoVS.js                16.08 kB │ gzip:   3.64 kB
dist/assets/index-jM4BwJgE.js                39.05 kB │ gzip:  11.39 kB
dist/assets/index-TI2Ak8E0.js                39.14 kB │ gzip:   6.64 kB
dist/assets/index-D9soV2CK.js               252.01 kB │ gzip:  77.40 kB
dist/assets/xlsx-D_0l8YDs.js                429.03 kB │ gzip: 143.08 kB
✓ built in 1.92s passed.
- [ ] Backend compile is latest and  passed.
- [ ] Printer defaults saved in Settings page.

## Thermal RAW QA
- [ ] Settings -> thermal printer selected correctly.
- [ ] Billing -> print thermal bill from live bill.
- [ ] Output contains aligned totals and GST lines.
- [ ] ESC/POS cut executes correctly (or acceptable no-cut behavior recorded).
- [ ] Queue status moves to  for success case.
- [ ] Force printer-offline scenario and verify queue status moves to .
- [ ] Retry failed job and verify  increments.

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
- [ ] Queue status updates to / correctly.

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
