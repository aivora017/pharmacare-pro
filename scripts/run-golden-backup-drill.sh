#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:-src-tauri/pharmacare_pro.db}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/seed-golden-dataset.sh" "$DB_PATH"
"$SCRIPT_DIR/backup-restore-drill.sh" "$DB_PATH"

echo "SUCCESS: Golden backup/restore drill completed."