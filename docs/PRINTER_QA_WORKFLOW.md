# Printer QA Workflow

Use this workflow to capture final manual evidence for P0 printer readiness.

## Generate Report Template

From repo root:

```bash
chmod +x scripts/printer-manual-qa-report.sh
./scripts/printer-manual-qa-report.sh "ThermalModel" "BarcodeModel"
```

This creates a timestamped report under `docs/printer-qa-reports/`.

## Execute QA Steps

1. Open the generated markdown report.
2. Fill printer models and detected printer corrections if needed.
3. Run thermal RAW test from Billing print flow.
4. Validate queue transitions for success/failure/retry.
5. Run barcode print flow and verify dispatch outcome.
6. Mark final verdict and release recommendation.

## Pass Criteria

- Thermal RAW print is aligned and physically usable.
- Fallback path does not crash and gives clear status.
- Barcode dispatch reaches printer without manual file handling.
- Print queue states (`queued`, `sent`, `failed`) are correct.
