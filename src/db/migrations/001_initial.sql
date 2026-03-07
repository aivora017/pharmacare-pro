-- ============================================================
-- PharmaCare Pro — Database Schema
-- Migration 001: Initial Schema
-- ============================================================
-- Run this once when the app is first installed.
-- The app runs this automatically on startup.
-- NEVER modify this file — create a new migration file instead.
-- ============================================================

PRAGMA journal_mode = WAL;       -- Better performance for concurrent reads
PRAGMA foreign_keys = ON;        -- Enforce relationships between tables
PRAGMA synchronous = NORMAL;     -- Balance between safety and speed

-- ─────────────────────────────────────────────────────────────
-- SECTION 1: USERS & SECURITY
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,                    -- 'admin', 'pharmacist', 'cashier', 'accountant'
  permissions TEXT NOT NULL DEFAULT '{}',             -- JSON: { "billing": true, "reports": false, ... }
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  phone           TEXT,
  password_hash   TEXT NOT NULL,                      -- bcrypt hash, NEVER plain text
  role_id         INTEGER NOT NULL REFERENCES roles(id),
  pin_hash        TEXT,                               -- Optional 4-digit PIN for quick re-auth
  is_active       INTEGER NOT NULL DEFAULT 1,         -- 0 = deactivated (soft disable)
  last_login_at   TEXT,
  login_attempts  INTEGER NOT NULL DEFAULT 0,         -- Lock account after 5 failed attempts
  locked_until    TEXT,                               -- NULL = not locked
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT                                -- Soft delete
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,                       -- JWT token ID (jti claim)
  user_id     INTEGER NOT NULL REFERENCES users(id),
  device_info TEXT,                                   -- OS + machine name for display
  ip_address  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT                                    -- NULL = active
);

-- ─────────────────────────────────────────────────────────────
-- SECTION 2: PHARMACY SETTINGS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,                       -- e.g. 'pharmacy_name', 'gstin'
  value       TEXT NOT NULL,                          -- JSON-encoded value
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by  INTEGER REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────────
-- SECTION 3: MEDICINE MASTER
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,                   -- 'Tablets', 'Syrups', 'Injections', etc.
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS manufacturers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  country     TEXT DEFAULT 'India',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medicines (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,                  -- Brand name
  generic_name        TEXT NOT NULL,                  -- Generic/salt name
  manufacturer_id     INTEGER REFERENCES manufacturers(id),
  category_id         INTEGER REFERENCES categories(id),
  composition         TEXT,                           -- Active ingredients list
  hsn_code            TEXT,                           -- HSN/SAC code for GST
  schedule            TEXT DEFAULT 'OTC',             -- 'OTC', 'H', 'H1', 'X', 'Narcotic'
  drug_form           TEXT,                           -- 'Tablet', 'Capsule', 'Syrup', etc.
  strength            TEXT,                           -- e.g. '500mg', '10mg/5ml'
  pack_size           TEXT,                           -- e.g. '10 tablets', '100ml'
  default_gst_rate    REAL NOT NULL DEFAULT 12.0,     -- GST % (0, 5, 12, 18)
  reorder_level       INTEGER NOT NULL DEFAULT 10,    -- Alert when stock falls below this
  reorder_quantity    INTEGER NOT NULL DEFAULT 50,    -- Suggested order quantity
  is_cold_chain       INTEGER NOT NULL DEFAULT 0,     -- 1 = needs refrigeration
  is_active           INTEGER NOT NULL DEFAULT 1,
  image_path          TEXT,                           -- Local path to medicine image
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at          TEXT,
  created_by          INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS medicine_alternates (
  medicine_id     INTEGER NOT NULL REFERENCES medicines(id),
  alternate_id    INTEGER NOT NULL REFERENCES medicines(id),
  PRIMARY KEY (medicine_id, alternate_id)
);

CREATE TABLE IF NOT EXISTS batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id     INTEGER NOT NULL REFERENCES medicines(id),
  batch_number    TEXT NOT NULL,
  barcode         TEXT UNIQUE,                        -- Generated barcode string
  expiry_date     TEXT NOT NULL,                      -- ISO date: 'YYYY-MM-DD'
  manufacture_date TEXT,
  purchase_price  REAL NOT NULL,                      -- Price we paid (cost price)
  selling_price   REAL NOT NULL,                      -- MRP
  quantity_in     INTEGER NOT NULL DEFAULT 0,         -- Received in this batch
  quantity_sold   INTEGER NOT NULL DEFAULT 0,         -- Total sold
  quantity_adjusted INTEGER NOT NULL DEFAULT 0,       -- Lost/damaged/write-off
  -- quantity_on_hand = quantity_in - quantity_sold - quantity_adjusted
  rack_location   TEXT,                               -- e.g. 'A-2-3' (Rack A, Shelf 2, Bin 3)
  supplier_id     INTEGER REFERENCES suppliers(id),
  purchase_bill_id INTEGER REFERENCES purchase_bills(id),
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fast lookup index for barcode scanning at POS
CREATE INDEX IF NOT EXISTS idx_batches_barcode ON batches(barcode);
CREATE INDEX IF NOT EXISTS idx_batches_medicine ON batches(medicine_id, is_active);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date, is_active);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name, generic_name);

