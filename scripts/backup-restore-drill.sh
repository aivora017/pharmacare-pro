#!/usr/bin/env bash
set -euo pipefail

# Automated backup/restore drill for PharmaCare Pro SQLite DB.
# Flow:
# 1) Snapshot baseline metrics
# 2) Copy DB to backup file
# 3) Apply controlled mutation to live DB
# 4) Restore DB from backup
# 5) Re-check metrics and marker rollback

DB_PATH="${1:-pharmacare_pro.db}"

HAS_SQLITE3=0
if command -v sqlite3 >/dev/null 2>&1; then
  HAS_SQLITE3=1
fi

if [[ "$HAS_SQLITE3" != "1" ]] && ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 or python3 is required for this drill."
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: database not found at $DB_PATH"
  exit 1
fi

WORK_DIR="$(mktemp -d)"
BACKUP_PATH="$WORK_DIR/drill_backup_$(date +%Y%m%d_%H%M%S).db"
MARKER_KEY="drill_marker_$(date +%s)"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

read_metrics() {
  local db="$1"
  if [[ "$HAS_SQLITE3" == "1" ]]; then
    sqlite3 -readonly "$db" <<'SQL'
.mode list
.separator |
SELECT 'users', COUNT(1) FROM users;
SELECT 'bills', COUNT(1) FROM bills;
SELECT 'bill_items', COUNT(1) FROM bill_items;
SELECT 'customers_outstanding', COALESCE(ROUND(SUM(outstanding_balance), 2), 0) FROM customers;
SELECT 'suppliers_outstanding', COALESCE(ROUND(SUM(outstanding_balance), 2), 0) FROM suppliers;
SELECT 'batch_units_on_hand', COALESCE(SUM(quantity_in - quantity_sold - quantity_adjusted), 0) FROM batches WHERE is_active = 1;
SELECT 'print_jobs',
  CASE
    WHEN EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='print_jobs')
    THEN (SELECT COUNT(1) FROM print_jobs)
    ELSE 0
  END;
SQL
  else
    python3 - "$db" <<'PY'
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
cur = conn.cursor()
queries = [
    ("users", "SELECT COUNT(1) FROM users"),
    ("bills", "SELECT COUNT(1) FROM bills"),
    ("bill_items", "SELECT COUNT(1) FROM bill_items"),
    ("customers_outstanding", "SELECT COALESCE(ROUND(SUM(outstanding_balance), 2), 0) FROM customers"),
    ("suppliers_outstanding", "SELECT COALESCE(ROUND(SUM(outstanding_balance), 2), 0) FROM suppliers"),
    ("batch_units_on_hand", "SELECT COALESCE(SUM(quantity_in - quantity_sold - quantity_adjusted), 0) FROM batches WHERE is_active = 1"),
    ("print_jobs", None),
]
for label, sql in queries:
    if label == "print_jobs":
      cur.execute("SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='print_jobs'")
      table_exists = cur.fetchone()[0] == 1
      if table_exists:
        cur.execute("SELECT COUNT(1) FROM print_jobs")
        value = cur.fetchone()[0]
      else:
        value = 0
    else:
      cur.execute(sql)
      value = cur.fetchone()[0]
    print(f"{label}|{value}")
conn.close()
PY
  fi
}

run_write_sql() {
  local db="$1"
  local sql="$2"
  if [[ "$HAS_SQLITE3" == "1" ]]; then
    sqlite3 "$db" "$sql"
  else
    python3 - "$db" "$sql" <<'PY'
import sqlite3
import sys

db_path = sys.argv[1]
sql = sys.argv[2]
conn = sqlite3.connect(db_path)
conn.executescript(sql)
conn.commit()
conn.close()
PY
  fi
}

run_scalar_sql() {
  local db="$1"
  local sql="$2"
  if [[ "$HAS_SQLITE3" == "1" ]]; then
    sqlite3 -readonly "$db" "$sql"
  else
    python3 - "$db" "$sql" <<'PY'
import sqlite3
import sys

db_path = sys.argv[1]
sql = sys.argv[2]
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute(sql)
value = cur.fetchone()[0]
print(value)
conn.close()
PY
  fi
}

echo "[1/5] Capturing baseline metrics from $DB_PATH"
BASELINE_METRICS="$WORK_DIR/baseline_metrics.txt"
read_metrics "$DB_PATH" > "$BASELINE_METRICS"
cat "$BASELINE_METRICS"

echo "[2/5] Creating backup copy at $BACKUP_PATH"
cp "$DB_PATH" "$BACKUP_PATH"

echo "[3/5] Applying controlled mutation to live database"
run_write_sql "$DB_PATH" "INSERT INTO settings (key, value, updated_at, updated_by)
VALUES ('$MARKER_KEY', '\"marker\"', datetime('now'), NULL)
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;"

echo "[4/5] Restoring database from backup copy"
cp "$BACKUP_PATH" "$DB_PATH"

echo "[5/5] Verifying post-restore state"
RESTORED_METRICS="$WORK_DIR/restored_metrics.txt"
read_metrics "$DB_PATH" > "$RESTORED_METRICS"
cat "$RESTORED_METRICS"

if ! diff -u "$BASELINE_METRICS" "$RESTORED_METRICS" >/dev/null; then
  echo "ERROR: Metric mismatch after restore."
  diff -u "$BASELINE_METRICS" "$RESTORED_METRICS" || true
  exit 1
fi

MARKER_COUNT="$(run_scalar_sql "$DB_PATH" "SELECT COUNT(1) FROM settings WHERE key = '$MARKER_KEY';")"
if [[ "$MARKER_COUNT" != "0" ]]; then
  echo "ERROR: Drill marker still present after restore."
  exit 1
fi

echo "SUCCESS: Backup/restore drill passed. Database state fully reverted."