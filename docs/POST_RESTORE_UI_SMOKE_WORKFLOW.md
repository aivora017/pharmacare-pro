# Post-Restore UI Smoke Workflow

Use this after backup restore to produce final manual evidence for P0-6.

## Generate Report Template

From repo root:

```bash
chmod +x scripts/post-restore-ui-smoke-report.sh
./scripts/post-restore-ui-smoke-report.sh
```

A timestamped report is created under `docs/post-restore-smoke-reports/`.

## Execute Manual Checks

1. Restore backup and restart app.
2. Complete all checklist items in the generated report.
3. Attach screenshots/logs for failed or risky checks.
4. Mark final verdict PASS/FAIL and GO/NO-GO.

## Pass Criteria

- Core business pages load correctly after restore.
- Billing, reports, balances, and inventory are consistent.
- No fatal errors in post-restore workflows.