-- ─────────────────────────────────────────────────────────────
-- SECTION 4: DOCTORS & CUSTOMERS (PATIENTS)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS doctors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  registration_no TEXT UNIQUE,                        -- MCI/NMC registration number
  specialisation  TEXT,
  qualification   TEXT,
  clinic_name     TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  notes           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  phone               TEXT,                           -- Primary contact (used for WhatsApp/SMS)
  phone2              TEXT,                           -- Secondary contact
  email               TEXT,
  date_of_birth       TEXT,                           -- ISO date for age calculation
  gender              TEXT,                           -- 'M', 'F', 'Other'
  blood_group         TEXT,
  address             TEXT,
  pincode             TEXT,
  doctor_id           INTEGER REFERENCES doctors(id), -- Primary treating doctor
  allergies           TEXT,                           -- JSON array: ['Penicillin', 'Sulfa']
  chronic_conditions  TEXT,                           -- JSON array: ['Diabetes', 'Hypertension']
  outstanding_balance REAL NOT NULL DEFAULT 0.0,      -- Positive = customer owes money
  loyalty_points      INTEGER NOT NULL DEFAULT 0,
  med_sync_date       INTEGER,                        -- Day of month for medication sync (1-31)
  preferred_language  TEXT DEFAULT 'en',              -- For WhatsApp messages
  communication_pref  TEXT DEFAULT 'whatsapp',        -- 'whatsapp', 'sms', 'email', 'none'
  notes               TEXT,
  photo_path          TEXT,                           -- Local path to customer photo
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at          TEXT,
  created_by          INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- ─────────────────────────────────────────────────────────────
-- SECTION 5: SUPPLIERS / DISTRIBUTORS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  contact_person      TEXT,
  phone               TEXT,
  email               TEXT,                           -- Used to match incoming emails for auto-import
  email_domain        TEXT,                           -- e.g. 'apollopharmacy.com' for auto-matching
  address             TEXT,
  city                TEXT,
  state               TEXT,
  pincode             TEXT,
  gstin               TEXT,
  drug_licence_no     TEXT,
  drug_licence_expiry TEXT,
  pan_no              TEXT,
  payment_terms       INTEGER DEFAULT 30,             -- Credit days
  credit_limit        REAL DEFAULT 0,
  outstanding_balance REAL DEFAULT 0,                 -- We owe this to supplier
  reliability_score   REAL DEFAULT 50,                -- 0-100, calculated by AI
  notes               TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at          TEXT
);

-- ─────────────────────────────────────────────────────────────
-- SECTION 6: PURCHASE MANAGEMENT
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_orders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number       TEXT NOT NULL UNIQUE,               -- PO-2025-0001
  supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
  status          TEXT NOT NULL DEFAULT 'draft',      -- 'draft', 'sent', 'partial', 'closed'
  order_date      TEXT NOT NULL DEFAULT (date('now')),
  expected_by     TEXT,
  notes           TEXT,
  total_amount    REAL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_by      INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id   INTEGER NOT NULL REFERENCES purchase_orders(id),
  medicine_id         INTEGER NOT NULL REFERENCES medicines(id),
  quantity_ordered    INTEGER NOT NULL,
  quantity_received   INTEGER DEFAULT 0,
  unit_price          REAL,
  ai_suggested        INTEGER DEFAULT 0               -- 1 = this quantity was suggested by AI
);

