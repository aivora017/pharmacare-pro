#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${1:-src-tauri/pharmacare_pro.db}"

cd "$ROOT_DIR"

echo "[1/6] Running seeded backup/restore drill"
./scripts/run-golden-backup-drill.sh "$DB_PATH"

echo "[2/6] Running post-restore smoke checks"
./scripts/post-restore-smoke-check.sh "$DB_PATH"

echo "[3/6] Running printer dispatch smoke checks"
./scripts/printer-dispatch-smoke.sh

echo "[4/7] Running permission command audit"
./scripts/permission-command-audit.sh

echo "[5/7] Running Rust compile check"
cd "$ROOT_DIR/src-tauri"
cargo check

echo "[6/7] Running frontend build"
cd "$ROOT_DIR"
npm run build

echo "[7/7] Validation pack complete"
echo "SUCCESS: P0 validation pack passed."
