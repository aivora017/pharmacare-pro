#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_PATH="${1:-src-tauri/pharmacare_pro.db}"
STRICT_MANUAL="${STRICT_MANUAL:-0}"

LATEST_PRINTER_QA=""
LATEST_RESTORE_UI_QA=""

find_latest_report() {
  local pattern="$1"
  local out
  out="$(ls -1t $pattern 2>/dev/null | head -n 1 || true)"
  echo "$out"
}

assert_exists() {
  local path="$1"
  if [[ ! -e "$path" ]]; then
    echo "ERROR: Required artifact missing: $path"
    exit 1
  fi
}

assert_report_has_pass() {
  local file="$1"
  local label="$2"
  if [[ "$STRICT_MANUAL" != "1" ]]; then
    echo "WARN: STRICT_MANUAL=0, skipping PASS marker enforcement for $label"
    return
  fi

  if ! grep -Eq '\[x\] PASS|\[X\] PASS|PASS \[x\]|PASS \[X\]' "$file"; then
    echo "ERROR: Strict manual gate failed for $label (no PASS marker found): $file"
    exit 1
  fi
}

cd "$ROOT_DIR"

echo "[1/5] Validating required scripts exist"
assert_exists "scripts/run-p0-validation-pack.sh"
assert_exists "scripts/printer-manual-qa-report.sh"
assert_exists "scripts/post-restore-ui-smoke-report.sh"
assert_exists "scripts/printer-dispatch-smoke.sh"
assert_exists "scripts/permission-command-audit.sh"

echo "[2/5] Running automated P0 validation pack"
./scripts/run-p0-validation-pack.sh "$DB_PATH"

echo "[3/5] Checking manual evidence artifacts"
LATEST_PRINTER_QA="$(find_latest_report "docs/printer-qa-reports/manual-printer-qa-*.md")"
LATEST_RESTORE_UI_QA="$(find_latest_report "docs/post-restore-smoke-reports/post-restore-ui-smoke-*.md")"

if [[ -z "$LATEST_PRINTER_QA" ]]; then
  echo "ERROR: No printer QA report found in docs/printer-qa-reports/."
  exit 1
fi
if [[ -z "$LATEST_RESTORE_UI_QA" ]]; then
  echo "ERROR: No post-restore UI smoke report found in docs/post-restore-smoke-reports/."
  exit 1
fi

echo "INFO: Latest printer QA report: $LATEST_PRINTER_QA"
echo "INFO: Latest post-restore UI smoke report: $LATEST_RESTORE_UI_QA"

echo "[4/5] Evaluating manual PASS markers"
assert_report_has_pass "$LATEST_PRINTER_QA" "printer QA"
assert_report_has_pass "$LATEST_RESTORE_UI_QA" "post-restore UI smoke"

echo "[5/5] Release gate summary"
if [[ "$STRICT_MANUAL" == "1" ]]; then
  echo "SUCCESS: P0 release gate passed with strict manual evidence checks."
else
  echo "SUCCESS: P0 release gate passed (automation enforced, manual evidence presence enforced)."
  echo "NOTE: To enforce manual PASS markers, rerun with STRICT_MANUAL=1"
fi
