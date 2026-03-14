#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:-src-tauri/pharmacare_pro.db}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: database not found at $DB_PATH"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required for post-restore smoke checks."
  exit 1
fi

python3 - "$DB_PATH" <<'PY'
import sqlite3
import sys


def fail(message: str) -> None:
    print(f"ERROR: {message}")
    sys.exit(1)


def scalar(cur: sqlite3.Cursor, sql: str):
    cur.execute(sql)
    row = cur.fetchone()
    return row[0] if row else None


db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
cur = conn.cursor()

required_tables = ["users", "bills", "bill_items", "customers", "suppliers", "batches", "settings"]
for table in required_tables:
    exists = scalar(
        cur,
        f"SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='{table}'",
    )
    if exists != 1:
        fail(f"required table missing: {table}")

users = int(scalar(cur, "SELECT COUNT(1) FROM users") or 0)
if users <= 0:
    fail("users table is empty")

bills = int(scalar(cur, "SELECT COUNT(1) FROM bills") or 0)
bill_items = int(scalar(cur, "SELECT COUNT(1) FROM bill_items") or 0)
if bills <= 0 or bill_items <= 0:
    fail("billing smoke failed: expected at least one bill and one bill item")

customer_due = float(scalar(cur, "SELECT COALESCE(ROUND(SUM(outstanding_balance), 2), 0) FROM customers") or 0.0)
supplier_due = float(scalar(cur, "SELECT COALESCE(ROUND(SUM(outstanding_balance), 2), 0) FROM suppliers") or 0.0)
if customer_due < 0 or supplier_due < 0:
    fail("outstanding balances should not be negative")

units_on_hand = int(
    scalar(
        cur,
        "SELECT COALESCE(SUM(quantity_in - quantity_sold - quantity_adjusted), 0) FROM batches WHERE is_active = 1",
    )
    or 0
)
if units_on_hand <= 0:
    fail("inventory smoke failed: active batch stock is not positive")

latest_bill_number = scalar(cur, "SELECT bill_number FROM bills ORDER BY id DESC LIMIT 1") or "-"
print_jobs_exists = int(
    scalar(cur, "SELECT COUNT(1) FROM sqlite_master WHERE type='table' AND name='print_jobs'") or 0
)
print_jobs = 0
if print_jobs_exists == 1:
    print_jobs = int(scalar(cur, "SELECT COUNT(1) FROM print_jobs") or 0)

print("SUCCESS: Post-restore smoke checks passed")
print(f"users={users}")
print(f"bills={bills}")
print(f"bill_items={bill_items}")
print(f"latest_bill={latest_bill_number}")
print(f"customers_outstanding={customer_due:.2f}")
print(f"suppliers_outstanding={supplier_due:.2f}")
print(f"batch_units_on_hand={units_on_hand}")
print(f"print_jobs={print_jobs}")

conn.close()
PY
