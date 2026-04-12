-- PharmaCare Pro — Migration 004: Sprint 9 Features
PRAGMA foreign_keys = ON;

-- Schemes / Promotions
CREATE TABLE IF NOT EXISTS schemes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  scheme_type     TEXT    NOT NULL DEFAULT 'percent',
  -- scheme_type: percent | flat | bxgy
  value           REAL    NOT NULL DEFAULT 0,
  -- percent: discount % off MRP | flat: ₹ off bill | bxgy: get_quantity free per buy_quantity
  buy_quantity    INTEGER NOT NULL DEFAULT 0,
  get_quantity    INTEGER NOT NULL DEFAULT 0,
  medicine_id     INTEGER REFERENCES medicines(id),
  -- NULL = applies to all medicines / whole bill
  min_bill_amount REAL    NOT NULL DEFAULT 0,
  start_date      TEXT,
  end_date        TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  notes           TEXT    NOT NULL DEFAULT '',
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scheme_active ON schemes(is_active);

-- Collection Payments (payments received against customer outstanding dues)
CREATE TABLE IF NOT EXISTS collection_payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL REFERENCES customers(id),
  amount          REAL    NOT NULL DEFAULT 0,
  payment_mode    TEXT    NOT NULL DEFAULT 'cash',
  payment_date    TEXT    NOT NULL DEFAULT (date('now')),
  reference_no    TEXT    NOT NULL DEFAULT '',
  notes           TEXT    NOT NULL DEFAULT '',
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_collect_cust ON collection_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_collect_date ON collection_payments(payment_date);
