#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v rg >/dev/null 2>&1; then
  SEARCH_BIN="rg"
elif command -v grep >/dev/null 2>&1; then
  SEARCH_BIN="grep"
else
  echo "ERROR: neither ripgrep (rg) nor grep is available for permission audit"
  exit 1
fi

cd "$ROOT_DIR"

declare -a FILES=(
  "src-tauri/src/commands/billing.rs"
  "src-tauri/src/commands/purchase.rs"
  "src-tauri/src/commands/medicine.rs"
  "src-tauri/src/commands/customer.rs"
  "src-tauri/src/commands/inventory.rs"
  "src-tauri/src/commands/settings.rs"
  "src-tauri/src/commands/backup.rs"
  "src-tauri/src/commands/reports.rs"
  "src-tauri/src/commands/printer.rs"
  "src-tauri/src/commands/barcode.rs"
  "src-tauri/src/commands/license.rs"
  "src-tauri/src/commands/email_import.rs"
)

failures=0

for file in "${FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: Missing command file: $file"
    failures=$((failures + 1))
    continue
  fi

  if [[ "$SEARCH_BIN" == "rg" ]]; then
    import_hits=$(rg -n "use crate::commands::permission::require_permission;" "$file" | wc -l | tr -d ' ')
    command_count=$(rg -n "#\[tauri::command\]" "$file" | wc -l | tr -d ' ')
    guard_count=$(rg -n "require_permission\(" "$file" | wc -l | tr -d ' ')
  else
    import_hits=$(grep -n "use crate::commands::permission::require_permission;" "$file" | wc -l | tr -d ' ')
    command_count=$(grep -n "#\[tauri::command\]" "$file" | wc -l | tr -d ' ')
    guard_count=$(grep -n "require_permission(" "$file" | wc -l | tr -d ' ')
  fi

  if [[ "$import_hits" -eq 0 ]]; then
    echo "ERROR: Missing require_permission import in $file"
    failures=$((failures + 1))
  fi

  if [[ "$command_count" -gt 0 && "$guard_count" -eq 0 ]]; then
    echo "ERROR: No require_permission guard found in command file with tauri commands: $file"
    failures=$((failures + 1))
  fi

  if [[ "$command_count" -gt 0 ]]; then
    echo "OK: $file -> commands=$command_count guards=$guard_count"
  fi

done

if [[ "$failures" -gt 0 ]]; then
  echo "ERROR: Permission command audit failed with $failures issue(s)."
  exit 1
fi

echo "SUCCESS: Permission command audit passed."
