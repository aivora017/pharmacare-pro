-- PharmaCare Pro - Database Schema v1
-- Runs automatically on first start. Never edit; create 002_*.sql for changes.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

-- Track migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Roles & Users
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  permissions TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT,
  password_hash TEXT NOT NULL, role_id INTEGER NOT NULL REFERENCES roles(id),
  pin_hash TEXT, is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT, login_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
  device_info TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), updated_by INTEGER REFERENCES users(id)
);

-- Medicine Master
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS manufacturers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, country TEXT DEFAULT 'India');
CREATE TABLE IF NOT EXISTS medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, generic_name TEXT NOT NULL,
  manufacturer_id INTEGER REFERENCES manufacturers(id),
  category_id INTEGER REFERENCES categories(id),
  composition TEXT, hsn_code TEXT, schedule TEXT DEFAULT 'OTC',
  drug_form TEXT, strength TEXT, pack_size TEXT,
  default_gst_rate REAL NOT NULL DEFAULT 12.0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  reorder_quantity INTEGER NOT NULL DEFAULT 50,
  is_cold_chain INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  image_path TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT, created_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name, generic_name);
CREATE INDEX IF NOT EXISTS idx_medicines_active ON medicines(is_active, deleted_at);
CREATE TABLE IF NOT EXISTS medicine_alternates (
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  alternate_id INTEGER NOT NULL REFERENCES medicines(id),
  PRIMARY KEY (medicine_id, alternate_id)
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, contact_person TEXT, phone TEXT, email TEXT, email_domain TEXT,
  address TEXT, city TEXT, state TEXT, pincode TEXT,
  gstin TEXT, drug_licence_no TEXT, drug_licence_expiry TEXT, pan_no TEXT,
  payment_terms INTEGER DEFAULT 30, credit_limit REAL DEFAULT 0,
  outstanding_balance REAL DEFAULT 0, reliability_score REAL DEFAULT 50,
  notes TEXT, is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT
);

-- Batches (Stock)
CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  batch_number TEXT NOT NULL, barcode TEXT UNIQUE,
  expiry_date TEXT NOT NULL, manufacture_date TEXT,
  purchase_price REAL NOT NULL, selling_price REAL NOT NULL,
  quantity_in INTEGER NOT NULL DEFAULT 0,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  quantity_adjusted INTEGER NOT NULL DEFAULT 0,
  rack_location TEXT,
  supplier_id INTEGER REFERENCES suppliers(id),
  purchase_bill_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_batches_barcode ON batches(barcode);
CREATE INDEX IF NOT EXISTS idx_batches_medicine ON batches(medicine_id, is_active);
CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date, is_active);

-- Virtual column for stock on hand (SQLite 3.31+)
-- quantity_on_hand = quantity_in - quantity_sold - quantity_adjusted
-- (Compute this in SQL queries: quantity_in - quantity_sold - quantity_adjusted)

-- Doctors & Customers
CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, registration_no TEXT UNIQUE,
  specialisation TEXT, qualification TEXT, clinic_name TEXT,
  phone TEXT, email TEXT, address TEXT, notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT, phone2 TEXT, email TEXT,
  date_of_birth TEXT, gender TEXT, blood_group TEXT,
  address TEXT, pincode TEXT, doctor_id INTEGER REFERENCES doctors(id),
  allergies TEXT DEFAULT '[]', chronic_conditions TEXT DEFAULT '[]',
  outstanding_balance REAL NOT NULL DEFAULT 0.0,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  med_sync_date INTEGER, preferred_language TEXT DEFAULT 'en',
  communication_pref TEXT DEFAULT 'whatsapp',
  notes TEXT, photo_path TEXT, is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT, created_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Purchase
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'draft',
  order_date TEXT NOT NULL DEFAULT (date('now')),
  expected_by TEXT, notes TEXT, total_amount REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS purchase_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT NOT NULL, supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  bill_date TEXT NOT NULL, due_date TEXT,
  subtotal REAL NOT NULL DEFAULT 0, discount_amount REAL DEFAULT 0,
  taxable_amount REAL NOT NULL DEFAULT 0,
  cgst_amount REAL DEFAULT 0, sgst_amount REAL DEFAULT 0, igst_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  amount_paid REAL DEFAULT 0, payment_status TEXT DEFAULT 'unpaid',
  source TEXT DEFAULT 'manual', email_import_id INTEGER,
  notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS purchase_bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_bill_id INTEGER NOT NULL REFERENCES purchase_bills(id),
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  batch_id INTEGER REFERENCES batches(id),
  batch_number TEXT NOT NULL, expiry_date TEXT NOT NULL,
  quantity INTEGER NOT NULL, free_quantity INTEGER DEFAULT 0,
  unit_price REAL NOT NULL, discount_percent REAL DEFAULT 0,
  gst_rate REAL NOT NULL, cgst_amount REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0, igst_amount REAL DEFAULT 0, total_amount REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS email_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_from TEXT NOT NULL, email_subject TEXT, received_at TEXT NOT NULL,
  attachment_name TEXT, status TEXT DEFAULT 'pending', error_message TEXT,
  supplier_id INTEGER REFERENCES suppliers(id),
  rows_parsed INTEGER DEFAULT 0, rows_imported INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sales Bills
CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id),
  doctor_id INTEGER REFERENCES doctors(id),
  bill_date TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active',
  prescription_ref TEXT, prescription_image TEXT,
  subtotal REAL NOT NULL DEFAULT 0, discount_amount REAL NOT NULL DEFAULT 0,
  taxable_amount REAL NOT NULL DEFAULT 0,
  cgst_amount REAL NOT NULL DEFAULT 0, sgst_amount REAL NOT NULL DEFAULT 0,
  igst_amount REAL NOT NULL DEFAULT 0, total_amount REAL NOT NULL DEFAULT 0,
  round_off REAL DEFAULT 0, net_amount REAL NOT NULL DEFAULT 0,
  amount_paid REAL NOT NULL DEFAULT 0, change_returned REAL DEFAULT 0,
  outstanding REAL DEFAULT 0,
  loyalty_points_earned INTEGER DEFAULT 0, loyalty_points_redeemed INTEGER DEFAULT 0,
  notes TEXT, cancel_reason TEXT,
  cancelled_by INTEGER REFERENCES users(id), cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_bills_date ON bills(bill_date, status);
CREATE INDEX IF NOT EXISTS idx_bills_customer ON bills(customer_id);
CREATE TABLE IF NOT EXISTS bill_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  batch_id INTEGER NOT NULL REFERENCES batches(id),
  medicine_name TEXT NOT NULL, batch_number TEXT NOT NULL, expiry_date TEXT NOT NULL,
  quantity INTEGER NOT NULL, unit_price REAL NOT NULL, mrp REAL NOT NULL,
  discount_percent REAL DEFAULT 0, discount_amount REAL DEFAULT 0,
  gst_rate REAL NOT NULL,
  cgst_amount REAL DEFAULT 0, sgst_amount REAL DEFAULT 0, igst_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill ON bill_items(bill_id);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER REFERENCES bills(id),
  purchase_bill_id INTEGER REFERENCES purchase_bills(id),
  amount REAL NOT NULL, payment_mode TEXT NOT NULL,
  reference_no TEXT, payment_date TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT, created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS held_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL DEFAULT 'Held Bill',
  cart_data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);

-- Returns
CREATE TABLE IF NOT EXISTS sale_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_number TEXT NOT NULL UNIQUE,
  original_bill_id INTEGER NOT NULL REFERENCES bills(id),
  customer_id INTEGER REFERENCES customers(id),
  return_date TEXT NOT NULL DEFAULT (datetime('now')),
  reason TEXT, total_amount REAL NOT NULL,
  refund_mode TEXT, created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sale_return_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id INTEGER NOT NULL REFERENCES sale_returns(id),
  bill_item_id INTEGER NOT NULL REFERENCES bill_items(id),
  batch_id INTEGER NOT NULL REFERENCES batches(id),
  quantity INTEGER NOT NULL, unit_price REAL NOT NULL,
  gst_rate REAL NOT NULL, total_amount REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS purchase_returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debit_note_no TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  return_date TEXT NOT NULL DEFAULT (date('now')),
  reason TEXT, total_amount REAL NOT NULL,
  status TEXT DEFAULT 'raised', notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stock Adjustments
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES batches(id),
  adjustment_type TEXT NOT NULL,  -- 'damage', 'theft', 'expired', 'count_correction'
  quantity INTEGER NOT NULL, reason TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER NOT NULL REFERENCES users(id)
);

-- Audit Log (append-only - admin cannot delete)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id), user_name TEXT NOT NULL,
  action TEXT NOT NULL, module TEXT NOT NULL,
  record_id TEXT, old_value TEXT, new_value TEXT,
  ip_address TEXT, device_info TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_log(module, action, created_at);

