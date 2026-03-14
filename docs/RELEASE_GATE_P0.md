# P0 Release Gate

Single command to validate current P0 readiness evidence.

## Command

```bash
chmod +x scripts/release-gate-p0.sh
./scripts/release-gate-p0.sh src-tauri/pharmacare_pro.db
```

## What It Enforces

1. Required validation scripts exist.
2. Automated validation pack passes:

- backup/restore drill
- post-restore DB smoke
- printer dispatch smoke tests
- permission command audit (`scripts/permission-command-audit.sh`)
- `cargo check`
- `npm run build`

3. Manual evidence files exist:

- latest printer QA report in `docs/printer-qa-reports/`
- latest post-restore UI smoke report in `docs/post-restore-smoke-reports/`

## Strict Manual Mode

To require explicit PASS markers inside manual report files:

```bash
STRICT_MANUAL=1 ./scripts/release-gate-p0.sh src-tauri/pharmacare_pro.db
```

If PASS markers are absent in strict mode, the gate fails.
