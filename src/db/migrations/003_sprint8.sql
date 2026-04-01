-- PharmaCare Pro — Migration 003: Sprint 8 P1 Features
PRAGMA foreign_keys = ON;

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number       TEXT    NOT NULL UNIQUE,
  supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
  status          TEXT    NOT NULL DEFAULT 'draft',
  order_date      TEXT    NOT NULL DEFAULT (date('now')),
  expected_date   TEXT,
  notes           TEXT    NOT NULL DEFAULT '',
  total_amount    REAL    NOT NULL DEFAULT 0,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status   ON purchase_orders(status);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id             INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  medicine_id       INTEGER NOT NULL REFERENCES medicines(id),
  medicine_name     TEXT    NOT NULL,
  quantity_ordered  INTEGER NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  unit_price        REAL    NOT NULL DEFAULT 0,
  total_amount      REAL    NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(po_id);

-- Expenses + Cash Book
CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT    NOT NULL DEFAULT (date('now')),
  category     TEXT    NOT NULL DEFAULT 'General',
  description  TEXT    NOT NULL,
  amount       REAL    NOT NULL DEFAULT 0,
  payment_mode TEXT    NOT NULL DEFAULT 'cash',
  reference_no TEXT    NOT NULL DEFAULT '',
  vendor_name  TEXT    NOT NULL DEFAULT '',
  notes        TEXT    NOT NULL DEFAULT '',
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_exp_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_exp_cat  ON expenses(category);

-- Supplier Credit Notes
CREATE TABLE IF NOT EXISTS supplier_credit_notes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cn_number        TEXT    NOT NULL UNIQUE,
  supplier_id      INTEGER NOT NULL REFERENCES suppliers(id),
  purchase_bill_id INTEGER REFERENCES purchase_bills(id),
  cn_date          TEXT    NOT NULL DEFAULT (date('now')),
  reason           TEXT    NOT NULL DEFAULT 'damaged',
  total_amount     REAL    NOT NULL DEFAULT 0,
  status           TEXT    NOT NULL DEFAULT 'pending',
  notes            TEXT    NOT NULL DEFAULT '',
  created_by       INTEGER REFERENCES users(id),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cn_supplier ON supplier_credit_notes(supplier_id);

CREATE TABLE IF NOT EXISTS supplier_credit_note_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  cn_id         INTEGER NOT NULL REFERENCES supplier_credit_notes(id) ON DELETE CASCADE,
  medicine_id   INTEGER REFERENCES medicines(id),
  medicine_name TEXT    NOT NULL,
  batch_number  TEXT    NOT NULL DEFAULT '',
  quantity      INTEGER NOT NULL DEFAULT 0,
  unit_price    REAL    NOT NULL DEFAULT 0,
  total_amount  REAL    NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cni_cn ON supplier_credit_note_items(cn_id);

-- Bill Amendments
CREATE TABLE IF NOT EXISTS bill_amendments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  original_bill_id INTEGER NOT NULL REFERENCES bills(id),
  amended_bill_id  INTEGER REFERENCES bills(id),
  amendment_date   TEXT    NOT NULL DEFAULT (datetime('now')),
  reason           TEXT    NOT NULL,
  amendment_type   TEXT    NOT NULL DEFAULT 'correction',
  created_by       INTEGER REFERENCES users(id),
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_amend_orig ON bill_amendments(original_bill_id);

-- Settings for new features
INSERT OR IGNORE INTO settings(key,value) VALUES
  ('loyalty_earn_rate',  '"100"'),
  ('loyalty_redeem_rate','"1"'),
  ('loyalty_min_redeem', '"50"'),
  ('po_auto_generate',   '"true"'),
  ('dead_stock_days',    '"90"');
