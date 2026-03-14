#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/src-tauri"

echo "[1/5] Running printer dispatch simulation parser test"
cargo test --lib printer::tests::simulated_dispatch_override_parses_success_and_failure

echo "[2/5] Running print queue status transition smoke test"
cargo test --lib printer::tests::apply_dispatch_status_updates_sent_failed_and_retry_count

echo "[3/5] Running barcode dispatch simulation parser test"
cargo test --lib barcode::tests::simulated_dispatch_override_parses_success_and_failure

echo "[4/5] Running barcode queue status transition smoke test"
cargo test --lib barcode::tests::apply_dispatch_status_updates_sent_and_failed_states

echo "[5/5] Running cargo check"
cargo check

echo "SUCCESS: Printer dispatch smoke checks passed."
