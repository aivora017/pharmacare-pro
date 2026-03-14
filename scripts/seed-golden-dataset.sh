#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:-src-tauri/pharmacare_pro.db}"

if [[ ! -f "$DB_PATH" ]]; then
  echo "ERROR: database not found at $DB_PATH"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required to seed golden dataset."
  exit 1
fi

python3 - "$DB_PATH" <<'PY'
import sqlite3
import sys
from datetime import datetime


db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
conn.execute("PRAGMA foreign_keys = ON")
cur = conn.cursor()

# Ensure an active user exists for created_by references.
cur.execute("SELECT id FROM users WHERE is_active = 1 ORDER BY id ASC LIMIT 1")
row = cur.fetchone()
if not row:
    raise RuntimeError("No active user found. Start app once to bootstrap default user.")
actor_id = row[0]

# Helper: role id by name with fallback to actor role.
def role_id(role_name: str):
    cur.execute("SELECT id FROM roles WHERE lower(name) = lower(?) LIMIT 1", (role_name,))
    found = cur.fetchone()
    if found:
        return found[0]
    return None

# Insert a deterministic non-admin user for richer role coverage.
cur.execute("SELECT id FROM users WHERE email = ?", ("golden.cashier@pharmacare.local",))
cashier = cur.fetchone()
if not cashier:
    cashier_role = role_id("cashier")
    if cashier_role is None:
        cashier_role = role_id("pharmacist") or role_id("admin")
    cur.execute(
        """
        INSERT INTO users (name, email, password_hash, role_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        """,
        ("Golden Cashier", "golden.cashier@pharmacare.local", "hash", cashier_role),
    )

# Supplier
cur.execute("SELECT id FROM suppliers WHERE name = ? LIMIT 1", ("GOLDEN SUPPLIER",))
row = cur.fetchone()
if row:
    supplier_id = row[0]
else:
    cur.execute(
        """
        INSERT INTO suppliers (
          name, contact_person, phone, email, city, state,
          payment_terms, credit_limit, outstanding_balance, reliability_score,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        """,
        (
            "GOLDEN SUPPLIER",
            "Supplier Rep",
            "9000000001",
            "supplier@golden.local",
            "Kolkata",
            "WB",
            30,
            100000.0,
            1250.0,
            82.0,
        ),
    )
    supplier_id = cur.lastrowid

# Customer
cur.execute("SELECT id FROM customers WHERE name = ? LIMIT 1", ("GOLDEN CUSTOMER",))
row = cur.fetchone()
if row:
    customer_id = row[0]
else:
    cur.execute(
        """
        INSERT INTO customers (
          name, phone, email, outstanding_balance, loyalty_points,
          allergies, chronic_conditions, is_active, created_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
        """,
        (
            "GOLDEN CUSTOMER",
            "9000000002",
            "customer@golden.local",
            250.0,
            12,
            "[]",
            "[]",
            actor_id,
        ),
    )
    customer_id = cur.lastrowid

# Medicine
cur.execute("SELECT id FROM medicines WHERE name = ? LIMIT 1", ("GOLDEN PARACETAMOL 500",))
row = cur.fetchone()
if row:
    medicine_id = row[0]
else:
    cur.execute("SELECT id FROM categories WHERE name = 'Tablets' LIMIT 1")
    cat = cur.fetchone()
    category_id = cat[0] if cat else None

    cur.execute(
        """
        INSERT INTO medicines (
          name, generic_name, category_id, schedule, default_gst_rate,
          reorder_level, reorder_quantity, is_active, created_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
        """,
        (
            "GOLDEN PARACETAMOL 500",
            "Paracetamol",
            category_id,
            "OTC",
            12.0,
            10,
            40,
            actor_id,
        ),
    )
    medicine_id = cur.lastrowid

# Batch
cur.execute(
    "SELECT id FROM batches WHERE medicine_id = ? AND batch_number = ? LIMIT 1",
    (medicine_id, "GOLD-BATCH-001"),
)
row = cur.fetchone()
if row:
    batch_id = row[0]
else:
    cur.execute(
        """
        INSERT INTO batches (
          medicine_id, batch_number, barcode, expiry_date,
          purchase_price, selling_price, quantity_in,
          quantity_sold, quantity_adjusted, rack_location,
          supplier_id, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 1, datetime('now'), datetime('now'))
        """,
        (
            medicine_id,
            "GOLD-BATCH-001",
            "GOLDENBAR001",
            "2027-12-31",
            8.5,
            12.0,
            120,
            "A-1-1",
            supplier_id,
        ),
    )
    batch_id = cur.lastrowid

# Bill + items + payment (idempotent by bill_number)
cur.execute("SELECT id FROM bills WHERE bill_number = ? LIMIT 1", ("POS-GOLDEN-00001",))
row = cur.fetchone()
if row:
    bill_id = row[0]
else:
    cur.execute(
        """
        INSERT INTO bills (
          bill_number, customer_id, bill_date, status,
          subtotal, discount_amount, taxable_amount,
          cgst_amount, sgst_amount, igst_amount,
          total_amount, round_off, net_amount,
          amount_paid, change_returned, outstanding,
          loyalty_points_earned, loyalty_points_redeemed,
          notes, created_by, created_at
        ) VALUES (?, ?, datetime('now'), 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """,
        (
            "POS-GOLDEN-00001",
            customer_id,
            120.0,
            0.0,
            107.14,
            6.43,
            6.43,
            0.0,
            120.0,
            0.0,
            120.0,
            100.0,
            0.0,
            20.0,
            1,
            0,
            "Golden dataset baseline bill",
            actor_id,
        ),
    )
    bill_id = cur.lastrowid

    cur.execute(
        """
        INSERT INTO bill_items (
          bill_id, medicine_id, batch_id,
          medicine_name, batch_number, expiry_date,
          quantity, unit_price, mrp,
          discount_percent, discount_amount,
          gst_rate, cgst_amount, sgst_amount, igst_amount,
          total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 0, ?)
        """,
        (
            bill_id,
            medicine_id,
            batch_id,
            "GOLDEN PARACETAMOL 500",
            "GOLD-BATCH-001",
            "2027-12-31",
            10,
            12.0,
            12.0,
            12.0,
            6.43,
            6.43,
            120.0,
        ),
    )

    cur.execute(
        """
        INSERT INTO payments (bill_id, amount, payment_mode, payment_date, created_by, created_at)
        VALUES (?, ?, 'cash', datetime('now'), ?, datetime('now'))
        """,
        (bill_id, 100.0, actor_id),
    )

    cur.execute(
        "UPDATE batches SET quantity_sold = quantity_sold + 10, updated_at = datetime('now') WHERE id = ?",
        (batch_id,),
    )

# Ensure outstanding balances are deterministic and non-zero for drill checks.
cur.execute("UPDATE customers SET outstanding_balance = 250.0, updated_at = datetime('now') WHERE id = ?", (customer_id,))
cur.execute("UPDATE suppliers SET outstanding_balance = 1250.0, updated_at = datetime('now') WHERE id = ?", (supplier_id,))

conn.commit()
conn.close()
print("SUCCESS: Golden dataset seeded (or already present).")
PY