-- Drug Interactions DB
CREATE TABLE IF NOT EXISTS drug_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drug1_name TEXT NOT NULL, drug2_name TEXT NOT NULL,
  severity TEXT NOT NULL,  -- 'minor', 'moderate', 'severe'
  description TEXT NOT NULL, recommendation TEXT NOT NULL,
  source TEXT DEFAULT 'CIMS',
  UNIQUE(drug1_name, drug2_name)
);
CREATE INDEX IF NOT EXISTS idx_interactions ON drug_interactions(drug1_name, drug2_name);

-- AI Tables
CREATE TABLE IF NOT EXISTS ai_demand_forecast (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  forecast_date TEXT NOT NULL, period_days INTEGER NOT NULL,
  predicted_qty INTEGER NOT NULL, confidence REAL NOT NULL,
  current_stock INTEGER NOT NULL, recommended_order INTEGER,
  UNIQUE(medicine_id, forecast_date, period_days)
);
CREATE TABLE IF NOT EXISTS ai_expiry_risk (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL UNIQUE REFERENCES batches(id),
  risk_score REAL NOT NULL, risk_level TEXT NOT NULL,
  sellable_days INTEGER, action_suggested TEXT,
  calculated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ai_customer_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES customers(id),
  segment TEXT NOT NULL,  -- 'champion', 'loyal', 'at_risk', 'dormant', 'new'
  rfm_score REAL, last_purchase_days INTEGER,
  avg_monthly_spend REAL, purchase_count_90d INTEGER,
  calculated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ai_anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anomaly_type TEXT NOT NULL, severity TEXT NOT NULL,
  description TEXT NOT NULL, record_type TEXT, record_id INTEGER,
  user_id INTEGER REFERENCES users(id),
  is_reviewed INTEGER DEFAULT 0,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TEXT, review_note TEXT,
  detected_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Reminders & Communications
CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  reminder_type TEXT NOT NULL,  -- 'refill', 'med_sync', 'birthday', 'credit_due'
  message TEXT NOT NULL, channel TEXT NOT NULL,  -- 'whatsapp', 'sms', 'email'
  scheduled_for TEXT NOT NULL, sent_at TEXT,
  status TEXT DEFAULT 'pending', error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- WhatsApp Message Log
CREATE TABLE IF NOT EXISTS message_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  channel TEXT NOT NULL, direction TEXT NOT NULL,  -- 'outbound', 'inbound'
  message TEXT NOT NULL, status TEXT DEFAULT 'sent',
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── SEED DATA ─────────────────────────────────────────────────
INSERT OR IGNORE INTO roles (name, permissions) VALUES
  ('admin',      '{"all": true}'),
  ('pharmacist', '{"billing":true,"medicine":true,"purchase":true,"customers":true,"reports":true,"expiry":true,"barcodes":true,"doctors":true,"suppliers":true}'),
  ('cashier',    '{"billing":true,"customers":true}'),
  ('accountant', '{"reports":true,"purchase":true,"suppliers":true}'),
  ('delivery',   '{"customers":true}');

INSERT OR IGNORE INTO categories (name) VALUES
  ('Tablets'),('Capsules'),('Syrups'),('Injections'),('Drops'),
  ('Creams & Ointments'),('Powders'),('Inhalers'),
  ('Medical Devices'),('Nutraceuticals'),('Surgical Items'),
  ('ORS & Fluids'),('Vitamins & Minerals'),('Antacids');

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('pharmacy_name',       '"PharmaCare Medical Store"'),
  ('gstin',               '""'),
  ('drug_licence_no',     '""'),
  ('address',             '""'),
  ('phone',               '""'),
  ('email',               '""'),
  ('city',                '""'),
  ('state',               '""'),
  ('pincode',             '""'),
  ('financial_year_start','"04"'),
  ('default_gst_rate',    '"12"'),
  ('low_stock_alert_days','"10"'),
  ('expiry_alert_days',   '"90"'),
  ('backup_auto',         '"daily"'),
  ('backup_path',         '""'),
  ('thermal_printer',     '""'),
  ('normal_printer',      '""'),
  ('barcode_printer',     '""'),
  ('thermal_width',       '"80"'),
  ('loyalty_points_rate', '"100"'),
  ('license_key',         '""'),
  ('license_status',      '"trial"'),
  ('trial_start_date',    '"' || date('now') || '"');

INSERT OR IGNORE INTO schema_migrations (version) VALUES ('001_initial');