CREATE TABLE IF NOT EXISTS purchase_bills (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number         TEXT NOT NULL,                  -- Distributor's invoice number
  supplier_id         INTEGER NOT NULL REFERENCES suppliers(id),
  purchase_order_id   INTEGER REFERENCES purchase_orders(id),
  bill_date           TEXT NOT NULL,
  due_date            TEXT,
  subtotal            REAL NOT NULL DEFAULT 0,
  discount_amount     REAL DEFAULT 0,
  taxable_amount      REAL NOT NULL DEFAULT 0,
  cgst_amount         REAL DEFAULT 0,
  sgst_amount         REAL DEFAULT 0,
  igst_amount         REAL DEFAULT 0,
  total_amount        REAL NOT NULL DEFAULT 0,
  amount_paid         REAL DEFAULT 0,
  payment_status      TEXT DEFAULT 'unpaid',          -- 'unpaid', 'partial', 'paid'
  source              TEXT DEFAULT 'manual',          -- 'manual', 'email_import'
  email_import_id     INTEGER REFERENCES email_imports(id),
  notes               TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  created_by          INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_bill_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_bill_id    INTEGER NOT NULL REFERENCES purchase_bills(id),
  medicine_id         INTEGER NOT NULL REFERENCES medicines(id),
  batch_id            INTEGER REFERENCES batches(id), -- Created when GRN is confirmed
  batch_number        TEXT NOT NULL,
  expiry_date         TEXT NOT NULL,
  quantity            INTEGER NOT NULL,
  free_quantity       INTEGER DEFAULT 0,
  unit_price          REAL NOT NULL,
  discount_percent    REAL DEFAULT 0,
  gst_rate            REAL NOT NULL,
  cgst_amount         REAL DEFAULT 0,
  sgst_amount         REAL DEFAULT 0,
  igst_amount         REAL DEFAULT 0,
  total_amount        REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS email_imports (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email_from      TEXT NOT NULL,
  email_subject   TEXT,
  received_at     TEXT NOT NULL,
  attachment_name TEXT,
  status          TEXT DEFAULT 'pending',             -- 'pending', 'imported', 'skipped', 'error'
  error_message   TEXT,
  supplier_id     INTEGER REFERENCES suppliers(id),
  rows_parsed     INTEGER DEFAULT 0,
  rows_imported   INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────
-- SECTION 7: SALES BILLING
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bills (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number         TEXT NOT NULL UNIQUE,           -- POS-2025-00001
  customer_id         INTEGER REFERENCES customers(id),
  doctor_id           INTEGER REFERENCES doctors(id),
  bill_date           TEXT NOT NULL DEFAULT (datetime('now')),
  status              TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'returned'
  prescription_ref    TEXT,                           -- Doctor's prescription number
  prescription_image  TEXT,                           -- Local path to uploaded prescription
  subtotal            REAL NOT NULL DEFAULT 0,
  discount_amount     REAL NOT NULL DEFAULT 0,
  taxable_amount      REAL NOT NULL DEFAULT 0,
  cgst_amount         REAL NOT NULL DEFAULT 0,
  sgst_amount         REAL NOT NULL DEFAULT 0,
  igst_amount         REAL NOT NULL DEFAULT 0,
  total_amount        REAL NOT NULL DEFAULT 0,
  round_off           REAL DEFAULT 0,
  net_amount          REAL NOT NULL DEFAULT 0,
  amount_paid         REAL NOT NULL DEFAULT 0,
  change_returned     REAL DEFAULT 0,
  outstanding         REAL DEFAULT 0,
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_redeemed INTEGER DEFAULT 0,
  notes               TEXT,
  cancel_reason       TEXT,
  cancelled_by        INTEGER REFERENCES users(id),
  cancelled_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  created_by          INTEGER NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bill_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id             INTEGER NOT NULL REFERENCES bills(id),
  medicine_id         INTEGER NOT NULL REFERENCES medicines(id),
  batch_id            INTEGER NOT NULL REFERENCES batches(id),
  medicine_name       TEXT NOT NULL,                  -- Snapshot at time of sale
  batch_number        TEXT NOT NULL,
  expiry_date         TEXT NOT NULL,
  quantity            INTEGER NOT NULL,
  unit_price          REAL NOT NULL,
  mrp                 REAL NOT NULL,
  discount_percent    REAL DEFAULT 0,
  discount_amount     REAL DEFAULT 0,
  gst_rate            REAL NOT NULL,
  cgst_amount         REAL DEFAULT 0,
  sgst_amount         REAL DEFAULT 0,
  igst_amount         REAL DEFAULT 0,
  total_amount        REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id         INTEGER REFERENCES bills(id),
  purchase_bill_id INTEGER REFERENCES purchase_bills(id),
  amount          REAL NOT NULL,
  payment_mode    TEXT NOT NULL,                      -- 'cash', 'upi', 'card', 'credit', 'cheque'
  reference_no    TEXT,                               -- UPI UTR / card last 4 / cheque no
  payment_date    TEXT NOT NULL DEFAULT (datetime('now')),
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS held_bills (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL DEFAULT 'Held Bill',     -- Custom label set by cashier
  cart_data   TEXT NOT NULL,                          -- JSON snapshot of cart
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_by  INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date, status);
CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);

-- ─────────────────────────────────────────────────────────────
-- SECTION 8: RETURNS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sale_returns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number   TEXT NOT NULL UNIQUE,
  original_bill_id INTEGER NOT NULL REFERENCES bills(id),
  customer_id     INTEGER REFERENCES customers(id),
  return_date     TEXT NOT NULL DEFAULT (datetime('now')),
  reason          TEXT,
  total_amount    REAL NOT NULL,
  refund_mode     TEXT,                               -- 'cash', 'credit_note', 'bank'
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_returns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  debit_note_no   TEXT NOT NULL UNIQUE,
  supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
  return_date     TEXT NOT NULL DEFAULT (date('now')),
  reason          TEXT,
  total_amount    REAL NOT NULL,
  status          TEXT DEFAULT 'raised',              -- 'raised', 'acknowledged', 'credited'
  credit_amount   REAL DEFAULT 0,
  notes           TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_return_items (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_return_id  INTEGER NOT NULL REFERENCES purchase_returns(id),
  batch_id            INTEGER NOT NULL REFERENCES batches(id),
  medicine_id         INTEGER NOT NULL REFERENCES medicines(id),
  quantity            INTEGER NOT NULL,
  unit_price          REAL NOT NULL,
  total_amount        REAL NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- SECTION 9: STOCK MANAGEMENT
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id        INTEGER NOT NULL REFERENCES batches(id),
  adjustment_type TEXT NOT NULL,                      -- 'damage', 'theft', 'expired', 'stocktake_correction', 'other'
  quantity        INTEGER NOT NULL,                   -- Can be negative (stock reduce) or positive (increase)
  reason          TEXT NOT NULL,
  reference_no    TEXT,                               -- Physical stocktake sheet no, etc.
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_by      INTEGER NOT NULL REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────────
-- SECTION 10: AUDIT & SECURITY
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER REFERENCES users(id),
  user_name       TEXT NOT NULL,                      -- Snapshot in case user is deleted
  action          TEXT NOT NULL,                      -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PRINT'
  module          TEXT NOT NULL,                      -- 'billing', 'medicine', 'user', etc.
  record_id       TEXT,                               -- ID of the affected record
  old_value       TEXT,                               -- JSON snapshot before change
  new_value       TEXT,                               -- JSON snapshot after change
  ip_address      TEXT,
  device_info     TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log is APPEND-ONLY — no updates or deletes allowed (enforced in application layer)
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_log(module, action, created_at);

-- ─────────────────────────────────────────────────────────────
-- SECTION 11: AI FEATURE TABLES
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_demand_forecast (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id     INTEGER NOT NULL REFERENCES medicines(id),
  forecast_date   TEXT NOT NULL,                      -- Date this forecast was generated
  period_days     INTEGER NOT NULL,                   -- 7, 14, or 30
  predicted_qty   INTEGER NOT NULL,
  confidence      REAL NOT NULL,                      -- 0.0 - 1.0
  current_stock   INTEGER NOT NULL,                   -- Stock at time of forecast
  recommended_order INTEGER,                          -- Suggested PO quantity
  UNIQUE(medicine_id, forecast_date, period_days)
);

CREATE TABLE IF NOT EXISTS ai_expiry_risk (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id        INTEGER NOT NULL UNIQUE REFERENCES batches(id),
  risk_score      REAL NOT NULL,                      -- 1.0 (low) to 10.0 (critical)
  risk_level      TEXT NOT NULL,                      -- 'low', 'medium', 'high', 'critical'
  sellable_days   INTEGER,                            -- Days until stock would be sold at current velocity
  action_suggested TEXT,                              -- 'return_to_supplier', 'discount_sale', 'monitor'
  calculated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_customer_segments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL UNIQUE REFERENCES customers(id),
  segment         TEXT NOT NULL,                      -- 'champion', 'chronic', 'at_risk', 'dormant', 'new', 'high_value'
  clv_score       REAL,                               -- Customer Lifetime Value score
  last_purchase_days INTEGER,                         -- Days since last purchase
  avg_monthly_spend REAL,
  calculated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_anomalies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  anomaly_type    TEXT NOT NULL,                      -- 'high_discount', 'negative_stock', 'unusual_sales', 'after_hours', etc.
  severity        TEXT NOT NULL,                      -- 'low', 'medium', 'high'
  description     TEXT NOT NULL,
  record_type     TEXT,                               -- 'bill', 'stock', 'payment'
  record_id       INTEGER,
  user_id         INTEGER REFERENCES users(id),
  is_reviewed     INTEGER DEFAULT 0,
  reviewed_by     INTEGER REFERENCES users(id),
  reviewed_at     TEXT,
  review_note     TEXT,
  detected_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────
-- SECTION 12: NOTIFICATIONS & REMINDERS
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reminders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id     INTEGER NOT NULL REFERENCES customers(id),
  reminder_type   TEXT NOT NULL,                      -- 'refill', 'med_sync', 'birthday', 'credit_due'
  message         TEXT NOT NULL,
  channel         TEXT NOT NULL,                      -- 'whatsapp', 'sms', 'email'
  scheduled_for   TEXT NOT NULL,
  sent_at         TEXT,
  status          TEXT DEFAULT 'pending',             -- 'pending', 'sent', 'failed'
  error_message   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────
-- SECTION 13: SEED DATA — Default Roles & Settings
-- ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO roles (name, permissions) VALUES
('admin', '{"all": true}'),
('pharmacist', '{"billing": true, "medicine": true, "purchase": true, "customers": true, "reports": true, "expiry": true, "barcodes": true}'),
('cashier', '{"billing": true, "customers": true}'),
('accountant', '{"reports": true, "purchase": true}');

INSERT OR IGNORE INTO categories (name) VALUES
('Tablets'), ('Capsules'), ('Syrups'), ('Injections'), ('Drops'),
('Creams & Ointments'), ('Powders'), ('Suppositories'), ('Inhalers'),
('Medical Devices'), ('Nutraceuticals'), ('Surgical Items');

INSERT OR IGNORE INTO settings (key, value) VALUES
('pharmacy_name', '"PharmaCare Medical Store"'),
('gstin', '""'),
('drug_licence_no', '""'),
('address', '""'),
('phone', '""'),
('email', '""'),
('financial_year_start', '"04"'),
('default_gst_rate', '12'),
('low_stock_alert_days', '10'),
('expiry_alert_days', '90'),
('backup_auto', '"daily"'),
('backup_path', '"./backups"'),
('thermal_printer_name', '""'),
('normal_printer_name', '""'),
('barcode_printer_name', '""'),
('whatsapp_api_key', '""'),
('claude_api_key', '""'),
('license_key', '""'),
('license_status', '"trial"'),
('trial_start_date', '"' || date('now') || '"');
