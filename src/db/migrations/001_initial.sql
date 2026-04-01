PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS roles(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,permissions TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role_id INTEGER NOT NULL REFERENCES roles(id),is_active INTEGER NOT NULL DEFAULT 1,login_attempts INTEGER NOT NULL DEFAULT 0,locked_until TEXT,last_login_at TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),created_at TEXT NOT NULL DEFAULT(datetime('now')),expires_at TEXT NOT NULL,revoked_at TEXT);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT(datetime('now')),updated_by INTEGER REFERENCES users(id));
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,contact_person TEXT,phone TEXT,email TEXT,email_domain TEXT,address TEXT,gstin TEXT,drug_licence_no TEXT,drug_licence_expiry TEXT,payment_terms INTEGER DEFAULT 30,credit_limit REAL DEFAULT 0,outstanding_balance REAL DEFAULT 0,is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),deleted_at TEXT);
CREATE TABLE IF NOT EXISTS medicines(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,generic_name TEXT NOT NULL DEFAULT '',composition TEXT,hsn_code TEXT,schedule TEXT NOT NULL DEFAULT 'OTC',drug_form TEXT,strength TEXT,pack_size TEXT,default_gst_rate REAL NOT NULL DEFAULT 12.0,reorder_level INTEGER NOT NULL DEFAULT 10,reorder_quantity INTEGER NOT NULL DEFAULT 50,is_cold_chain INTEGER NOT NULL DEFAULT 0,is_active INTEGER NOT NULL DEFAULT 1,category_id INTEGER REFERENCES categories(id),notes TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),deleted_at TEXT,created_by INTEGER REFERENCES users(id));
CREATE INDEX IF NOT EXISTS idx_med_name ON medicines(name,generic_name);
CREATE TABLE IF NOT EXISTS batches(id INTEGER PRIMARY KEY AUTOINCREMENT,medicine_id INTEGER NOT NULL REFERENCES medicines(id),batch_number TEXT NOT NULL,barcode TEXT UNIQUE,expiry_date TEXT NOT NULL,manufacture_date TEXT,purchase_price REAL NOT NULL DEFAULT 0,selling_price REAL NOT NULL DEFAULT 0,quantity_in INTEGER NOT NULL DEFAULT 0,quantity_sold INTEGER NOT NULL DEFAULT 0,quantity_adjusted INTEGER NOT NULL DEFAULT 0,rack_location TEXT,supplier_id INTEGER REFERENCES suppliers(id),is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_batch_barcode ON batches(barcode);
CREATE INDEX IF NOT EXISTS idx_batch_med ON batches(medicine_id,is_active);
CREATE INDEX IF NOT EXISTS idx_batch_expiry ON batches(expiry_date);
CREATE TABLE IF NOT EXISTS doctors(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,registration_no TEXT UNIQUE,specialisation TEXT,qualification TEXT,clinic_name TEXT,phone TEXT,email TEXT,notes TEXT,is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,phone2 TEXT,email TEXT,date_of_birth TEXT,gender TEXT,blood_group TEXT,address TEXT,doctor_id INTEGER REFERENCES doctors(id),allergies TEXT DEFAULT '[]',chronic_conditions TEXT DEFAULT '[]',outstanding_balance REAL NOT NULL DEFAULT 0,loyalty_points INTEGER NOT NULL DEFAULT 0,notes TEXT,is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')),deleted_at TEXT,created_by INTEGER REFERENCES users(id));
CREATE INDEX IF NOT EXISTS idx_cust_phone ON customers(phone);
CREATE TABLE IF NOT EXISTS purchase_bills(id INTEGER PRIMARY KEY AUTOINCREMENT,bill_number TEXT NOT NULL,supplier_id INTEGER NOT NULL REFERENCES suppliers(id),bill_date TEXT NOT NULL DEFAULT(date('now')),due_date TEXT,total_amount REAL NOT NULL DEFAULT 0,amount_paid REAL DEFAULT 0,payment_status TEXT DEFAULT 'unpaid',notes TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),created_by INTEGER REFERENCES users(id));
CREATE TABLE IF NOT EXISTS bills(id INTEGER PRIMARY KEY AUTOINCREMENT,bill_number TEXT NOT NULL UNIQUE,customer_id INTEGER REFERENCES customers(id),doctor_id INTEGER REFERENCES doctors(id),bill_date TEXT NOT NULL DEFAULT(datetime('now')),status TEXT NOT NULL DEFAULT 'active',subtotal REAL NOT NULL DEFAULT 0,discount_amount REAL NOT NULL DEFAULT 0,taxable_amount REAL NOT NULL DEFAULT 0,cgst_amount REAL NOT NULL DEFAULT 0,sgst_amount REAL NOT NULL DEFAULT 0,igst_amount REAL NOT NULL DEFAULT 0,total_amount REAL NOT NULL DEFAULT 0,round_off REAL DEFAULT 0,net_amount REAL NOT NULL DEFAULT 0,amount_paid REAL NOT NULL DEFAULT 0,outstanding REAL DEFAULT 0,loyalty_points_earned INTEGER DEFAULT 0,loyalty_points_redeemed INTEGER DEFAULT 0,notes TEXT,cancel_reason TEXT,cancelled_by INTEGER REFERENCES users(id),cancelled_at TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')),created_by INTEGER NOT NULL REFERENCES users(id));
CREATE INDEX IF NOT EXISTS idx_bill_date ON bills(bill_date,status);
CREATE INDEX IF NOT EXISTS idx_bill_cust ON bills(customer_id);
CREATE TABLE IF NOT EXISTS bill_items(id INTEGER PRIMARY KEY AUTOINCREMENT,bill_id INTEGER NOT NULL REFERENCES bills(id),medicine_id INTEGER NOT NULL REFERENCES medicines(id),batch_id INTEGER NOT NULL REFERENCES batches(id),medicine_name TEXT NOT NULL,batch_number TEXT NOT NULL,expiry_date TEXT NOT NULL,quantity INTEGER NOT NULL,unit_price REAL NOT NULL,mrp REAL NOT NULL DEFAULT 0,discount_percent REAL DEFAULT 0,discount_amount REAL DEFAULT 0,gst_rate REAL NOT NULL DEFAULT 0,cgst_amount REAL DEFAULT 0,sgst_amount REAL DEFAULT 0,igst_amount REAL DEFAULT 0,total_amount REAL NOT NULL);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT,bill_id INTEGER REFERENCES bills(id),purchase_bill_id INTEGER REFERENCES purchase_bills(id),amount REAL NOT NULL,payment_mode TEXT NOT NULL DEFAULT 'cash',reference_no TEXT,payment_date TEXT NOT NULL DEFAULT(datetime('now')),created_by INTEGER REFERENCES users(id),created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS held_bills(id INTEGER PRIMARY KEY AUTOINCREMENT,label TEXT NOT NULL DEFAULT 'Held Bill',cart_data TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),created_by INTEGER REFERENCES users(id));
CREATE TABLE IF NOT EXISTS sale_returns(id INTEGER PRIMARY KEY AUTOINCREMENT,return_number TEXT NOT NULL UNIQUE,original_bill_id INTEGER NOT NULL REFERENCES bills(id),return_date TEXT NOT NULL DEFAULT(datetime('now')),reason TEXT,total_amount REAL NOT NULL DEFAULT 0,created_by INTEGER REFERENCES users(id),created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS stock_adjustments(id INTEGER PRIMARY KEY AUTOINCREMENT,batch_id INTEGER NOT NULL REFERENCES batches(id),adjustment_type TEXT NOT NULL,quantity INTEGER NOT NULL,reason TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),created_by INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS audit_log(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER REFERENCES users(id),user_name TEXT NOT NULL DEFAULT '',action TEXT NOT NULL,module TEXT NOT NULL,record_id TEXT,old_value TEXT,new_value TEXT,notes TEXT,created_at TEXT NOT NULL DEFAULT(datetime('now')));

INSERT OR IGNORE INTO roles(name,permissions) VALUES ('admin','{"all":true}'),('pharmacist','{"billing":true,"medicine":true,"purchase":true,"customers":true,"reports":true,"expiry":true}'),('cashier','{"billing":true,"customers":true}'),('accountant','{"reports":true,"purchase":true}');
INSERT OR IGNORE INTO categories(name) VALUES('Tablets'),('Capsules'),('Syrups'),('Injections'),('Drops'),('Creams & Ointments'),('Powders'),('Inhalers'),('Medical Devices'),('Nutraceuticals'),('Surgical Items'),('Vitamins & Minerals'),('Antacids'),('ORS & Fluids');
INSERT OR IGNORE INTO settings(key,value) VALUES('pharmacy_name','"PharmaCare Medical Store"'),('pharmacy_address','""'),('pharmacy_phone','""'),('gstin','""'),('drug_licence_no','""'),('financial_year_start','"04"'),('low_stock_alert_days','"10"'),('expiry_alert_days','"90"'),('thermal_printer','""'),('claude_api_key','""'),('whatsapp_token','""'),('license_status','"trial"'),('trial_started','"'||date('now')||'"'),('session_token','""');

CREATE TABLE IF NOT EXISTS drug_interactions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drug1 TEXT NOT NULL,
  drug2 TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate',
  description TEXT NOT NULL,
  management TEXT NOT NULL DEFAULT 'Monitor closely.',
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_di_drug1 ON drug_interactions(lower(drug1));
CREATE INDEX IF NOT EXISTS idx_di_drug2 ON drug_interactions(lower(drug2));

CREATE TABLE IF NOT EXISTS sync_queue(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT(datetime('now'))
);

-- Drug interaction seed data (common Indian pharmacy interactions)
INSERT OR IGNORE INTO drug_interactions(drug1,drug2,severity,description,management) VALUES
('warfarin','aspirin','major','Aspirin increases anticoagulant effect of warfarin, raising bleeding risk significantly.','Avoid combination. If necessary, monitor INR closely and use lowest aspirin dose.'),
('warfarin','ibuprofen','major','NSAIDs increase warfarin effect and cause GI bleeding.','Avoid. Use paracetamol for pain relief instead.'),
('warfarin','metronidazole','major','Metronidazole inhibits warfarin metabolism, greatly increasing INR.','Reduce warfarin dose by 25-50%. Monitor INR daily.'),
('warfarin','ciprofloxacin','moderate','Ciprofloxacin may increase INR in warfarin patients.','Monitor INR 2 days after starting, adjust warfarin dose as needed.'),
('warfarin','fluconazole','major','Fluconazole strongly inhibits warfarin metabolism.','Reduce warfarin by 50%. Monitor INR every 2 days.'),
('metformin','alcohol','moderate','Alcohol increases risk of lactic acidosis with metformin.','Advise patient to limit alcohol intake.'),
('metformin','contrast dye','major','Iodinated contrast can cause acute kidney injury, leading to metformin accumulation and lactic acidosis.','Hold metformin 48 hours before and after contrast procedures.'),
('amlodipine','simvastatin','major','Amlodipine inhibits simvastatin metabolism, increasing risk of myopathy.','Do not exceed simvastatin 20mg/day with amlodipine. Use rosuvastatin instead.'),
('atorvastatin','clarithromycin','moderate','Clarithromycin raises atorvastatin levels, increasing myopathy risk.','Reduce atorvastatin dose or temporarily discontinue during clarithromycin course.'),
('metoprolol','diltiazem','major','Combination causes severe bradycardia and heart block.','Monitor heart rate and ECG closely. Consider alternative.'),
('metoprolol','verapamil','major','Combination causes severe bradycardia, hypotension, and heart block.','Combination is generally contraindicated.'),
('lisinopril','potassium','moderate','ACE inhibitors raise potassium levels; potassium supplements worsen this.','Monitor serum potassium. Avoid high-potassium supplements unless monitored.'),
('enalapril','potassium','moderate','ACE inhibitors raise potassium. Combination increases hyperkalemia risk.','Monitor serum potassium level regularly.'),
('ciprofloxacin','antacid','moderate','Antacids reduce ciprofloxacin absorption by up to 90%.','Take ciprofloxacin 2 hours before or 6 hours after antacids.'),
('tetracycline','iron','moderate','Iron reduces tetracycline absorption significantly.','Take tetracycline 2 hours before or 3 hours after iron supplements.'),
('tetracycline','calcium','moderate','Calcium chelates tetracycline, reducing absorption.','Separate administration by at least 2-3 hours.'),
('phenytoin','carbamazepine','moderate','Variable interaction; may increase or decrease phenytoin levels.','Monitor phenytoin levels when adding or changing carbamazepine.'),
('phenytoin','fluconazole','major','Fluconazole markedly increases phenytoin levels, causing toxicity.','Monitor phenytoin levels closely. May need dose reduction.'),
('clopidogrel','omeprazole','moderate','Omeprazole reduces clopidogrel activation (active metabolite formation).','Consider pantoprazole instead of omeprazole for GI protection.'),
('tramadol','ssri','major','Combination increases serotonin syndrome risk.','Avoid if possible. Monitor for agitation, confusion, rapid heart rate.'),
('tramadol','tricyclic','major','Tricyclic antidepressants increase risk of seizures and serotonin syndrome with tramadol.','Avoid. If necessary, use lowest doses and monitor closely.'),
('sildenafil','nitrate','major','Combination causes severe life-threatening hypotension.','Absolutely contraindicated. Nitrates must not be used within 24 hours of sildenafil.'),
('lithium','ibuprofen','major','NSAIDs raise lithium levels, causing toxicity.','Avoid NSAIDs in patients on lithium. Use paracetamol.'),
('lithium','diclofenac','major','Diclofenac raises lithium levels by reducing renal clearance.','Avoid. Monitor lithium level if combination unavoidable.'),
('digoxin','amiodarone','major','Amiodarone increases digoxin levels 1.5-2x, causing toxicity.','Reduce digoxin dose by 50% and monitor levels.'),
('digoxin','clarithromycin','moderate','Clarithromycin increases digoxin levels by inhibiting P-glycoprotein.','Monitor for digoxin toxicity. Reduce dose if needed.'),
('theophylline','ciprofloxacin','major','Ciprofloxacin increases theophylline levels 2-3 fold.','Reduce theophylline dose by 30-50%. Monitor levels.'),
('theophylline','clarithromycin','moderate','Clarithromycin inhibits theophylline metabolism.','Monitor theophylline levels. Consider dose reduction.'),
('insulin','alcohol','moderate','Alcohol can cause hypoglycemia in diabetic patients on insulin.','Monitor blood sugar carefully. Eat before drinking alcohol.'),
('glibenclamide','fluconazole','major','Fluconazole increases glibenclamide levels, causing severe hypoglycemia.','Avoid. If necessary, monitor blood glucose closely.'),
('glimepiride','fluconazole','major','Fluconazole increases sulfonylurea levels, causing hypoglycemia.','Monitor blood glucose closely. Consider dose reduction.'),
('methotrexate','nsaids','major','NSAIDs reduce methotrexate excretion, causing toxicity.','Avoid NSAIDs during methotrexate therapy. Use paracetamol.'),
('methotrexate','cotrimoxazole','major','Cotrimoxazole potentiates methotrexate bone marrow toxicity.','Combination is generally contraindicated.'),
('corticosteroid','nsaids','moderate','Combination greatly increases risk of peptic ulcer and GI bleeding.','Prescribe gastroprotection (PPI or misoprostol). Minimize duration.'),
('spironolactone','potassium','major','Spironolactone is potassium-sparing; potassium supplements risk hyperkalemia.','Avoid routine potassium supplementation. Monitor electrolytes.'),
('fluoxetine','tramadol','major','High serotonin syndrome risk with this combination.','Avoid. Switch to non-serotonergic analgesic.'),
('aspirin','ibuprofen','moderate','Ibuprofen blocks aspirin anti-platelet effect when taken together.','Take aspirin 30 minutes before, or 8 hours after ibuprofen.'),
('calcium','iron','minor','Calcium reduces iron absorption.','Separate by at least 2 hours.'),
('levothyroxine','calcium','moderate','Calcium significantly reduces levothyroxine absorption.','Take levothyroxine 4 hours apart from calcium.'),
('levothyroxine','iron','moderate','Iron chelates levothyroxine, reducing absorption by up to 50%.','Take levothyroxine 4 hours apart from iron.'),
('alendronate','nsaids','moderate','Both irritate esophageal and gastric mucosa; combination increases ulcer risk.','Avoid NSAIDs within 30 minutes of alendronate dosing.'),
('rifampicin','contraceptive','major','Rifampicin is a potent enzyme inducer that reduces oral contraceptive effectiveness.','Use additional contraception during rifampicin therapy and 4 weeks after.'),
('rifampicin','warfarin','major','Rifampicin dramatically reduces warfarin levels via CYP450 induction.','Greatly increase warfarin dose during rifampicin. Monitor INR every 2-3 days.'),
('carbamazepine','contraceptive','major','Carbamazepine reduces contraceptive effectiveness.','Use barrier methods or injectable/IUD contraception.'),
('isoniazid','paracetamol','moderate','Isoniazid increases paracetamol-induced hepatotoxicity.','Limit paracetamol dose. Avoid in patients with hepatic impairment.');
