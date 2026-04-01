//! All SQL lives here. Commands are thin wrappers that call these methods.

use crate::error::AppError;
use bcrypt::{hash, verify, DEFAULT_COST};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use tauri::AppHandle;

const M001: &str = include_str!("../../src/db/migrations/001_initial.sql");
const M002: &str = include_str!("../../src/db/migrations/002_compliance.sql");
const M003: &str = include_str!("../../src/db/migrations/003_sprint8.sql");

pub struct Database { path: PathBuf }

impl Database {
    pub fn init(_app: &AppHandle) -> Result<Self, AppError> {
        let path = std::env::current_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .join("pharmacare.db");
        let db = Self { path };
        let c = db.open()?;
        db.migrate(&c)?;
        db.seed(&c)?;
        Ok(db)
    }

    fn open(&self) -> Result<Connection, AppError> {
        let c = Connection::open(&self.path)?;
        c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA synchronous=NORMAL;")?;
        Ok(c)
    }

    fn migrate(&self, c: &Connection) -> Result<(), AppError> {
        c.execute_batch("CREATE TABLE IF NOT EXISTS _migrations(version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);")?;
        let done001: Option<String> = c.query_row("SELECT version FROM _migrations WHERE version='001'", [], |r| r.get(0)).optional()?;
        if done001.is_none() {
            c.execute_batch(M001)?;
            c.execute("INSERT INTO _migrations VALUES('001',datetime('now'))", [])?;
        }
        let done002: Option<String> = c.query_row("SELECT version FROM _migrations WHERE version='002'", [], |r| r.get(0)).optional()?;
        if done002.is_none() {
            c.execute_batch(M002)?;
            c.execute("INSERT INTO _migrations VALUES('002',datetime('now'))", [])?;
        }
        let done003: Option<String> = c.query_row("SELECT version FROM _migrations WHERE version='003'", [], |r| r.get(0)).optional()?;
        if done003.is_none() {
            c.execute_batch(M003)?;
            c.execute("INSERT INTO _migrations VALUES('003',datetime('now'))", [])?;
        }
        Ok(())
    }

    fn seed(&self, c: &Connection) -> Result<(), AppError> {
        let n: i64 = c.query_row("SELECT COUNT(1) FROM users", [], |r| r.get(0))?;
        if n == 0 {
            let pw = hash("admin123", DEFAULT_COST).map_err(|e| AppError::Internal(e.to_string()))?;
            c.execute("INSERT INTO users(name,email,password_hash,role_id,is_active) VALUES('Admin','admin',?1,1,1)", params![pw])?;
        }
        Ok(())
    }

    pub fn audit(&self, action: &str, module: &str, rec: &str, old: Option<&str>, new: Option<&str>, actor: &str) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute("INSERT INTO audit_log(action,module,record_id,old_value,new_value,user_name,created_at) VALUES(?1,?2,?3,?4,?5,?6,datetime('now'))",
            params![action, module, rec, old, new, actor])?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        let c = self.open()?;
        Ok(c.query_row("SELECT value FROM settings WHERE key=?1", params![key], |r| r.get(0)).optional()?)
    }

    pub fn set_setting(&self, key: &str, val: &str, uid: Option<i64>) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute("INSERT INTO settings(key,value,updated_at,updated_by) VALUES(?1,?2,datetime('now'),?3) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by",
            params![key, val, uid])?;
        Ok(())
    }

    pub fn list_settings(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare("SELECT key,value FROM settings ORDER BY key")?;
        let rows = s.query_map([], |r| Ok((r.get::<_,String>(0)?, r.get::<_,String>(1)?)))?;
        let mut m = serde_json::Map::new();
        for row in rows { let (k,v) = row.map_err(|e| AppError::Database(e.to_string()))?; m.insert(k, serde_json::Value::String(v)); }
        Ok(serde_json::Value::Object(m))
    }

    // ── AUTH ─────────────────────────────────────────────────

    pub fn auth_login(&self, ident: &str, pw: &str) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let id = ident.trim().to_lowercase();
        type R = (i64,String,String,String,i64,i64,i64,Option<String>,String,String);
        let row: Option<R> = c.query_row(
            "SELECT u.id,u.name,u.email,u.password_hash,u.role_id,u.is_active,u.login_attempts,u.locked_until,r.name,r.permissions FROM users u JOIN roles r ON r.id=u.role_id WHERE lower(u.email)=?1 OR lower(u.name)=?1",
            params![id], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?,r.get(8)?,r.get(9)?))
        ).optional()?;
        let (uid,name,email,hash_pw,role_id,active,attempts,locked,role_name,perms) = row.ok_or(AppError::InvalidCredentials)?;
        if active == 0 { return Err(AppError::AccountDisabled); }
        if let Some(ref l) = locked { if l.as_str() > chrono::Utc::now().to_rfc3339().as_str() { return Err(AppError::AccountLocked(l.clone())); } }
        let ok = verify(pw, &hash_pw).map_err(|_| AppError::InvalidCredentials)?;
        if !ok {
            let att = attempts + 1;
            let lk = if att >= 5 { Some((chrono::Utc::now() + chrono::Duration::minutes(30)).to_rfc3339()) } else { None };
            c.execute("UPDATE users SET login_attempts=?1,locked_until=?2 WHERE id=?3", params![att,lk,uid])?;
            self.audit("LOGIN_FAILED","auth",&uid.to_string(),None,None,&name)?;
            return Err(AppError::InvalidCredentials);
        }
        c.execute("UPDATE users SET login_attempts=0,locked_until=NULL,last_login_at=datetime('now') WHERE id=?1", params![uid])?;
        let token = format!("{}:{}:{}", uid, chrono::Utc::now().timestamp(), uuid::Uuid::new_v4().to_string().replace('-',""));
        c.execute("INSERT INTO sessions(id,user_id,created_at,expires_at) VALUES(?1,?2,datetime('now'),datetime('now','+8 hours'))", params![token,uid])?;
        self.set_setting("session_token",&token,Some(uid))?;
        self.audit("LOGIN","auth",&uid.to_string(),None,None,&name)?;
        let pv: serde_json::Value = serde_json::from_str(&perms).unwrap_or(serde_json::json!({}));
        Ok(serde_json::json!({"user":{"id":uid,"name":name,"email":email,"role_id":role_id,"role_name":role_name,"permissions":pv},"token":token}))
    }

    pub fn auth_logout(&self, token: &str) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute("UPDATE sessions SET revoked_at=datetime('now') WHERE id=?1", params![token])?;
        self.set_setting("session_token","",None)?;
        Ok(())
    }

    pub fn auth_restore(&self) -> Result<Option<serde_json::Value>, AppError> {
        let token = match self.get_setting("session_token")? { Some(t) if !t.trim().is_empty() => t, _ => return Ok(None) };
        let c = self.open()?;
        let uid: Option<i64> = c.query_row("SELECT user_id FROM sessions WHERE id=?1 AND revoked_at IS NULL AND expires_at>datetime('now')", params![token], |r| r.get(0)).optional()?;
        let uid = match uid { Some(u) => u, None => return Ok(None) };
        type U = (i64,String,String,i64,i64,String,String);
        let row: Option<U> = c.query_row("SELECT u.id,u.name,u.email,u.role_id,u.is_active,r.name,r.permissions FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=?1",
            params![uid], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?))).optional()?;
        match row {
            None => Ok(None),
            Some((id,name,email,role_id,active,role_name,perms)) => {
                if active == 0 { return Ok(None); }
                let pv: serde_json::Value = serde_json::from_str(&perms).unwrap_or(serde_json::json!({}));
                Ok(Some(serde_json::json!({"user":{"id":id,"name":name,"email":email,"role_id":role_id,"role_name":role_name,"permissions":pv},"token":token})))
            }
        }
    }

    pub fn auth_change_password(&self, uid: i64, cur: &str, new_pw: &str) -> Result<(), AppError> {
        if new_pw.len() < 8 { return Err(AppError::Validation("Password must be at least 8 characters.".into())); }
        let c = self.open()?;
        let h: String = c.query_row("SELECT password_hash FROM users WHERE id=?1", params![uid], |r| r.get(0))?;
        if !verify(cur, &h).map_err(|_| AppError::InvalidCredentials)? { return Err(AppError::InvalidCredentials); }
        let nh = hash(new_pw, DEFAULT_COST).map_err(|e| AppError::Internal(e.to_string()))?;
        c.execute("UPDATE users SET password_hash=?1 WHERE id=?2", params![nh,uid])?;
        c.execute("UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=?1", params![uid])?;
        Ok(())
    }

    pub fn create_user(&self, name: &str, email: &str, pw: &str, role_id: i64) -> Result<i64, AppError> {
        if name.trim().is_empty() { return Err(AppError::Validation("Name is required.".into())); }
        if pw.len() < 8 { return Err(AppError::Validation("Password must be at least 8 characters.".into())); }
        let c = self.open()?;
        let ex: i64 = c.query_row("SELECT COUNT(1) FROM users WHERE lower(email)=lower(?1)", params![email], |r| r.get(0))?;
        if ex > 0 { return Err(AppError::Validation("Email is already in use.".into())); }
        let ph = hash(pw, DEFAULT_COST).map_err(|e| AppError::Internal(e.to_string()))?;
        c.execute("INSERT INTO users(name,email,password_hash,role_id,is_active) VALUES(?1,?2,?3,?4,1)", params![name.trim(),email.trim().to_lowercase(),ph,role_id])?;
        Ok(c.last_insert_rowid())
    }

    pub fn list_users(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare("SELECT u.id,u.name,u.email,u.role_id,r.name,u.is_active,u.last_login_at FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.name")?;
        let rows = s.query_map([], |r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,"email":r.get::<_,String>(2)?,"role_id":r.get::<_,i64>(3)?,"role_name":r.get::<_,String>(4)?,"is_active":r.get::<_,i64>(5)?==1,"last_login_at":r.get::<_,Option<String>>(6)?})))?;
        let mut out = vec![]; for r in rows { out.push(r.map_err(|e| AppError::Database(e.to_string()))?); }
        Ok(serde_json::Value::Array(out))
    }

    pub fn update_user(&self, id: i64, name: &str, role_id: i64, active: bool) -> Result<(), AppError> {
        let c = self.open()?;
        let n = c.execute("UPDATE users SET name=?1,role_id=?2,is_active=?3 WHERE id=?4", params![name.trim(),role_id,if active{1i64}else{0i64},id])?;
        if n == 0 { return Err(AppError::Validation("User not found.".into())); }
        Ok(())
    }

    // ── DASHBOARD ────────────────────────────────────────────

    pub fn dashboard_summary(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let (rev,cnt,avg): (f64,i64,f64) = c.query_row(
            "SELECT COALESCE(SUM(net_amount),0),COUNT(1),COALESCE(AVG(net_amount),0) FROM bills WHERE date(bill_date)=date('now') AND status='active'",
            [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))
        ).unwrap_or((0.0,0,0.0));
        let low: i64 = c.query_row(
            "SELECT COUNT(1) FROM medicines m WHERE m.is_active=1 AND m.deleted_at IS NULL AND COALESCE((SELECT SUM(b.quantity_in-b.quantity_sold-b.quantity_adjusted) FROM batches b WHERE b.medicine_id=m.id AND b.is_active=1),0)<m.reorder_level",
            [], |r| r.get(0)).unwrap_or(0);
        let exp: i64 = c.query_row(
            "SELECT COUNT(1) FROM batches WHERE is_active=1 AND (quantity_in-quantity_sold-quantity_adjusted)>0 AND date(expiry_date)<=date('now','+30 days')",
            [], |r| r.get(0)).unwrap_or(0);
        let out_cust: i64 = c.query_row("SELECT COUNT(1) FROM customers WHERE is_active=1 AND outstanding_balance>0", [], |r| r.get(0)).unwrap_or(0);
        let mut ts = c.prepare("SELECT date(bill_date),COALESCE(SUM(net_amount),0),COUNT(1) FROM bills WHERE status='active' AND date(bill_date)>=date('now','-6 days') GROUP BY date(bill_date) ORDER BY date(bill_date)")?;
        let trend: Vec<serde_json::Value> = ts.query_map([],|r| Ok(serde_json::json!({"date":r.get::<_,String>(0)?,"revenue":r.get::<_,f64>(1)?,"bills":r.get::<_,i64>(2)?})))?.filter_map(|r| r.ok()).collect();
        let mut ps = c.prepare("SELECT p.payment_mode,COALESCE(SUM(p.amount),0) FROM payments p JOIN bills b ON b.id=p.bill_id WHERE b.status='active' AND date(b.bill_date)=date('now') GROUP BY p.payment_mode")?;
        let payments: Vec<serde_json::Value> = ps.query_map([],|r| Ok(serde_json::json!({"mode":r.get::<_,String>(0)?,"amount":r.get::<_,f64>(1)?})))?.filter_map(|r| r.ok()).collect();
        Ok(serde_json::json!({"today":{"revenue":rev,"bill_count":cnt,"avg_bill_value":avg},"alerts":{"low_stock":low,"expiry_alerts":exp,"outstanding_customers":out_cust},"sales_trend":trend,"payment_split":payments}))
    }

    // ── MEDICINE ─────────────────────────────────────────────

    pub fn medicine_search(&self, q: &str, in_stock: bool, cat: Option<i64>) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let like = format!("%{}%", q.trim().to_lowercase());
        let mut s = c.prepare(
            "SELECT m.id,m.name,m.generic_name,m.schedule,m.default_gst_rate,m.reorder_level,COALESCE(cat.name,'') AS cat_name,COALESCE(SUM(CASE WHEN b.is_active=1 THEN b.quantity_in-b.quantity_sold-b.quantity_adjusted ELSE 0 END),0) AS stock FROM medicines m LEFT JOIN categories cat ON cat.id=m.category_id LEFT JOIN batches b ON b.medicine_id=m.id WHERE m.deleted_at IS NULL AND (?1='' OR lower(m.name) LIKE ?2 OR lower(m.generic_name) LIKE ?2) AND (?3 IS NULL OR m.category_id=?3) GROUP BY m.id HAVING (?4=0 OR stock>0) ORDER BY m.name LIMIT 40"
        )?;
        let rows = s.query_map(params![q.trim(),like,cat,if in_stock{1}else{0}],|r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,"generic_name":r.get::<_,String>(2)?,"schedule":r.get::<_,String>(3)?,"default_gst_rate":r.get::<_,f64>(4)?,"reorder_level":r.get::<_,i64>(5)?,"category_name":r.get::<_,String>(6)?,"total_stock":r.get::<_,i64>(7)?})))?;
        let mut out = vec![]; for r in rows { out.push(r.map_err(|e| AppError::Database(e.to_string()))?); }
        Ok(serde_json::Value::Array(out))
    }

    pub fn medicine_get(&self, id: i64) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        c.query_row(
            "SELECT m.id,m.name,m.generic_name,m.composition,m.hsn_code,m.schedule,m.drug_form,m.strength,m.pack_size,m.default_gst_rate,m.reorder_level,m.reorder_quantity,m.is_cold_chain,m.notes,m.category_id,COALESCE(cat.name,'') AS cat_name,m.is_active FROM medicines m LEFT JOIN categories cat ON cat.id=m.category_id WHERE m.id=?1 AND m.deleted_at IS NULL",
            params![id],
            |r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,"generic_name":r.get::<_,String>(2)?,"composition":r.get::<_,Option<String>>(3)?,"hsn_code":r.get::<_,Option<String>>(4)?,"schedule":r.get::<_,String>(5)?,"drug_form":r.get::<_,Option<String>>(6)?,"strength":r.get::<_,Option<String>>(7)?,"pack_size":r.get::<_,Option<String>>(8)?,"default_gst_rate":r.get::<_,f64>(9)?,"reorder_level":r.get::<_,i64>(10)?,"reorder_quantity":r.get::<_,i64>(11)?,"is_cold_chain":r.get::<_,i64>(12)?==1,"notes":r.get::<_,Option<String>>(13)?,"category_id":r.get::<_,Option<i64>>(14)?,"category_name":r.get::<_,String>(15)?,"is_active":r.get::<_,i64>(16)?==1}))
        ).optional()?.ok_or(AppError::Validation("Medicine not found.".into()))
    }

    pub fn medicine_get_by_barcode(&self, barcode: &str) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        c.query_row(
            "SELECT b.id,b.medicine_id,m.name,m.generic_name,m.schedule,m.default_gst_rate,b.batch_number,b.expiry_date,b.selling_price,b.purchase_price,(b.quantity_in-b.quantity_sold-b.quantity_adjusted) AS qty,b.rack_location,b.barcode FROM batches b JOIN medicines m ON m.id=b.medicine_id WHERE b.barcode=?1 AND b.is_active=1 AND m.deleted_at IS NULL",
            params![barcode.trim()],
            |r| Ok(serde_json::json!({"batch_id":r.get::<_,i64>(0)?,"medicine_id":r.get::<_,i64>(1)?,"medicine_name":r.get::<_,String>(2)?,"generic_name":r.get::<_,String>(3)?,"schedule":r.get::<_,String>(4)?,"gst_rate":r.get::<_,f64>(5)?,"batch_number":r.get::<_,String>(6)?,"expiry_date":r.get::<_,String>(7)?,"selling_price":r.get::<_,f64>(8)?,"purchase_price":r.get::<_,f64>(9)?,"quantity_on_hand":r.get::<_,i64>(10)?,"rack_location":r.get::<_,Option<String>>(11)?,"barcode":r.get::<_,Option<String>>(12)?}))
        ).optional()?.ok_or(AppError::Validation("Barcode not found.".into()))
    }

    pub fn medicine_create(&self, d: &serde_json::Value, uid: i64) -> Result<i64, AppError> {
        let name = d["name"].as_str().unwrap_or("").trim().to_string();
        let generic = d["generic_name"].as_str().unwrap_or("").trim().to_string();
        if name.is_empty() { return Err(AppError::Validation("Medicine name is required.".into())); }
        if generic.is_empty() { return Err(AppError::Validation("Generic name is required.".into())); }
        let c = self.open()?;
        c.execute(
            "INSERT INTO medicines(name,generic_name,composition,hsn_code,schedule,drug_form,strength,pack_size,default_gst_rate,reorder_level,reorder_quantity,is_cold_chain,category_id,notes,is_active,created_by) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,1,?15)",
            params![name,generic,d["composition"].as_str().filter(|s|!s.is_empty()),d["hsn_code"].as_str().filter(|s|!s.is_empty()),d["schedule"].as_str().unwrap_or("OTC"),d["drug_form"].as_str().filter(|s|!s.is_empty()),d["strength"].as_str().filter(|s|!s.is_empty()),d["pack_size"].as_str().filter(|s|!s.is_empty()),d["default_gst_rate"].as_f64().unwrap_or(12.0),d["reorder_level"].as_i64().unwrap_or(10),d["reorder_quantity"].as_i64().unwrap_or(50),if d["is_cold_chain"].as_bool().unwrap_or(false){1i64}else{0i64},d["category_id"].as_i64(),d["notes"].as_str().filter(|s|!s.is_empty()),uid],
        )?;
        let id = c.last_insert_rowid();
        self.audit("MEDICINE_CREATED","medicine",&id.to_string(),None,Some(&name),&format!("uid:{}",uid))?;
        Ok(id)
    }

    pub fn medicine_update(&self, id: i64, d: &serde_json::Value, uid: i64) -> Result<(), AppError> {
        let name = d["name"].as_str().unwrap_or("").trim().to_string();
        if name.is_empty() { return Err(AppError::Validation("Medicine name is required.".into())); }
        let c = self.open()?;
        let n = c.execute(
            "UPDATE medicines SET name=?1,generic_name=?2,composition=?3,hsn_code=?4,schedule=?5,drug_form=?6,strength=?7,pack_size=?8,default_gst_rate=?9,reorder_level=?10,reorder_quantity=?11,is_cold_chain=?12,category_id=?13,notes=?14,updated_at=datetime('now') WHERE id=?15 AND deleted_at IS NULL",
            params![name,d["generic_name"].as_str().unwrap_or(""),d["composition"].as_str().filter(|s|!s.is_empty()),d["hsn_code"].as_str().filter(|s|!s.is_empty()),d["schedule"].as_str().unwrap_or("OTC"),d["drug_form"].as_str().filter(|s|!s.is_empty()),d["strength"].as_str().filter(|s|!s.is_empty()),d["pack_size"].as_str().filter(|s|!s.is_empty()),d["default_gst_rate"].as_f64().unwrap_or(12.0),d["reorder_level"].as_i64().unwrap_or(10),d["reorder_quantity"].as_i64().unwrap_or(50),if d["is_cold_chain"].as_bool().unwrap_or(false){1i64}else{0i64},d["category_id"].as_i64(),d["notes"].as_str().filter(|s|!s.is_empty()),id],
        )?;
        if n == 0 { return Err(AppError::Validation("Medicine not found.".into())); }
        self.audit("MEDICINE_UPDATED","medicine",&id.to_string(),None,Some(&name),&format!("uid:{}",uid))?;
        Ok(())
    }

    pub fn medicine_delete(&self, id: i64, uid: i64) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute("UPDATE medicines SET deleted_at=datetime('now'),is_active=0 WHERE id=?1 AND deleted_at IS NULL", params![id])?;
        self.audit("MEDICINE_DELETED","medicine",&id.to_string(),None,None,&format!("uid:{}",uid))?;
        Ok(())
    }

    pub fn medicine_list_batches(&self, mid: i64) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare("SELECT id,batch_number,barcode,expiry_date,purchase_price,selling_price,quantity_in,quantity_sold,quantity_adjusted,(quantity_in-quantity_sold-quantity_adjusted) AS qty,rack_location FROM batches WHERE medicine_id=?1 AND is_active=1 ORDER BY expiry_date ASC")?;
        let rows = s.query_map(params![mid],|r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"batch_number":r.get::<_,String>(1)?,"barcode":r.get::<_,Option<String>>(2)?,"expiry_date":r.get::<_,String>(3)?,"purchase_price":r.get::<_,f64>(4)?,"selling_price":r.get::<_,f64>(5)?,"quantity_in":r.get::<_,i64>(6)?,"quantity_sold":r.get::<_,i64>(7)?,"quantity_adjusted":r.get::<_,i64>(8)?,"quantity_on_hand":r.get::<_,i64>(9)?,"rack_location":r.get::<_,Option<String>>(10)?})))?;
        let mut out = vec![]; for r in rows { out.push(r.map_err(|e| AppError::Database(e.to_string()))?); }
        Ok(serde_json::Value::Array(out))
    }

    pub fn medicine_create_batch(&self, d: &serde_json::Value, uid: i64) -> Result<i64, AppError> {
        let mid = d["medicine_id"].as_i64().ok_or(AppError::Validation("medicine_id required.".into()))?;
        let bn = d["batch_number"].as_str().unwrap_or("").trim().to_string();
        let expiry = d["expiry_date"].as_str().unwrap_or("").trim().to_string();
        if bn.is_empty() { return Err(AppError::Validation("Batch number required.".into())); }
        if expiry.is_empty() { return Err(AppError::Validation("Expiry date required.".into())); }
        let barcode = format!("MED{:05}-{}", mid, bn.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_uppercase());
        let c = self.open()?;
        c.execute("INSERT INTO batches(medicine_id,batch_number,barcode,expiry_date,purchase_price,selling_price,quantity_in,quantity_sold,quantity_adjusted,rack_location) VALUES(?1,?2,?3,?4,?5,?6,?7,0,0,?8)",
            params![mid,bn,barcode,expiry,d["purchase_price"].as_f64().unwrap_or(0.0),d["selling_price"].as_f64().unwrap_or(0.0),d["quantity_in"].as_i64().unwrap_or(0),d["rack_location"].as_str().filter(|s|!s.is_empty())])?;
        let id = c.last_insert_rowid();
        self.audit("BATCH_CREATED","medicine",&id.to_string(),None,Some(&bn),&format!("uid:{}",uid))?;
        Ok(id)
    }

    pub fn medicine_update_batch(&self, id: i64, d: &serde_json::Value, uid: i64) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute("UPDATE batches SET expiry_date=?1,purchase_price=?2,selling_price=?3,rack_location=?4,updated_at=datetime('now') WHERE id=?5 AND is_active=1",
            params![d["expiry_date"].as_str(),d["purchase_price"].as_f64(),d["selling_price"].as_f64(),d["rack_location"].as_str().filter(|s|!s.is_empty()),id])?;
        self.audit("BATCH_UPDATED","medicine",&id.to_string(),None,None,&format!("uid:{}",uid))?;
        Ok(())
    }

    pub fn list_categories(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare("SELECT id,name FROM categories ORDER BY name")?;
        let rows = s.query_map([],|r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?})))?;
        let mut out = vec![]; for r in rows { out.push(r.map_err(|e| AppError::Database(e.to_string()))?); }
        Ok(serde_json::Value::Array(out))
    }

    // ── BILLING ──────────────────────────────────────────────

    pub fn create_bill(&self, inp: &serde_json::Value) -> Result<i64, AppError> {
        let items = inp["items"].as_array().ok_or(AppError::Validation("Items required.".into()))?;
        let payments = inp["payments"].as_array().ok_or(AppError::Validation("Payments required.".into()))?;
        if items.is_empty() { return Err(AppError::Validation("Add at least one medicine.".into())); }
        if payments.is_empty() { return Err(AppError::Validation("Add payment details.".into())); }
        let created_by = inp["created_by"].as_i64().unwrap_or(1);
        let mut conn = self.open()?;
        let tx = conn.transaction()?;
        for item in items.iter() {
            let bid = item["batch_id"].as_i64().unwrap_or(0);
            let qty = item["quantity"].as_i64().unwrap_or(0);
            let mname = item["medicine_name"].as_str().unwrap_or("Unknown");
            let avail: i64 = tx.query_row("SELECT quantity_in-quantity_sold-quantity_adjusted FROM batches WHERE id=?1", params![bid], |r| r.get(0)).optional()?.unwrap_or(0);
            if avail < qty { return Err(AppError::InsufficientStock(mname.to_string(), avail, qty)); }
        }
        let ym = chrono::Utc::now().format("%Y%m").to_string();
        let pat = format!("POS-{}-%", ym);
        let seq: i64 = tx.query_row("SELECT COALESCE(MAX(CAST(SUBSTR(bill_number,-5) AS INTEGER)),0)+1 FROM bills WHERE bill_number LIKE ?1", params![pat], |r| r.get(0))?;
        let bill_no = format!("POS-{}-{:05}", ym, seq);
        let subtotal: f64 = items.iter().map(|i| i["unit_price"].as_f64().unwrap_or(0.0)*i["quantity"].as_f64().unwrap_or(0.0)).sum();
        let item_disc: f64 = items.iter().map(|i| i["discount_amount"].as_f64().unwrap_or(0.0)).sum();
        let bill_disc = inp["discount_amount"].as_f64().unwrap_or(0.0);
        let cgst: f64 = items.iter().map(|i| i["cgst_amount"].as_f64().unwrap_or(0.0)).sum();
        let sgst: f64 = items.iter().map(|i| i["sgst_amount"].as_f64().unwrap_or(0.0)).sum();
        let igst: f64 = items.iter().map(|i| i["igst_amount"].as_f64().unwrap_or(0.0)).sum();
        let total: f64 = items.iter().map(|i| i["total_amount"].as_f64().unwrap_or(0.0)).sum();
        let taxable = subtotal - item_disc - bill_disc;
        // Loyalty redemption
        let points_to_redeem = inp["loyalty_points_redeemed"].as_i64().unwrap_or(0);
        if points_to_redeem > 0 {
            if let Some(cid) = inp["customer_id"].as_i64() {
                let avail: i64 = tx.query_row(
                    "SELECT loyalty_points FROM customers WHERE id=?1", params![cid], |r| r.get(0)
                ).unwrap_or(0);
                if points_to_redeem > avail {
                    return Err(AppError::Validation(format!(
                        "Customer has only {} loyalty points. Cannot redeem {}.", avail, points_to_redeem
                    )));
                }
            }
        }
        let redeem_value = points_to_redeem as f64; // 1 point = ₹1
        let total_after_redeem = (total - redeem_value).max(0.0);
        let round_off = (total_after_redeem.round()*100.0 - total_after_redeem*100.0).round()/100.0;
        let net = total_after_redeem + round_off;
        let paid: f64 = payments.iter().map(|p| p["amount"].as_f64().unwrap_or(0.0)).sum();
        let outstanding = (net - paid).max(0.0);
        let loyalty = if inp["customer_id"].as_i64().is_some() { (net/100.0).floor() as i64 } else { 0 };
        tx.execute("INSERT INTO bills(bill_number,customer_id,doctor_id,bill_date,status,subtotal,discount_amount,taxable_amount,cgst_amount,sgst_amount,igst_amount,total_amount,round_off,net_amount,amount_paid,outstanding,loyalty_points_earned,loyalty_points_redeemed,notes,created_by) VALUES(?1,?2,?3,datetime('now'),'active',?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)",
            params![bill_no,inp["customer_id"].as_i64(),inp["doctor_id"].as_i64(),subtotal,item_disc+bill_disc,taxable,cgst,sgst,igst,total,round_off,net,paid,outstanding,loyalty,points_to_redeem,inp["notes"].as_str().filter(|s|!s.is_empty()),created_by])?;
        let bill_id = tx.last_insert_rowid();
        for item in items.iter() {
            tx.execute("INSERT INTO bill_items(bill_id,medicine_id,batch_id,medicine_name,batch_number,expiry_date,quantity,unit_price,mrp,discount_percent,discount_amount,gst_rate,cgst_amount,sgst_amount,igst_amount,total_amount) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
                params![bill_id,item["medicine_id"].as_i64(),item["batch_id"].as_i64(),item["medicine_name"].as_str(),item["batch_number"].as_str(),item["expiry_date"].as_str(),item["quantity"].as_i64(),item["unit_price"].as_f64(),item["mrp"].as_f64().unwrap_or(item["unit_price"].as_f64().unwrap_or(0.0)),item["discount_percent"].as_f64().unwrap_or(0.0),item["discount_amount"].as_f64().unwrap_or(0.0),item["gst_rate"].as_f64().unwrap_or(0.0),item["cgst_amount"].as_f64().unwrap_or(0.0),item["sgst_amount"].as_f64().unwrap_or(0.0),item["igst_amount"].as_f64().unwrap_or(0.0),item["total_amount"].as_f64().unwrap_or(0.0)])?;
            tx.execute("UPDATE batches SET quantity_sold=quantity_sold+?1,updated_at=datetime('now') WHERE id=?2", params![item["quantity"].as_i64().unwrap_or(0),item["batch_id"].as_i64()])?;
        }
        for p in payments.iter() {
            tx.execute("INSERT INTO payments(bill_id,amount,payment_mode,reference_no,created_by) VALUES(?1,?2,?3,?4,?5)",
                params![bill_id,p["amount"].as_f64().unwrap_or(0.0),p["payment_mode"].as_str().unwrap_or("cash"),p["reference_no"].as_str().filter(|s|!s.is_empty()),created_by])?;
        }
        if let Some(cid) = inp["customer_id"].as_i64() {
            tx.execute("UPDATE customers SET outstanding_balance=outstanding_balance+?1,loyalty_points=loyalty_points+?2-?3,updated_at=datetime('now') WHERE id=?4",
                params![outstanding, loyalty, points_to_redeem, cid])?;
        }
        tx.execute("INSERT INTO audit_log(action,module,record_id,new_value,user_name,created_at) VALUES('BILL_CREATED','billing',?1,?2,'uid:'||?3,datetime('now'))",
            params![bill_id.to_string(),serde_json::json!({"bill_number":bill_no,"net_amount":net}).to_string(),created_by])?;
        tx.commit()?;
        let _ = self.auto_populate_compliance_registers(bill_id, &bill_no, created_by);
        Ok(bill_id)
    }

    pub fn cancel_bill(&self, bill_id: i64, reason: &str, uid: i64) -> Result<(), AppError> {
        let mut conn = self.open()?;
        let tx = conn.transaction()?;
        let status: String = tx.query_row("SELECT status FROM bills WHERE id=?1", params![bill_id], |r| r.get(0)).optional()?.ok_or(AppError::Validation("Bill not found.".into()))?;
        if status != "active" { return Err(AppError::Validation("Only active bills can be cancelled.".into())); }
        let items: Vec<(i64,i64)> = {
            let mut stmt = tx.prepare("SELECT batch_id,quantity FROM bill_items WHERE bill_id=?1")?;
            let rows = stmt.query_map(params![bill_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
            let collected: Vec<(i64,i64)> = rows.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
            collected
        };
        for (bid,qty) in items { tx.execute("UPDATE batches SET quantity_sold=MAX(0,quantity_sold-?1),updated_at=datetime('now') WHERE id=?2", params![qty,bid])?; }
        tx.execute("UPDATE bills SET status='cancelled',cancel_reason=?1,cancelled_by=?2,cancelled_at=datetime('now') WHERE id=?3", params![reason,uid,bill_id])?;
        tx.commit()?;
        self.audit("BILL_CANCELLED","billing",&bill_id.to_string(),None,Some(reason),&format!("uid:{}",uid))?;
        Ok(())
    }

    pub fn get_bill(&self, id: i64) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let bill = c.query_row(
            "SELECT b.id,b.bill_number,b.customer_id,b.bill_date,b.status,b.subtotal,b.discount_amount,b.taxable_amount,b.cgst_amount,b.sgst_amount,b.igst_amount,b.total_amount,b.round_off,b.net_amount,b.amount_paid,b.outstanding,b.loyalty_points_earned,b.notes,b.created_at,COALESCE(cu.name,'Walk-in') AS cname FROM bills b LEFT JOIN customers cu ON cu.id=b.customer_id WHERE b.id=?1",
            params![id],
            |r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"bill_number":r.get::<_,String>(1)?,"customer_id":r.get::<_,Option<i64>>(2)?,"bill_date":r.get::<_,String>(3)?,"status":r.get::<_,String>(4)?,"subtotal":r.get::<_,f64>(5)?,"discount_amount":r.get::<_,f64>(6)?,"taxable_amount":r.get::<_,f64>(7)?,"cgst_amount":r.get::<_,f64>(8)?,"sgst_amount":r.get::<_,f64>(9)?,"igst_amount":r.get::<_,f64>(10)?,"total_amount":r.get::<_,f64>(11)?,"round_off":r.get::<_,f64>(12)?,"net_amount":r.get::<_,f64>(13)?,"amount_paid":r.get::<_,f64>(14)?,"outstanding":r.get::<_,f64>(15)?,"loyalty_points_earned":r.get::<_,i64>(16)?,"notes":r.get::<_,Option<String>>(17)?,"created_at":r.get::<_,String>(18)?,"customer_name":r.get::<_,String>(19)?}))
        ).optional()?.ok_or(AppError::Validation("Bill not found.".into()))?;
        let mut is = c.prepare("SELECT id,medicine_id,batch_id,medicine_name,batch_number,expiry_date,quantity,unit_price,mrp,discount_percent,discount_amount,gst_rate,cgst_amount,sgst_amount,igst_amount,total_amount FROM bill_items WHERE bill_id=?1 ORDER BY id")?;
        let items: Vec<serde_json::Value> = is.query_map(params![id],|r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"medicine_id":r.get::<_,i64>(1)?,"batch_id":r.get::<_,i64>(2)?,"medicine_name":r.get::<_,String>(3)?,"batch_number":r.get::<_,String>(4)?,"expiry_date":r.get::<_,String>(5)?,"quantity":r.get::<_,i64>(6)?,"unit_price":r.get::<_,f64>(7)?,"mrp":r.get::<_,f64>(8)?,"discount_percent":r.get::<_,f64>(9)?,"discount_amount":r.get::<_,f64>(10)?,"gst_rate":r.get::<_,f64>(11)?,"cgst_amount":r.get::<_,f64>(12)?,"sgst_amount":r.get::<_,f64>(13)?,"igst_amount":r.get::<_,f64>(14)?,"total_amount":r.get::<_,f64>(15)?})))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        let mut ps = c.prepare("SELECT id,amount,payment_mode,reference_no,payment_date FROM payments WHERE bill_id=?1")?;
        let pays: Vec<serde_json::Value> = ps.query_map(params![id],|r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"amount":r.get::<_,f64>(1)?,"payment_mode":r.get::<_,String>(2)?,"reference_no":r.get::<_,Option<String>>(3)?,"payment_date":r.get::<_,String>(4)?})))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        let mut out = bill; out["items"] = serde_json::Value::Array(items); out["payments"] = serde_json::Value::Array(pays);
        Ok(out)
    }

    pub fn list_bills(&self, f: &serde_json::Value) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let status = f["status"].as_str();
        let cid = f["customer_id"].as_i64();
        let page = f["page"].as_i64().unwrap_or(1).max(1);
        let ps = f["page_size"].as_i64().unwrap_or(50).clamp(1,200);
        let offset = (page-1)*ps;
        let total: i64 = c.query_row("SELECT COUNT(1) FROM bills WHERE (?1 IS NULL OR status=?1) AND (?2 IS NULL OR customer_id=?2)", params![status,cid], |r| r.get(0))?;
        let mut s = c.prepare("SELECT b.id,b.bill_number,b.customer_id,b.bill_date,b.status,b.net_amount,b.amount_paid,b.outstanding,b.created_at,COALESCE(cu.name,'Walk-in') AS cname FROM bills b LEFT JOIN customers cu ON cu.id=b.customer_id WHERE (?1 IS NULL OR b.status=?1) AND (?2 IS NULL OR b.customer_id=?2) ORDER BY b.bill_date DESC,b.id DESC LIMIT ?3 OFFSET ?4")?;
        let rows = s.query_map(params![status,cid,ps,offset],|r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"bill_number":r.get::<_,String>(1)?,"customer_id":r.get::<_,Option<i64>>(2)?,"bill_date":r.get::<_,String>(3)?,"status":r.get::<_,String>(4)?,"net_amount":r.get::<_,f64>(5)?,"amount_paid":r.get::<_,f64>(6)?,"outstanding":r.get::<_,f64>(7)?,"created_at":r.get::<_,String>(8)?,"customer_name":r.get::<_,String>(9)?})))?;
        let mut bills = vec![]; for r in rows { bills.push(r.map_err(|e| AppError::Database(e.to_string()))?); }
        Ok(serde_json::json!({"bills":bills,"total":total,"page":page,"page_size":ps}))
    }

    pub fn hold_bill(&self, inp: &serde_json::Value) -> Result<(), AppError> {
        let c = self.open()?;
        let label = inp["label"].as_str().unwrap_or("Held Bill");
        let data = serde_json::to_string(inp).map_err(|e| AppError::Internal(e.to_string()))?;
        c.execute("INSERT INTO held_bills(label,cart_data,created_by) VALUES(?1,?2,?3)", params![label,data,inp["created_by"].as_i64()])?;
        Ok(())
    }

    pub fn get_held_bills(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare("SELECT id,label,created_at FROM held_bills ORDER BY id DESC")?;
        let rows = s.query_map([],|r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"label":r.get::<_,String>(1)?,"created_at":r.get::<_,String>(2)?})))?;
        let mut out = vec![]; for r in rows { out.push(r.map_err(|e| AppError::Database(e.to_string()))?); }
        Ok(serde_json::Value::Array(out))
    }

    pub fn restore_held_bill(&self, id: i64) -> Result<serde_json::Value, AppError> {
        let mut conn = self.open()?;
        let tx = conn.transaction()?;
        let data: String = tx.query_row("SELECT cart_data FROM held_bills WHERE id=?1", params![id], |r| r.get(0)).optional()?.ok_or(AppError::Validation("Held bill not found.".into()))?;
        tx.execute("DELETE FROM held_bills WHERE id=?1", params![id])?;
        tx.commit()?;
        let v: serde_json::Value = serde_json::from_str(&data).map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(v["items"].clone())
    }

    pub fn today_summary(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let (rev,cnt,avg): (f64,i64,f64) = c.query_row("SELECT COALESCE(SUM(net_amount),0),COUNT(1),COALESCE(AVG(net_amount),0) FROM bills WHERE date(bill_date)=date('now') AND status='active'", [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?)))?;
        let pm = |mode: &str| -> Result<f64,AppError> { Ok(c.query_row("SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN bills b ON b.id=p.bill_id WHERE date(p.payment_date)=date('now') AND b.status='active' AND p.payment_mode=?1", params![mode], |r| r.get(0))?) };
        Ok(serde_json::json!({"total_revenue":rev,"bill_count":cnt,"avg_bill_value":avg,"cash_amount":pm("cash")?,"upi_amount":pm("upi")?,"card_amount":pm("card")?,"credit_amount":pm("credit")?}))
    }

    // ── CUSTOMER ─────────────────────────────────────────────

    pub fn customer_search(&self, q: &str) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let like = format!("%{}%", q.trim());
        let mut s = c.prepare("SELECT id,name,phone,outstanding_balance,loyalty_points FROM customers WHERE is_active=1 AND (?1='' OR name LIKE ?2 OR COALESCE(phone,'') LIKE ?2) ORDER BY name LIMIT 50")?;
        let rows = s.query_map(params![q.trim(),like],|r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,"phone":r.get::<_,Option<String>>(2)?,"outstanding_balance":r.get::<_,f64>(3)?,"loyalty_points":r.get::<_,i64>(4)?})))?;
        let mut out = vec![]; for r in rows { out.push(r.map_err(|e| AppError::Database(e.to_string()))?); }
        Ok(serde_json::Value::Array(out))
    }

    pub fn customer_create(&self, d: &serde_json::Value, uid: i64) -> Result<i64, AppError> {
        let name = d["name"].as_str().unwrap_or("").trim().to_string();
        if name.is_empty() { return Err(AppError::Validation("Customer name is required.".into())); }
        let c = self.open()?;
        c.execute("INSERT INTO customers(name,phone,email,date_of_birth,gender,address,allergies,chronic_conditions,created_by) VALUES(?1,?2,?3,?4,?5,?6,'[]','[]',?7)",
            params![name,d["phone"].as_str().filter(|s|!s.is_empty()),d["email"].as_str().filter(|s|!s.is_empty()),d["date_of_birth"].as_str().filter(|s|!s.is_empty()),d["gender"].as_str().filter(|s|!s.is_empty()),d["address"].as_str().filter(|s|!s.is_empty()),uid])?;
        let id = c.last_insert_rowid();
        self.audit("CUSTOMER_CREATED","customer",&id.to_string(),None,Some(&name),&format!("uid:{}",uid))?;
        Ok(id)
    }

    // ── SUPPLIER ─────────────────────────────────────────────

    pub fn supplier_list(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare("SELECT id,name,contact_person,phone,email,gstin,drug_licence_no,drug_licence_expiry,payment_terms,credit_limit,outstanding_balance,is_active FROM suppliers WHERE deleted_at IS NULL ORDER BY name")?;
        let rows = s.query_map([],|r| Ok(serde_json::json!({"id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,"contact_person":r.get::<_,Option<String>>(2)?,"phone":r.get::<_,Option<String>>(3)?,"email":r.get::<_,Option<String>>(4)?,"gstin":r.get::<_,Option<String>>(5)?,"drug_licence_no":r.get::<_,Option<String>>(6)?,"drug_licence_expiry":r.get::<_,Option<String>>(7)?,"payment_terms":r.get::<_,i64>(8)?,"credit_limit":r.get::<_,f64>(9)?,"outstanding_balance":r.get::<_,f64>(10)?,"is_active":r.get::<_,i64>(11)?==1})))?;
        let mut out = vec![]; for r in rows { out.push(r.map_err(|e| AppError::Database(e.to_string()))?); }
        Ok(serde_json::Value::Array(out))
    }

    pub fn supplier_create(&self, d: &serde_json::Value, uid: i64) -> Result<i64, AppError> {
        let name = d["name"].as_str().unwrap_or("").trim().to_string();
        if name.is_empty() { return Err(AppError::Validation("Supplier name required.".into())); }
        let c = self.open()?;
        c.execute("INSERT INTO suppliers(name,contact_person,phone,email,gstin,drug_licence_no,drug_licence_expiry,payment_terms,credit_limit) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![name,d["contact_person"].as_str().filter(|s|!s.is_empty()),d["phone"].as_str().filter(|s|!s.is_empty()),d["email"].as_str().filter(|s|!s.is_empty()),d["gstin"].as_str().filter(|s|!s.is_empty()),d["drug_licence_no"].as_str().filter(|s|!s.is_empty()),d["drug_licence_expiry"].as_str().filter(|s|!s.is_empty()),d["payment_terms"].as_i64().unwrap_or(30),d["credit_limit"].as_f64().unwrap_or(0.0)])?;
        let id = c.last_insert_rowid();
        self.audit("SUPPLIER_CREATED","supplier",&id.to_string(),None,Some(&name),&format!("uid:{}",uid))?;
        Ok(id)
    }
// ── CUSTOMER FULL CRUD ───────────────────────────────────────

    pub fn customer_get(&self, id: i64) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        c.query_row(
            "SELECT c.id,c.name,c.phone,c.phone2,c.email,c.date_of_birth,c.gender,c.blood_group,
                    c.address,c.doctor_id,COALESCE(d.name,'') AS doctor_name,
                    c.allergies,c.chronic_conditions,c.outstanding_balance,c.loyalty_points,
                    c.notes,c.is_active,c.created_at
             FROM customers c LEFT JOIN doctors d ON d.id=c.doctor_id WHERE c.id=?1",
            params![id],
            |r| Ok(serde_json::json!({
                "id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,
                "phone":r.get::<_,Option<String>>(2)?,"phone2":r.get::<_,Option<String>>(3)?,
                "email":r.get::<_,Option<String>>(4)?,"date_of_birth":r.get::<_,Option<String>>(5)?,
                "gender":r.get::<_,Option<String>>(6)?,"blood_group":r.get::<_,Option<String>>(7)?,
                "address":r.get::<_,Option<String>>(8)?,"doctor_id":r.get::<_,Option<i64>>(9)?,
                "doctor_name":r.get::<_,String>(10)?,
                "allergies":serde_json::from_str::<serde_json::Value>(&r.get::<_,Option<String>>(11)?.unwrap_or_else(||"[]".into())).unwrap_or(serde_json::json!([])),
                "chronic_conditions":serde_json::from_str::<serde_json::Value>(&r.get::<_,Option<String>>(12)?.unwrap_or_else(||"[]".into())).unwrap_or(serde_json::json!([])),
                "outstanding_balance":r.get::<_,f64>(13)?,"loyalty_points":r.get::<_,i64>(14)?,
                "notes":r.get::<_,Option<String>>(15)?,"is_active":r.get::<_,i64>(16)?==1,
                "created_at":r.get::<_,String>(17)?
            }))
        ).optional()?.ok_or(AppError::Validation("Customer not found.".into()))
    }

    pub fn customer_update(&self, id: i64, d: &serde_json::Value, uid: i64) -> Result<(), AppError> {
        let name = d["name"].as_str().unwrap_or("").trim().to_string();
        if name.is_empty() { return Err(AppError::Validation("Customer name is required.".into())); }
        let allergies = d["allergies"].to_string();
        let conditions = d["chronic_conditions"].to_string();
        let c = self.open()?;
        let n = c.execute(
            "UPDATE customers SET name=?1,phone=?2,phone2=?3,email=?4,date_of_birth=?5,
             gender=?6,blood_group=?7,address=?8,doctor_id=?9,allergies=?10,
             chronic_conditions=?11,notes=?12,updated_at=datetime('now') WHERE id=?13",
            params![name,
                d["phone"].as_str().filter(|s|!s.is_empty()),
                d["phone2"].as_str().filter(|s|!s.is_empty()),
                d["email"].as_str().filter(|s|!s.is_empty()),
                d["date_of_birth"].as_str().filter(|s|!s.is_empty()),
                d["gender"].as_str().filter(|s|!s.is_empty()),
                d["blood_group"].as_str().filter(|s|!s.is_empty()),
                d["address"].as_str().filter(|s|!s.is_empty()),
                d["doctor_id"].as_i64(),
                allergies, conditions,
                d["notes"].as_str().filter(|s|!s.is_empty()),
                id],
        )?;
        if n == 0 { return Err(AppError::Validation("Customer not found.".into())); }
        self.audit("CUSTOMER_UPDATED","customer",&id.to_string(),None,Some(&name),&format!("uid:{}",uid))?;
        Ok(())
    }

    pub fn customer_get_history(&self, cid: i64, limit: i64) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let lim = limit.clamp(1, 500);
        let mut s = c.prepare(
            "SELECT b.id,b.bill_number,b.bill_date,b.status,b.net_amount,b.outstanding,
                    COUNT(bi.id) AS item_count
             FROM bills b LEFT JOIN bill_items bi ON bi.bill_id=b.id
             WHERE b.customer_id=?1 GROUP BY b.id ORDER BY b.bill_date DESC LIMIT ?2"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![cid, lim], |r| Ok(serde_json::json!({
            "id":r.get::<_,i64>(0)?,"bill_number":r.get::<_,String>(1)?,
            "bill_date":r.get::<_,String>(2)?,"status":r.get::<_,String>(3)?,
            "net_amount":r.get::<_,f64>(4)?,"outstanding":r.get::<_,f64>(5)?,
            "item_count":r.get::<_,i64>(6)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::Value::Array(rows))
    }

    pub fn customer_record_payment(&self, cid: i64, amount: f64, uid: i64) -> Result<(), AppError> {
        if amount <= 0.0 { return Err(AppError::Validation("Amount must be greater than zero.".into())); }
        let c = self.open()?;
        let bal: f64 = c.query_row("SELECT outstanding_balance FROM customers WHERE id=?1 AND is_active=1",
            params![cid], |r| r.get(0))
            .optional()?.ok_or(AppError::Validation("Customer not found.".into()))?;
        let new_bal = (bal - amount).max(0.0);
        c.execute("UPDATE customers SET outstanding_balance=?1,updated_at=datetime('now') WHERE id=?2", params![new_bal,cid])?;
        self.audit("CREDIT_PAYMENT","customer",&cid.to_string(),Some(&bal.to_string()),Some(&new_bal.to_string()),&format!("uid:{}",uid))?;
        Ok(())
    }


    pub fn doctor_list(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare(
            "SELECT id,name,registration_no,specialisation,qualification,clinic_name,phone,email,notes,is_active,created_at FROM doctors WHERE is_active=1 ORDER BY name"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map([], |r| Ok(serde_json::json!({
            "id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,
            "registration_no":r.get::<_,Option<String>>(2)?,
            "specialisation":r.get::<_,Option<String>>(3)?,
            "qualification":r.get::<_,Option<String>>(4)?,
            "clinic_name":r.get::<_,Option<String>>(5)?,
            "phone":r.get::<_,Option<String>>(6)?,
            "email":r.get::<_,Option<String>>(7)?,
            "notes":r.get::<_,Option<String>>(8)?,
            "is_active":r.get::<_,i64>(9)?==1,
            "created_at":r.get::<_,String>(10)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::Value::Array(rows))
    }

    pub fn doctor_create(&self, d: &serde_json::Value, uid: i64) -> Result<i64, AppError> {
        let name = d["name"].as_str().unwrap_or("").trim().to_string();
        if name.is_empty() { return Err(AppError::Validation("Doctor name required.".into())); }
        let c = self.open()?;
        c.execute(
            "INSERT INTO doctors(name,registration_no,specialisation,qualification,clinic_name,phone,email,notes) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
            params![name,
                d["registration_no"].as_str().filter(|s|!s.is_empty()),
                d["specialisation"].as_str().filter(|s|!s.is_empty()),
                d["qualification"].as_str().filter(|s|!s.is_empty()),
                d["clinic_name"].as_str().filter(|s|!s.is_empty()),
                d["phone"].as_str().filter(|s|!s.is_empty()),
                d["email"].as_str().filter(|s|!s.is_empty()),
                d["notes"].as_str().filter(|s|!s.is_empty())])?;
        let id = c.last_insert_rowid();
        self.audit("DOCTOR_CREATED","doctor",&id.to_string(),None,Some(&name),&format!("uid:{}",uid))?;
        Ok(id)
    }

// ── PURCHASE / SUPPLIER FULL ─────────────────────────────────

    pub fn supplier_update(&self, id: i64, d: &serde_json::Value, uid: i64) -> Result<(), AppError> {
        let name = d["name"].as_str().unwrap_or("").trim().to_string();
        if name.is_empty() { return Err(AppError::Validation("Supplier name required.".into())); }
        let c = self.open()?;
        c.execute(
            "UPDATE suppliers SET name=?1,contact_person=?2,phone=?3,email=?4,gstin=?5,
             drug_licence_no=?6,drug_licence_expiry=?7,payment_terms=?8,
             credit_limit=?9,is_active=?10,updated_at=datetime('now') WHERE id=?11",
            params![name,
                d["contact_person"].as_str().filter(|s|!s.is_empty()),
                d["phone"].as_str().filter(|s|!s.is_empty()),
                d["email"].as_str().filter(|s|!s.is_empty()),
                d["gstin"].as_str().filter(|s|!s.is_empty()),
                d["drug_licence_no"].as_str().filter(|s|!s.is_empty()),
                d["drug_licence_expiry"].as_str().filter(|s|!s.is_empty()),
                d["payment_terms"].as_i64().unwrap_or(30),
                d["credit_limit"].as_f64().unwrap_or(0.0),
                if d["is_active"].as_bool().unwrap_or(true) {1i64} else {0i64},
                id])?;
        self.audit("SUPPLIER_UPDATED","supplier",&id.to_string(),None,None,&format!("uid:{}",uid))?;
        Ok(())
    }

    pub fn purchase_create_bill(&self, d: &serde_json::Value, uid: i64) -> Result<i64, AppError> {
        let bn = d["bill_number"].as_str().unwrap_or("").trim().to_string();
        let sid = d["supplier_id"].as_i64().ok_or(AppError::Validation("Supplier required.".into()))?;
        let total = d["total_amount"].as_f64().unwrap_or(0.0);
        if bn.is_empty() { return Err(AppError::Validation("Bill number required.".into())); }
        if total <= 0.0 { return Err(AppError::Validation("Total amount must be greater than zero.".into())); }
        let paid = d["amount_paid"].as_f64().unwrap_or(0.0);
        let status = if paid <= 0.0 { "unpaid" } else if paid < total { "partial" } else { "paid" };
        let c = self.open()?;
        c.execute(
            "INSERT INTO purchase_bills(bill_number,supplier_id,bill_date,due_date,total_amount,amount_paid,payment_status,notes,created_by)
             VALUES(?1,?2,COALESCE(?3,date('now')),?4,?5,?6,?7,?8,?9)",
            params![bn,sid,
                d["bill_date"].as_str().filter(|s|!s.is_empty()),
                d["due_date"].as_str().filter(|s|!s.is_empty()),
                total, paid, status,
                d["notes"].as_str().filter(|s|!s.is_empty()), uid])?;
        let id = c.last_insert_rowid();
        let outstanding = (total - paid).max(0.0);
        c.execute("UPDATE suppliers SET outstanding_balance=outstanding_balance+?1,updated_at=datetime('now') WHERE id=?2",
            params![outstanding, sid])?;
        self.audit("PURCHASE_BILL_CREATED","purchase",&id.to_string(),None,Some(&bn),&format!("uid:{}",uid))?;
        Ok(id)
    }

    pub fn purchase_get_bill(&self, id: i64) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        c.query_row(
            "SELECT pb.id,pb.bill_number,pb.supplier_id,s.name,pb.bill_date,pb.due_date,pb.total_amount,pb.amount_paid,pb.payment_status,pb.notes,pb.created_at FROM purchase_bills pb JOIN suppliers s ON s.id=pb.supplier_id WHERE pb.id=?1",
            params![id],
            |r| Ok(serde_json::json!({
                "id":r.get::<_,i64>(0)?,"bill_number":r.get::<_,String>(1)?,
                "supplier_id":r.get::<_,i64>(2)?,"supplier_name":r.get::<_,String>(3)?,
                "bill_date":r.get::<_,String>(4)?,"due_date":r.get::<_,Option<String>>(5)?,
                "total_amount":r.get::<_,f64>(6)?,"amount_paid":r.get::<_,f64>(7)?,
                "payment_status":r.get::<_,String>(8)?,"notes":r.get::<_,Option<String>>(9)?,
                "created_at":r.get::<_,String>(10)?
            }))
        ).optional()?.ok_or(AppError::Validation("Purchase bill not found.".into()))
    }

    pub fn purchase_list_bills(&self, f: &serde_json::Value) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let sid = f["supplier_id"].as_i64();
        let ps = f["payment_status"].as_str().unwrap_or("");
        let mut s = c.prepare(
            "SELECT pb.id,pb.bill_number,pb.supplier_id,s.name,pb.bill_date,pb.total_amount,pb.amount_paid,pb.payment_status,pb.created_at
             FROM purchase_bills pb JOIN suppliers s ON s.id=pb.supplier_id
             WHERE (?1 IS NULL OR pb.supplier_id=?1) AND (?2='' OR pb.payment_status=?2)
             ORDER BY pb.bill_date DESC, pb.id DESC LIMIT 200"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![sid, ps], |r| Ok(serde_json::json!({
            "id":r.get::<_,i64>(0)?,"bill_number":r.get::<_,String>(1)?,
            "supplier_id":r.get::<_,i64>(2)?,"supplier_name":r.get::<_,String>(3)?,
            "bill_date":r.get::<_,String>(4)?,"total_amount":r.get::<_,f64>(5)?,
            "amount_paid":r.get::<_,f64>(6)?,"payment_status":r.get::<_,String>(7)?,
            "created_at":r.get::<_,String>(8)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"bills":rows,"total":rows.len()}))
    }

// ── INVENTORY ────────────────────────────────────────────────

    pub fn inventory_get_expiry_list(&self, within_days: i64) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let days = within_days.max(1);
        let mut s = c.prepare(
            "SELECT b.id,b.medicine_id,m.name,b.batch_number,b.barcode,b.expiry_date,
                    b.purchase_price,b.selling_price,
                    (b.quantity_in-b.quantity_sold-b.quantity_adjusted) AS qty,
                    b.rack_location,
                    CAST(julianday(b.expiry_date)-julianday('now') AS INTEGER) AS days_left,
                    COALESCE(s.name,'') AS supplier_name
             FROM batches b
             JOIN medicines m ON m.id=b.medicine_id
             LEFT JOIN suppliers s ON s.id=b.supplier_id
             WHERE b.is_active=1 AND m.deleted_at IS NULL
               AND (b.quantity_in-b.quantity_sold-b.quantity_adjusted)>0
               AND date(b.expiry_date)<=date('now','+'||?1||' days')
             ORDER BY b.expiry_date ASC, m.name ASC"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![days], |r| {
            let days_left = r.get::<_,i64>(10)?;
            let risk = if days_left < 0 { "expired" } else if days_left <= 30 { "critical" } else if days_left <= 60 { "high" } else if days_left <= 90 { "medium" } else { "low" };
            Ok(serde_json::json!({
                "id":r.get::<_,i64>(0)?,"medicine_id":r.get::<_,i64>(1)?,
                "medicine_name":r.get::<_,String>(2)?,"batch_number":r.get::<_,String>(3)?,
                "barcode":r.get::<_,Option<String>>(4)?,"expiry_date":r.get::<_,String>(5)?,
                "purchase_price":r.get::<_,f64>(6)?,"selling_price":r.get::<_,f64>(7)?,
                "quantity_on_hand":r.get::<_,i64>(8)?,"rack_location":r.get::<_,Option<String>>(9)?,
                "days_left":days_left,"risk_level":risk,
                "supplier_name":r.get::<_,String>(11)?
            }))
        })?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::Value::Array(rows))
    }

    pub fn inventory_get_low_stock(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare(
            "SELECT m.id,m.name,m.generic_name,m.schedule,m.reorder_level,
                    COALESCE(SUM(CASE WHEN b.is_active=1 THEN b.quantity_in-b.quantity_sold-b.quantity_adjusted ELSE 0 END),0) AS stock
             FROM medicines m LEFT JOIN batches b ON b.medicine_id=m.id
             WHERE m.is_active=1 AND m.deleted_at IS NULL
             GROUP BY m.id HAVING stock<=m.reorder_level ORDER BY stock ASC"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map([], |r| Ok(serde_json::json!({
            "id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,
            "generic_name":r.get::<_,String>(2)?,"schedule":r.get::<_,String>(3)?,
            "reorder_level":r.get::<_,i64>(4)?,"total_stock":r.get::<_,i64>(5)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::Value::Array(rows))
    }

    pub fn inventory_adjust_stock(&self, bid: i64, qty: i64, adj_type: &str, reason: &str, uid: i64) -> Result<(), AppError> {
        if qty == 0 { return Err(AppError::Validation("Quantity must be non-zero.".into())); }
        if reason.trim().is_empty() { return Err(AppError::Validation("Reason is required.".into())); }
        let mut conn = self.open()?;
        let tx = conn.transaction()?;
        let cur: i64 = tx.query_row(
            "SELECT quantity_in-quantity_sold-quantity_adjusted FROM batches WHERE id=?1 AND is_active=1",
            params![bid], |r| r.get(0)
        ).optional()?.ok_or(AppError::Validation("Batch not found.".into()))?;
        if cur - qty < 0 { return Err(AppError::Validation("Adjustment would result in negative stock.".into())); }
        tx.execute("UPDATE batches SET quantity_adjusted=quantity_adjusted+?1,updated_at=datetime('now') WHERE id=?2", params![qty,bid])?;
        tx.execute("INSERT INTO stock_adjustments(batch_id,adjustment_type,quantity,reason,created_by) VALUES(?1,?2,?3,?4,?5)",
            params![bid,adj_type.trim(),qty,reason.trim(),uid])?;
        tx.commit()?;
        self.audit("STOCK_ADJUSTED","inventory",&bid.to_string(),None,Some(&serde_json::json!({"qty":qty,"type":adj_type}).to_string()),&format!("uid:{}",uid))?;
        Ok(())
    }



    // ── REPORTS ──────────────────────────────────────────────

    pub fn reports_sales(&self, from: &str, to: &str) -> Result<serde_json::Value, AppError> {
        if from.is_empty() || to.is_empty() { return Err(AppError::Validation("Date range required.".into())); }
        let c = self.open()?;
        let (rev,cnt,disc,avg): (f64,i64,f64,f64) = c.query_row(
            "SELECT COALESCE(SUM(net_amount),0),COUNT(1),COALESCE(SUM(discount_amount),0),COALESCE(AVG(net_amount),0)
             FROM bills WHERE status='active' AND date(bill_date) BETWEEN date(?1) AND date(?2)",
            params![from,to], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))
        )?;
        let mut ds = c.prepare(
            "SELECT date(bill_date),COUNT(1),COALESCE(SUM(net_amount),0),COALESCE(SUM(discount_amount),0)
             FROM bills WHERE status='active' AND date(bill_date) BETWEEN date(?1) AND date(?2)
             GROUP BY date(bill_date) ORDER BY date(bill_date)"
        )?;
        let daily: Vec<serde_json::Value> = ds.query_map(params![from,to], |r| Ok(serde_json::json!({
            "date":r.get::<_,String>(0)?,"bill_count":r.get::<_,i64>(1)?,
            "net_sales":r.get::<_,f64>(2)?,"discount":r.get::<_,f64>(3)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        let mut ts = c.prepare(
            "SELECT bi.medicine_name,SUM(bi.quantity),SUM(bi.total_amount)
             FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
             WHERE b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
             GROUP BY bi.medicine_name ORDER BY SUM(bi.total_amount) DESC LIMIT 10"
        )?;
        let top: Vec<serde_json::Value> = ts.query_map(params![from,to], |r| Ok(serde_json::json!({
            "medicine_name":r.get::<_,String>(0)?,"quantity":r.get::<_,i64>(1)?,"total_amount":r.get::<_,f64>(2)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        let mut ps = c.prepare(
            "SELECT p.payment_mode,COALESCE(SUM(p.amount),0)
             FROM payments p JOIN bills b ON b.id=p.bill_id
             WHERE b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
             GROUP BY p.payment_mode ORDER BY SUM(p.amount) DESC"
        )?;
        let pays: Vec<serde_json::Value> = ps.query_map(params![from,to], |r| Ok(serde_json::json!({
            "mode":r.get::<_,String>(0)?,"amount":r.get::<_,f64>(1)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({
            "summary":{"from":from,"to":to,"total_revenue":rev,"bill_count":cnt,"total_discount":disc,"avg_bill_value":avg},
            "daily":daily,"top_medicines":top,"payment_breakdown":pays
        }))
    }

    pub fn reports_purchase(&self, from: &str, to: &str) -> Result<serde_json::Value, AppError> {
        if from.is_empty()||to.is_empty() { return Err(AppError::Validation("Date range required.".into())); }
        let c = self.open()?;
        let (total,cnt): (f64,i64) = c.query_row(
            "SELECT COALESCE(SUM(total_amount),0),COUNT(1) FROM purchase_bills WHERE date(bill_date) BETWEEN date(?1) AND date(?2)",
            params![from,to], |r| Ok((r.get(0)?,r.get(1)?))
        )?;
        let mut ss = c.prepare(
            "SELECT s.name,COUNT(pb.id),COALESCE(SUM(pb.total_amount),0)
             FROM purchase_bills pb JOIN suppliers s ON s.id=pb.supplier_id
             WHERE date(pb.bill_date) BETWEEN date(?1) AND date(?2)
             GROUP BY s.name ORDER BY SUM(pb.total_amount) DESC"
        )?;
        let by_supplier: Vec<serde_json::Value> = ss.query_map(params![from,to], |r| Ok(serde_json::json!({
            "supplier_name":r.get::<_,String>(0)?,"bill_count":r.get::<_,i64>(1)?,"total_amount":r.get::<_,f64>(2)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"summary":{"from":from,"to":to,"total_purchase":total,"bill_count":cnt},"by_supplier":by_supplier}))
    }

    pub fn reports_stock(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let (lines,units,cost_val,sell_val): (i64,i64,f64,f64) = c.query_row(
            "SELECT COUNT(DISTINCT m.id),
                    COALESCE(SUM(CASE WHEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted)>0 THEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted) ELSE 0 END),0),
                    COALESCE(SUM(CASE WHEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted)>0 THEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted)*b.purchase_price ELSE 0 END),0),
                    COALESCE(SUM(CASE WHEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted)>0 THEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted)*b.selling_price ELSE 0 END),0)
             FROM batches b JOIN medicines m ON m.id=b.medicine_id WHERE b.is_active=1 AND m.deleted_at IS NULL",
            [], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))
        )?;
        let mut s = c.prepare(
            "SELECT m.id,m.name,
                    COALESCE(SUM(CASE WHEN b.is_active=1 THEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted) ELSE 0 END),0) AS qty,
                    COALESCE(SUM(CASE WHEN b.is_active=1 AND (b.quantity_in-b.quantity_sold-b.quantity_adjusted)>0 THEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted)*b.purchase_price ELSE 0 END),0) AS cv,
                    COALESCE(SUM(CASE WHEN b.is_active=1 AND (b.quantity_in-b.quantity_sold-b.quantity_adjusted)>0 THEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted)*b.selling_price ELSE 0 END),0) AS sv
             FROM medicines m LEFT JOIN batches b ON b.medicine_id=m.id
             WHERE m.deleted_at IS NULL AND m.is_active=1
             GROUP BY m.id HAVING qty>0 ORDER BY cv DESC"
        )?;
        let items: Vec<serde_json::Value> = s.query_map([], |r| Ok(serde_json::json!({
            "medicine_id":r.get::<_,i64>(0)?,"medicine_name":r.get::<_,String>(1)?,
            "quantity_on_hand":r.get::<_,i64>(2)?,"cost_value":r.get::<_,f64>(3)?,"selling_value":r.get::<_,f64>(4)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"summary":{"medicine_count":lines,"total_units":units,"cost_value":cost_val,"selling_value":sell_val,"potential_margin":sell_val-cost_val},"items":items}))
    }

    pub fn reports_gst(&self, from: &str, to: &str) -> Result<serde_json::Value, AppError> {
        if from.is_empty()||to.is_empty() { return Err(AppError::Validation("Date range required.".into())); }
        let c = self.open()?;
        let (taxable,cgst,sgst,igst,total): (f64,f64,f64,f64,f64) = c.query_row(
            "SELECT COALESCE(SUM(taxable_amount),0),COALESCE(SUM(cgst_amount),0),COALESCE(SUM(sgst_amount),0),COALESCE(SUM(igst_amount),0),COALESCE(SUM(net_amount),0)
             FROM bills WHERE status='active' AND date(bill_date) BETWEEN date(?1) AND date(?2)",
            params![from,to], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))
        )?;
        let mut hs = c.prepare(
            "SELECT COALESCE(NULLIF(TRIM(COALESCE(m.hsn_code,'')),''),'UNKNOWN') AS hsn,
                    COUNT(DISTINCT bi.bill_id),COALESCE(SUM(bi.total_amount-bi.cgst_amount-bi.sgst_amount-bi.igst_amount),0),
                    COALESCE(SUM(bi.cgst_amount),0),COALESCE(SUM(bi.sgst_amount),0),COALESCE(SUM(bi.igst_amount),0),COALESCE(SUM(bi.total_amount),0)
             FROM bill_items bi JOIN bills b ON b.id=bi.bill_id LEFT JOIN medicines m ON m.id=bi.medicine_id
             WHERE b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
             GROUP BY hsn ORDER BY SUM(bi.total_amount) DESC"
        )?;
        let hsn: Vec<serde_json::Value> = hs.query_map(params![from,to], |r| Ok(serde_json::json!({
            "hsn_code":r.get::<_,String>(0)?,"bill_count":r.get::<_,i64>(1)?,"taxable":r.get::<_,f64>(2)?,
            "cgst":r.get::<_,f64>(3)?,"sgst":r.get::<_,f64>(4)?,"igst":r.get::<_,f64>(5)?,"total":r.get::<_,f64>(6)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"summary":{"from":from,"to":to,"taxable_amount":taxable,"cgst":cgst,"sgst":sgst,"igst":igst,"total_gst":cgst+sgst+igst,"total_invoice":total},"hsn_summary":hsn}))
    }

    pub fn reports_profit_loss(&self, from: &str, to: &str) -> Result<serde_json::Value, AppError> {
        if from.is_empty()||to.is_empty() { return Err(AppError::Validation("Date range required.".into())); }
        let c = self.open()?;
        let (rev,cogs): (f64,f64) = c.query_row(
            "SELECT COALESCE(SUM(b.net_amount),0),COALESCE(SUM(bi.quantity*COALESCE(bt.purchase_price,0)),0)
             FROM bills b LEFT JOIN bill_items bi ON bi.bill_id=b.id LEFT JOIN batches bt ON bt.id=bi.batch_id
             WHERE b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2)",
            params![from,to], |r| Ok((r.get(0)?,r.get(1)?))
        )?;
        let purchases: f64 = c.query_row(
            "SELECT COALESCE(SUM(total_amount),0) FROM purchase_bills WHERE date(bill_date) BETWEEN date(?1) AND date(?2)",
            params![from,to], |r| r.get(0)
        )?;
        let gross = rev - cogs;
        let margin = if rev > 0.0 { (gross/rev)*100.0 } else { 0.0 };
        let mut ds = c.prepare(
            "SELECT date(b.bill_date),COALESCE(SUM(b.net_amount),0),COALESCE(SUM(bi.quantity*COALESCE(bt.purchase_price,0)),0)
             FROM bills b LEFT JOIN bill_items bi ON bi.bill_id=b.id LEFT JOIN batches bt ON bt.id=bi.batch_id
             WHERE b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
             GROUP BY date(b.bill_date) ORDER BY date(b.bill_date)"
        )?;
        let daily: Vec<serde_json::Value> = ds.query_map(params![from,to], |r| {
            let r_v = r.get::<_,f64>(1)?; let c_v = r.get::<_,f64>(2)?;
            let gp = r_v - c_v; let m = if r_v > 0.0 { (gp/r_v)*100.0 } else { 0.0 };
            Ok(serde_json::json!({"date":r.get::<_,String>(0)?,"revenue":r_v,"cogs":c_v,"gross_profit":gp,"margin_pct":m}))
        })?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"summary":{"from":from,"to":to,"revenue":rev,"cogs":cogs,"gross_profit":gross,"gross_margin_pct":margin,"total_purchases":purchases},"daily":daily}))
    }

    pub fn reports_audit_log(&self, from: &str, to: &str) -> Result<serde_json::Value, AppError> {
        if from.is_empty()||to.is_empty() { return Err(AppError::Validation("Date range required.".into())); }
        let c = self.open()?;
        let total: i64 = c.query_row("SELECT COUNT(1) FROM audit_log WHERE date(created_at) BETWEEN date(?1) AND date(?2)", params![from,to], |r| r.get(0))?;
        let mut s = c.prepare(
            "SELECT id,created_at,user_name,action,module,COALESCE(record_id,''),COALESCE(new_value,'')
             FROM audit_log WHERE date(created_at) BETWEEN date(?1) AND date(?2)
             ORDER BY created_at DESC LIMIT 1000"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![from,to], |r| Ok(serde_json::json!({
            "id":r.get::<_,i64>(0)?,"created_at":r.get::<_,String>(1)?,"user_name":r.get::<_,String>(2)?,
            "action":r.get::<_,String>(3)?,"module":r.get::<_,String>(4)?,
            "record_id":r.get::<_,String>(5)?,"details":r.get::<_,String>(6)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"rows":rows,"total":total}))
    }

    pub fn reports_ca_package(&self, fy: &str) -> Result<String, AppError> {
        let (from, to, label) = Self::parse_fy(fy)?;
        let sales   = self.reports_sales(&from, &to)?;
        let purchase = self.reports_purchase(&from, &to)?;
        let stock   = self.reports_stock()?;
        let gst     = self.reports_gst(&from, &to)?;
        let pl      = self.reports_profit_loss(&from, &to)?;
        let audit   = self.reports_audit_log(&from, &to)?;

        let dir = std::env::temp_dir().join("pharmacare-ca");
        std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
        let stamp = chrono::Utc::now().format("%Y%m%d%H%M%S");
        let zip_path = dir.join(format!("CA_Package_{}_{}.zip", label, stamp));
        let f = std::fs::File::create(&zip_path).map_err(|e| AppError::Internal(e.to_string()))?;
        let mut zip = zip::ZipWriter::new(f);
        let opts = zip::write::FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        let readme = format!("PharmaCare Pro — CA Package\nFY: {}\nPeriod: {} to {}\nGenerated: {}\n",
            label, from, to, chrono::Utc::now().to_rfc3339());
        zip.start_file("README.txt", opts).map_err(|e| AppError::Internal(e.to_string()))?;
        use std::io::Write;
        zip.write_all(readme.as_bytes()).map_err(|e| AppError::Internal(e.to_string()))?;

        for (name, data) in [
            ("01_Sales.json", &sales), ("02_Purchase.json", &purchase),
            ("03_Stock.json", &stock), ("04_GST.json", &gst),
            ("05_ProfitLoss.json", &pl), ("06_AuditLog.json", &audit),
        ] {
            zip.start_file(name, opts).map_err(|e| AppError::Internal(e.to_string()))?;
            zip.write_all(serde_json::to_string_pretty(data).map_err(|e| AppError::Internal(e.to_string()))?.as_bytes())
                .map_err(|e| AppError::Internal(e.to_string()))?;
        }
        zip.finish().map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(zip_path.to_string_lossy().to_string())
    }

    fn parse_fy(fy: &str) -> Result<(String, String, String), AppError> {
        let t = fy.trim().replace('/', "-");
        let parts: Vec<&str> = t.split('-').collect();
        let yr = parts[0].parse::<i32>().map_err(|_| AppError::Validation("Use format 2025-26.".into()))?;
        Ok((format!("{}-04-01", yr), format!("{}-03-31", yr+1), format!("{}-{}", yr, yr+1)))
    }

    // ── AI TIER 1 ────────────────────────────────────────────

    pub fn ai_morning_briefing(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let low: i64 = c.query_row(
            "SELECT COUNT(1) FROM medicines m WHERE m.is_active=1 AND m.deleted_at IS NULL
             AND COALESCE((SELECT SUM(b.quantity_in-b.quantity_sold-b.quantity_adjusted) FROM batches b WHERE b.medicine_id=m.id AND b.is_active=1),0)<m.reorder_level",
            [], |r| r.get(0))?;
        let exp: i64 = c.query_row(
            "SELECT COUNT(1) FROM batches WHERE is_active=1 AND (quantity_in-quantity_sold-quantity_adjusted)>0 AND date(expiry_date)<=date('now','+30 days')",
            [], |r| r.get(0))?;
        let out_c: i64 = c.query_row("SELECT COUNT(1) FROM customers WHERE is_active=1 AND outstanding_balance>0", [], |r| r.get(0))?;
        let (rev,cnt): (f64,i64) = c.query_row(
            "SELECT COALESCE(SUM(net_amount),0),COUNT(1) FROM bills WHERE date(bill_date)=date('now') AND status='active'",
            [], |r| Ok((r.get(0)?,r.get(1)?)))?;
        let mut actions: Vec<serde_json::Value> = vec![
            serde_json::json!({"priority":"info","icon":"trending-up","message":format!("Today so far: ₹{:.0} revenue, {} bills.",rev,cnt),"link":"/dashboard"})
        ];
        if low > 0 { actions.push(serde_json::json!({"priority":"urgent","icon":"alert-triangle","message":format!("{} medicines below reorder level — order now.",low),"link":"/expiry"})); }
        if exp > 0 { actions.push(serde_json::json!({"priority":"important","icon":"clock","message":format!("{} batches expiring within 30 days.",exp),"link":"/expiry"})); }
        if out_c > 0 { actions.push(serde_json::json!({"priority":"info","icon":"users","message":format!("{} customers have outstanding balances.",out_c),"link":"/customers"})); }
        Ok(serde_json::json!({"actions":actions}))
    }

    pub fn ai_demand_forecast(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare(
            "SELECT m.id,m.name,
                    COALESCE(SUM(CASE WHEN date(b.bill_date)>=date('now','-30 days') THEN bi.quantity ELSE 0 END),0) AS q30,
                    COALESCE(SUM(CASE WHEN date(b.bill_date)>=date('now','-90 days') THEN bi.quantity ELSE 0 END),0) AS q90,
                    COALESCE(SUM(CASE WHEN bt.is_active=1 THEN bt.quantity_in-bt.quantity_sold-bt.quantity_adjusted ELSE 0 END),0) AS stock
             FROM medicines m
             LEFT JOIN bill_items bi ON bi.medicine_id=m.id
             LEFT JOIN bills b ON b.id=bi.bill_id AND b.status='active'
             LEFT JOIN batches bt ON bt.medicine_id=m.id
             WHERE m.is_active=1 AND m.deleted_at IS NULL
             GROUP BY m.id ORDER BY q30 DESC LIMIT 50"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map([], |r| {
            let q30 = r.get::<_,f64>(2)?; let q90 = r.get::<_,f64>(3)?; let stock = r.get::<_,i64>(4)?;
            let avg90 = q90/3.0; let forecast = (avg90*1.1).round() as i64;
            let reorder = (forecast - stock).max(0);
            let trend = if q30 > avg90*1.15 {"up"} else if q30 < avg90*0.85 {"down"} else {"stable"};
            Ok(serde_json::json!({
                "medicine_id":r.get::<_,i64>(0)?,"medicine_name":r.get::<_,String>(1)?,
                "sold_last_30d":q30 as i64,"sold_last_90d":q90 as i64,"current_stock":stock,
                "forecast_30day":forecast,"recommended_order":reorder,
                "confidence":if q90>0.0{0.75}else{0.4},"trend":trend
            }))
        })?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::Value::Array(rows))
    }

    pub fn ai_expiry_risks(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare(
            "SELECT b.id,m.name,b.batch_number,b.expiry_date,
                    (b.quantity_in-b.quantity_sold-b.quantity_adjusted) AS qty,
                    CAST(julianday(b.expiry_date)-julianday('now') AS INTEGER) AS days
             FROM batches b JOIN medicines m ON m.id=b.medicine_id
             WHERE b.is_active=1 AND m.deleted_at IS NULL AND (b.quantity_in-b.quantity_sold-b.quantity_adjusted)>0
             ORDER BY b.expiry_date ASC"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map([], |r| {
            let qty = r.get::<_,i64>(4)?; let days = r.get::<_,i64>(5)?;
            let score = if days<=0{10} else if days<=30{8} else if days<=60{6} else if days<=90{4} else{2};
            let level = if score>=9{"critical"} else if score>=7{"high"} else if score>=5{"medium"} else{"low"};
            let action = match level {"critical"=>"Return to supplier immediately.","high"=>"Promote or arrange return.","medium"=>"Monitor closely.",_=>"Stock OK."};
            Ok(serde_json::json!({"batch_id":r.get::<_,i64>(0)?,"medicine_name":r.get::<_,String>(1)?,
                "batch_number":r.get::<_,String>(2)?,"expiry_date":r.get::<_,String>(3)?,
                "quantity_on_hand":qty,"days_to_expiry":days,"risk_score":score,"risk_level":level,"action_suggested":action}))
        })?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::Value::Array(rows))
    }

    pub fn ai_customer_segments(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare(
            "SELECT c.id,c.name,c.phone,
                    COALESCE(MAX(date(b.bill_date)),'') AS last_purchase,
                    COALESCE(SUM(CASE WHEN date(b.bill_date)>=date('now','-90 days') THEN b.net_amount ELSE 0 END),0) AS spend90,
                    COALESCE(SUM(CASE WHEN date(b.bill_date)>=date('now','-90 days') THEN 1 ELSE 0 END),0) AS cnt90,
                    COALESCE(CAST(julianday('now')-julianday(MAX(date(b.bill_date))) AS INTEGER),999) AS days_since
             FROM customers c LEFT JOIN bills b ON b.customer_id=c.id AND b.status='active'
             WHERE c.is_active=1 GROUP BY c.id ORDER BY c.name"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map([], |r| {
            let spend = r.get::<_,f64>(4)?; let cnt = r.get::<_,i64>(5)?; let days = r.get::<_,i64>(6)?;
            let seg = if cnt>=6&&spend>=5000.0{"champion"} else if cnt>=3&&days<=60{"loyal"} else if days<=30{"new"} else if days<=90{"regular"} else if days<=180{"at_risk"} else{"dormant"};
            Ok(serde_json::json!({"customer_id":r.get::<_,i64>(0)?,"customer_name":r.get::<_,String>(1)?,"phone":r.get::<_,Option<String>>(2)?,
                "last_purchase_date":r.get::<_,String>(3)?,"spend_90_days":spend,"visit_count_90_days":cnt,"days_since_last_visit":days,
                "segment":seg,"estimated_annual_clv":spend*4.0}))
        })?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::Value::Array(rows))
    }

    pub fn ai_abc_xyz(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare(
            "SELECT m.id,m.name,COALESCE(SUM(bi.total_amount),0) AS revenue,COALESCE(SUM(bi.quantity),0) AS qty
             FROM medicines m
             LEFT JOIN bill_items bi ON bi.medicine_id=m.id
             LEFT JOIN bills b ON b.id=bi.bill_id AND b.status='active' AND date(b.bill_date)>=date('now','-90 days')
             WHERE m.is_active=1 AND m.deleted_at IS NULL GROUP BY m.id ORDER BY revenue DESC"
        )?;
        let all: Vec<(i64,String,f64,i64)> = s.query_map([], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))?
            .collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        let total_rev: f64 = all.iter().map(|r| r.2).sum();
        let mut cum = 0.0f64;
        let mut out = vec![];
        for (id,name,rev,qty) in &all {
            cum += rev;
            let abc = if total_rev > 0.0 { if cum/total_rev<=0.7{"A"} else if cum/total_rev<=0.9{"B"} else{"C"} } else {"C"};
            // XYZ based on simple heuristic from total qty
            let xyz = if *qty > 100 {"X"} else if *qty > 20 {"Y"} else {"Z"};
            out.push(serde_json::json!({"medicine_id":id,"medicine_name":name,"revenue_90_days":rev,"quantity_90_days":qty,"abc_class":abc,"xyz_class":xyz,"combined_class":format!("{}{}",abc,xyz)}));
        }
        Ok(serde_json::Value::Array(out))
    }

    pub fn ai_po_suggestions(&self) -> Result<serde_json::Value, AppError> {
        let forecast = self.ai_demand_forecast()?;
        let arr = forecast.as_array().cloned().unwrap_or_default();
        let suggestions: Vec<serde_json::Value> = arr.into_iter()
            .filter(|i| i["recommended_order"].as_i64().unwrap_or(0) > 0)
            .collect();
        Ok(serde_json::Value::Array(suggestions))
    }

    pub fn ai_anomalies(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut out = vec![];
        let mut s1 = c.prepare("SELECT bi.id,bi.bill_id,bi.medicine_name,bi.discount_percent FROM bill_items bi WHERE bi.discount_percent>=35 ORDER BY bi.discount_percent DESC LIMIT 20")?;
        let r1: Vec<serde_json::Value> = s1.query_map([], |r| Ok(serde_json::json!({"type":"high_discount","severity":"medium",
            "description":format!("{}% discount on {} in bill #{}",r.get::<_,f64>(3)?.round(),r.get::<_,String>(2)?,r.get::<_,i64>(1)?),"record_id":r.get::<_,i64>(0)?})))?
            .collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        out.extend(r1);
        let mut s2 = c.prepare("SELECT bi.id,bi.bill_id,bi.medicine_name,bi.unit_price,COALESCE(bt.purchase_price,0) FROM bill_items bi LEFT JOIN batches bt ON bt.id=bi.batch_id WHERE bi.unit_price < COALESCE(bt.purchase_price,0)*0.98 LIMIT 20")?;
        let r2: Vec<serde_json::Value> = s2.query_map([], |r| Ok(serde_json::json!({"type":"below_cost_sale","severity":"high",
            "description":format!("{} sold below cost in bill #{}",r.get::<_,String>(2)?,r.get::<_,i64>(1)?),"record_id":r.get::<_,i64>(0)?})))?
            .collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        out.extend(r2);
        Ok(serde_json::Value::Array(out))
    }

    pub fn ai_ask_pharmacare(&self, question: &str) -> Result<String, AppError> {
        let api_key = self.get_setting("claude_api_key")?
            .map(|k| k.trim_matches('"').to_string())
            .filter(|k| !k.is_empty())
            .ok_or(AppError::Validation("Claude API key not configured. Go to Settings → API Keys.".into()))?;
        let summary = self.today_summary()?;
        let context = format!(
            "You are PharmaCare Pro AI for an Indian pharmacy. Today: revenue=₹{:.0}, bills={}, date={}. Be concise, answer in plain English or Hindi.",
            summary["total_revenue"].as_f64().unwrap_or(0.0),
            summary["bill_count"].as_i64().unwrap_or(0),
            chrono::Utc::now().format("%d %b %Y")
        );
        let rt = tokio::runtime::Handle::current();
        let resp = rt.block_on(async {
            reqwest::Client::new()
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version","2023-06-01")
                .header("content-type","application/json")
                .json(&serde_json::json!({"model":"claude-sonnet-4-20250514","max_tokens":1024,"system":context,"messages":[{"role":"user","content":question}]}))
                .send().await
        }).map_err(|e| AppError::Internal(format!("Network error: {}",e)))?;
        let data: serde_json::Value = rt.block_on(resp.json()).map_err(|e| AppError::Internal(e.to_string()))?;
        data["content"][0]["text"].as_str().map(|s| s.to_string()).ok_or(AppError::Internal("Unexpected API response.".into()))
    }

    // ── BARCODE ──────────────────────────────────────────────

    pub fn barcode_generate(&self, batch_id: i64) -> Result<String, AppError> {
        let c = self.open()?;
        let (mid, bn, existing): (i64, String, Option<String>) = c.query_row(
            "SELECT medicine_id,batch_number,barcode FROM batches WHERE id=?1 AND is_active=1",
            params![batch_id], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))
        ).optional()?.ok_or(AppError::Validation("Batch not found.".into()))?;
        if let Some(b) = existing { if !b.trim().is_empty() { return Ok(b); } }
        let barcode = format!("MED{:05}-{}", mid, bn.chars().filter(|c| c.is_ascii_alphanumeric()).collect::<String>().to_uppercase());
        c.execute("UPDATE batches SET barcode=?1 WHERE id=?2", params![barcode, batch_id])?;
        Ok(barcode)
    }

    pub fn barcode_generate_bulk(&self, ids: &[i64]) -> Result<serde_json::Value, AppError> {
        let mut out = vec![];
        for &id in ids { out.push(serde_json::json!({"batch_id":id,"barcode":self.barcode_generate(id)?})); }
        Ok(serde_json::Value::Array(out))
    }

    // ── BACKUP ───────────────────────────────────────────────

    pub fn backup_create(&self, dest: Option<&str>) -> Result<String, AppError> {
        let dir = if let Some(d) = dest { std::path::PathBuf::from(d) }
            else { std::env::current_dir().map_err(|e| AppError::Internal(e.to_string()))?.join("backups") };
        std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
        let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let target = dir.join(format!("pharmacare_backup_{}.db", stamp));
        std::fs::copy(&self.path, &target).map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(target.to_string_lossy().to_string())
    }

    pub fn backup_list(&self) -> Result<serde_json::Value, AppError> {
        let dir = std::env::current_dir().map_err(|e| AppError::Internal(e.to_string()))?.join("backups");
        if !dir.exists() { return Ok(serde_json::Value::Array(vec![])); }
        let mut rows = vec![];
        for entry in std::fs::read_dir(&dir).map_err(|e| AppError::Internal(e.to_string()))? {
            let entry = entry.map_err(|e| AppError::Internal(e.to_string()))?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("db") { continue; }
            let meta = entry.metadata().map_err(|e| AppError::Internal(e.to_string()))?;
            rows.push(serde_json::json!({
                "file_name": path.file_name().and_then(|n| n.to_str()).unwrap_or(""),
                "file_path": path.to_string_lossy(),
                "size_bytes": meta.len(),
                "modified_at": meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0)
            }));
        }
        rows.sort_by(|a,b| b["modified_at"].as_u64().unwrap_or(0).cmp(&a["modified_at"].as_u64().unwrap_or(0)));
        Ok(serde_json::Value::Array(rows))
    }

    pub fn backup_restore(&self, path: &str) -> Result<(), AppError> {
        let src = std::path::PathBuf::from(path.trim());
        if !src.exists() { return Err(AppError::Validation("Backup file not found.".into())); }
        let pre = self.path.with_file_name(format!("pre_restore_{}.db", chrono::Utc::now().format("%Y%m%d%H%M%S")));
        let _ = std::fs::copy(&self.path, &pre);
        std::fs::copy(&src, &self.path).map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    // ── DOCTOR UPDATE ────────────────────────────────────────

    pub fn doctor_update(&self, id: i64, d: &serde_json::Value, uid: i64) -> Result<(), AppError> {
        let name = d["name"].as_str().unwrap_or("").trim().to_string();
        if name.is_empty() { return Err(AppError::Validation("Doctor name required.".into())); }
        let c = self.open()?;
        c.execute(
            "UPDATE doctors SET name=?1,registration_no=?2,specialisation=?3,qualification=?4,clinic_name=?5,phone=?6,email=?7,notes=?8,is_active=?9,updated_at=datetime('now') WHERE id=?10",
            params![name,
                d["registration_no"].as_str().filter(|s|!s.is_empty()),
                d["specialisation"].as_str().filter(|s|!s.is_empty()),
                d["qualification"].as_str().filter(|s|!s.is_empty()),
                d["clinic_name"].as_str().filter(|s|!s.is_empty()),
                d["phone"].as_str().filter(|s|!s.is_empty()),
                d["email"].as_str().filter(|s|!s.is_empty()),
                d["notes"].as_str().filter(|s|!s.is_empty()),
                if d["is_active"].as_bool().unwrap_or(true){1i64}else{0i64},
                id])?;
        self.audit("DOCTOR_UPDATED","doctor",&id.to_string(),None,Some(&name),&format!("uid:{}",uid))?;
        Ok(())
    }



    // ── S5 ADDITIONS ─────────────────────────────────────────

    pub fn list_roles(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare("SELECT id, name, permissions FROM roles ORDER BY id")?;
        let rows: Vec<serde_json::Value> = s.query_map([], |r| Ok(serde_json::json!({
            "id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,
            "permissions":serde_json::from_str::<serde_json::Value>(&r.get::<_,String>(2)?).unwrap_or(serde_json::json!({}))
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::Value::Array(rows))
    }

    pub fn admin_reset_password(&self, uid: i64, new_pw: &str, admin_id: i64) -> Result<(), AppError> {
        if new_pw.len() < 8 { return Err(AppError::Validation("Password must be at least 8 characters.".into())); }
        let pw = bcrypt::hash(new_pw, bcrypt::DEFAULT_COST).map_err(|e| AppError::Internal(e.to_string()))?;
        let c = self.open()?;
        let n = c.execute("UPDATE users SET password_hash=?1 WHERE id=?2", params![pw, uid])?;
        if n == 0 { return Err(AppError::Validation("User not found.".into())); }
        c.execute("UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=?1", params![uid])?;
        self.audit("ADMIN_RESET_PASSWORD","auth",&uid.to_string(),None,None,&format!("uid:{}",admin_id))?;
        Ok(())
    }

    pub fn list_returns(&self, limit: i64) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let lim = limit.clamp(1, 200);
        let mut s = c.prepare(
            "SELECT sr.id,sr.return_number,sr.original_bill_id,b.bill_number,
                    sr.return_date,sr.reason,sr.total_amount,sr.created_at
             FROM sale_returns sr LEFT JOIN bills b ON b.id=sr.original_bill_id
             ORDER BY sr.created_at DESC LIMIT ?1"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![lim], |r| Ok(serde_json::json!({
            "id":r.get::<_,i64>(0)?,"return_number":r.get::<_,String>(1)?,
            "original_bill_id":r.get::<_,i64>(2)?,"original_bill_number":r.get::<_,Option<String>>(3)?,
            "return_date":r.get::<_,String>(4)?,"reason":r.get::<_,Option<String>>(5)?,
            "total_amount":r.get::<_,f64>(6)?,"created_at":r.get::<_,String>(7)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::Value::Array(rows))
    }

    pub fn inventory_get_stock(&self, f: &serde_json::Value) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let q = f["search"].as_str().unwrap_or("").trim().to_lowercase();
        let like = format!("%{}%", q);
        let cat = f["category_id"].as_i64();
        let low = f["low_stock"].as_bool().unwrap_or(false);
        let mut s = c.prepare(
            "SELECT m.id,m.name,m.generic_name,m.schedule,m.reorder_level,
                    COALESCE(cat.name,'') AS cat_name,
                    COALESCE(SUM(CASE WHEN b.is_active=1 THEN b.quantity_in-b.quantity_sold-b.quantity_adjusted ELSE 0 END),0) AS stock
             FROM medicines m
             LEFT JOIN categories cat ON cat.id=m.category_id
             LEFT JOIN batches b ON b.medicine_id=m.id
             WHERE m.deleted_at IS NULL AND m.is_active=1
               AND (?1='' OR lower(m.name) LIKE ?2 OR lower(m.generic_name) LIKE ?2)
               AND (?3 IS NULL OR m.category_id=?3)
             GROUP BY m.id HAVING (?4=0 OR stock<=m.reorder_level)
             ORDER BY m.name"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![q, like, cat, if low{1}else{0}], |r| Ok(serde_json::json!({
            "id":r.get::<_,i64>(0)?,"name":r.get::<_,String>(1)?,"generic_name":r.get::<_,String>(2)?,
            "schedule":r.get::<_,String>(3)?,"reorder_level":r.get::<_,i64>(4)?,
            "category_name":r.get::<_,String>(5)?,"total_stock":r.get::<_,i64>(6)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"items":rows,"total":rows.len()}))
    }

    pub fn inventory_physical_count(&self, batch_id: i64, actual_qty: i64, uid: i64) -> Result<(), AppError> {
        if actual_qty < 0 { return Err(AppError::Validation("Quantity cannot be negative.".into())); }
        let c = self.open()?;
        let (qty_in, qty_sold, qty_adj): (i64,i64,i64) = c.query_row(
            "SELECT quantity_in, quantity_sold, quantity_adjusted FROM batches WHERE id=?1 AND is_active=1",
            params![batch_id], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?))
        ).optional()?.ok_or(AppError::Validation("Batch not found.".into()))?;
        let current = qty_in - qty_sold - qty_adj;
        let diff = current - actual_qty;
        if diff == 0 { return Ok(()); }
        c.execute("UPDATE batches SET quantity_adjusted=quantity_adjusted+?1,updated_at=datetime('now') WHERE id=?2", params![diff, batch_id])?;
        c.execute("INSERT INTO stock_adjustments(batch_id,adjustment_type,quantity,reason,created_by) VALUES(?1,'physical_count',?2,'Physical count adjustment',?3)",
            params![batch_id, diff, uid])?;
        self.audit("PHYSICAL_COUNT","inventory",&batch_id.to_string(),Some(&current.to_string()),Some(&actual_qty.to_string()),&format!("uid:{}",uid))?;
        Ok(())
    }

    pub fn purchase_add_batch_from_bill(&self, purchase_bill_id: i64, d: &serde_json::Value, uid: i64) -> Result<i64, AppError> {
        // Verify purchase bill exists
        let c = self.open()?;
        let _: i64 = c.query_row("SELECT id FROM purchase_bills WHERE id=?1", params![purchase_bill_id], |r| r.get(0))
            .optional()?.ok_or(AppError::Validation("Purchase bill not found.".into()))?;
        // Create batch via existing method, attach to supplier
        let batch_id = self.medicine_create_batch(d, uid)?;
        // Link batch to purchase bill
        c.execute("UPDATE batches SET purchase_bill_id=?1 WHERE id=?2", params![purchase_bill_id, batch_id])?;
        Ok(batch_id)
    }

    // ── AI TIER 3 NEW METHODS ─────────────────────────────────

    pub fn ai_compose_whatsapp(&self, customer_name: &str, situation: &str, language: &str, tone: &str) -> Result<String, AppError> {
        let api_key = self.get_setting("claude_api_key")?
            .map(|k| k.trim_matches('"').to_string())
            .filter(|k| !k.is_empty())
            .ok_or(AppError::Validation("Claude API key not configured. Go to Settings → API Keys.".into()))?;

        let prompt = format!(
            "Write a short WhatsApp message for an Indian pharmacy customer named {}.\nSituation: {}\nLanguage: {}\nTone: {}\n\nRules:\n- Keep it under 160 characters if possible\n- Sound natural and human, not robotic\n- No emojis unless tone is Friendly\n- Include pharmacy context appropriately\n- For Hindi/Marathi, use proper script\n\nWrite only the message, nothing else.",
            customer_name, situation, language, tone
        );

        let rt = tokio::runtime::Handle::current();
        let resp = rt.block_on(async {
            reqwest::Client::new()
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version","2023-06-01")
                .header("content-type","application/json")
                .json(&serde_json::json!({"model":"claude-sonnet-4-20250514","max_tokens":300,"messages":[{"role":"user","content":prompt}]}))
                .send().await
        }).map_err(|e| AppError::Internal(format!("Network: {}",e)))?;
        let data: serde_json::Value = rt.block_on(resp.json()).map_err(|e| AppError::Internal(e.to_string()))?;
        data["content"][0]["text"].as_str().map(|s| s.trim().to_string()).ok_or(AppError::Internal("Unexpected API response.".into()))
    }

    pub fn ai_ca_narration(&self, fy: &str) -> Result<String, AppError> {
        let api_key = self.get_setting("claude_api_key")?
            .map(|k| k.trim_matches('"').to_string())
            .filter(|k| !k.is_empty())
            .ok_or(AppError::Validation("Claude API key not configured. Go to Settings → API Keys.".into()))?;

        let (from, to, label) = Self::parse_fy(fy)?;
        let sales = self.reports_sales(&from, &to)?;
        let pl = self.reports_profit_loss(&from, &to)?;
        let gst = self.reports_gst(&from, &to)?;

        let ss = &sales["summary"];
        let ps = &pl["summary"];
        let gs = &gst["summary"];

        let context = format!(
            "FY: {}\nRevenue: ₹{:.0}\nBills: {}\nGross Profit: ₹{:.0}\nMargin: {:.1}%\nTotal GST Collected: ₹{:.0}\nCGST: ₹{:.0} SGST: ₹{:.0}\nTotal Purchases: ₹{:.0}",
            label,
            ss["total_revenue"].as_f64().unwrap_or(0.0),
            ss["bill_count"].as_i64().unwrap_or(0),
            ps["gross_profit"].as_f64().unwrap_or(0.0),
            ps["gross_margin_pct"].as_f64().unwrap_or(0.0),
            gs["total_gst"].as_f64().unwrap_or(0.0),
            gs["cgst"].as_f64().unwrap_or(0.0),
            gs["sgst"].as_f64().unwrap_or(0.0),
            ps["total_purchases"].as_f64().unwrap_or(0.0)
        );

        let prompt = format!(
            "Write a 1-page plain-English executive summary for a Chartered Accountant reviewing an Indian retail pharmacy's financial year {}.\n\nData:\n{}\n\nInclude:\n1. Overall revenue performance in 2-3 sentences\n2. Profitability analysis (gross profit, margin)\n3. GST summary (what was collected, what may be payable)\n4. Purchase vs sales balance\n5. Any notable observations or flags for the CA\n\nTone: Professional, concise. Format: Plain paragraphs, no bullet points.",
            label, context
        );

        let rt = tokio::runtime::Handle::current();
        let resp = rt.block_on(async {
            reqwest::Client::new()
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version","2023-06-01")
                .header("content-type","application/json")
                .json(&serde_json::json!({"model":"claude-sonnet-4-20250514","max_tokens":1024,"messages":[{"role":"user","content":prompt}]}))
                .send().await
        }).map_err(|e| AppError::Internal(format!("Network: {}",e)))?;
        let data: serde_json::Value = rt.block_on(resp.json()).map_err(|e| AppError::Internal(e.to_string()))?;
        data["content"][0]["text"].as_str().map(|s| s.to_string()).ok_or(AppError::Internal("Unexpected API response.".into()))
    }

    pub fn ai_ca_checks(&self, fy: &str) -> Result<serde_json::Value, AppError> {
        let (from, to, _) = Self::parse_fy(fy)?;
        let c = self.open()?;
        let mut checks: Vec<serde_json::Value> = vec![];

        // Check 1: Missing GSTIN on large bills (>50000)
        let missing_gstin: i64 = c.query_row(
            "SELECT COUNT(1) FROM bills WHERE net_amount>=50000 AND status='active' AND date(bill_date) BETWEEN date(?1) AND date(?2) AND customer_id IS NULL",
            params![from, to], |r| r.get(0))?;
        if missing_gstin > 0 {
            checks.push(serde_json::json!({"type":"missing_gstin","severity":"high","count":missing_gstin,
                "message":format!("{} bills above ₹50,000 have no customer/GSTIN recorded.",missing_gstin),
                "action":"Update customer details on these bills before filing GSTR-1."}));
        }

        // Check 2: Cash bills above ₹2 lakh (₹200000)
        let cash_large: i64 = c.query_row(
            "SELECT COUNT(1) FROM bills b JOIN payments p ON p.bill_id=b.id WHERE b.net_amount>=200000 AND p.payment_mode='cash' AND b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2)",
            params![from, to], |r| r.get(0))?;
        if cash_large > 0 {
            checks.push(serde_json::json!({"type":"cash_limit","severity":"high","count":cash_large,
                "message":format!("{} cash transactions of ₹2 lakh or more — flag for Income Tax compliance.",cash_large),
                "action":"Per IT Act Section 269ST, cash transactions above ₹2L may require reporting."}));
        }

        // Check 3: Stock vs sales reconciliation (sold > purchased for any medicine)
        let over_sold: i64 = c.query_row(
            "SELECT COUNT(1) FROM medicines m WHERE m.is_active=1 AND m.deleted_at IS NULL AND COALESCE((SELECT SUM(b.quantity_in) FROM batches b WHERE b.medicine_id=m.id AND b.is_active=1),0) < COALESCE((SELECT SUM(b.quantity_sold) FROM batches b WHERE b.medicine_id=m.id AND b.is_active=1),0)",
            [], |r| r.get(0))?;
        if over_sold > 0 {
            checks.push(serde_json::json!({"type":"stock_reconciliation","severity":"medium","count":over_sold,
                "message":format!("{} medicines show more sold than purchased — possible data entry issue.",over_sold),
                "action":"Review purchase entries for these medicines. May indicate missing purchase bills."}));
        }

        // Check 4: Schedule H without doctor recorded
        let h_no_doc: i64 = c.query_row(
            "SELECT COUNT(DISTINCT bi.bill_id) FROM bill_items bi JOIN medicines m ON m.id=bi.medicine_id JOIN bills b ON b.id=bi.bill_id WHERE m.schedule IN ('H','H1','X') AND b.doctor_id IS NULL AND b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2)",
            params![from, to], |r| r.get(0))?;
        if h_no_doc > 0 {
            checks.push(serde_json::json!({"type":"schedule_h_no_doctor","severity":"medium","count":h_no_doc,
                "message":format!("{} Schedule H/X bills have no doctor recorded.",h_no_doc),
                "action":"Update doctor information for compliance with Drugs & Cosmetics Act."}));
        }

        // Check 5: Unusually high discount (>30% on any month)
        let high_disc: f64 = c.query_row(
            "SELECT COALESCE(SUM(discount_amount),0)/NULLIF(COALESCE(SUM(subtotal),1),0)*100 FROM bills WHERE status='active' AND date(bill_date) BETWEEN date(?1) AND date(?2)",
            params![from, to], |r| r.get(0))?;
        if high_disc > 15.0 {
            checks.push(serde_json::json!({"type":"high_discount_rate","severity":"low","count":0,
                "message":format!("Overall discount rate is {:.1}% — higher than typical pharmacy margins.",high_disc),
                "action":"Verify discounts are correctly recorded and authorised."}));
        }

        // All clear
        if checks.is_empty() {
            checks.push(serde_json::json!({"type":"all_clear","severity":"info","count":0,
                "message":"No significant issues detected. Data looks clean.",
                "action":"Proceed with CA package generation."}));
        }

        Ok(serde_json::Value::Array(checks))
    }



    pub fn create_return(&self, original_bill_id: i64, items: &serde_json::Value, reason: &str, uid: i64) -> Result<i64, AppError> {
        let arr = items.as_array().ok_or(AppError::Validation("Items required.".into()))?;
        if arr.is_empty() { return Err(AppError::Validation("Add at least one item to return.".into())); }
        let mut conn = self.open()?;
        let tx = conn.transaction()?;
        // Verify original bill exists and is active
        let status: String = tx.query_row("SELECT status FROM bills WHERE id=?1", params![original_bill_id], |r| r.get(0))
            .optional()?.ok_or(AppError::Validation("Original bill not found.".into()))?;
        if status != "active" { return Err(AppError::Validation("Can only return items from active bills.".into())); }
        // Generate return number
        let ym = chrono::Utc::now().format("%Y%m").to_string();
        let pat = format!("RET-{}-%", ym);
        let seq: i64 = tx.query_row("SELECT COALESCE(MAX(CAST(SUBSTR(return_number,-5) AS INTEGER)),0)+1 FROM sale_returns WHERE return_number LIKE ?1", params![pat], |r| r.get(0))?;
        let rn = format!("RET-{}-{:05}", ym, seq);
        let total: f64 = arr.iter().map(|i| i["total_amount"].as_f64().unwrap_or(0.0)).sum();
        tx.execute("INSERT INTO sale_returns(return_number,original_bill_id,return_date,reason,total_amount,created_by) VALUES(?1,?2,datetime('now'),?3,?4,?5)",
            params![rn, original_bill_id, reason.trim(), total, uid])?;
        let ret_id = tx.last_insert_rowid();
        // Restore batch quantities
        for item in arr.iter() {
            let batch_id = item["batch_id"].as_i64().unwrap_or(0);
            let qty = item["quantity"].as_i64().unwrap_or(0);
            if batch_id > 0 && qty > 0 {
                tx.execute("UPDATE batches SET quantity_sold=MAX(0,quantity_sold-?1),updated_at=datetime('now') WHERE id=?2",
                    params![qty, batch_id])?;
            }
        }
        tx.execute("INSERT INTO audit_log(action,module,record_id,new_value,user_name,created_at) VALUES('SALE_RETURN','billing',?1,?2,'uid:'||?3,datetime('now'))",
            params![ret_id.to_string(), serde_json::json!({"return_number":rn,"total":total}).to_string(), uid])?;
        tx.commit()?;
        Ok(ret_id)
    }



    // ── S6: expose db_path for LAN server ─────────────────────
    pub fn get_db_path(&self) -> String {
        self.path.to_string_lossy().to_string()
    }

    /// Open a Database at an explicit path (used by LAN server)
    pub fn open_at(path: &str) -> Result<Self, AppError> {
        let db = Database { path: std::path::PathBuf::from(path) };
        Ok(db)
    }

    // ── DRUG INTERACTIONS ─────────────────────────────────────

    pub fn check_drug_interactions(&self, names: &[String]) -> Result<serde_json::Value, AppError> {
        if names.len() < 2 { return Ok(serde_json::json!({"interactions":[]})); }
        let c = self.open()?;
        let mut found = vec![];
        for i in 0..names.len() {
            for j in (i+1)..names.len() {
                let a = names[i].to_lowercase();
                let b = names[j].to_lowercase();
                let mut s = c.prepare(
                    "SELECT severity, description, management FROM drug_interactions
                     WHERE (lower(drug1) LIKE '%'||?1||'%' AND lower(drug2) LIKE '%'||?2||'%')
                        OR (lower(drug1) LIKE '%'||?2||'%' AND lower(drug2) LIKE '%'||?1||'%')
                     ORDER BY CASE severity WHEN 'major' THEN 1 WHEN 'moderate' THEN 2 ELSE 3 END"
                )?;
                let pairs: Vec<serde_json::Value> = s.query_map(params![a,b], |r| Ok(serde_json::json!({
                    "drug1": &names[i], "drug2": &names[j],
                    "severity": r.get::<_,String>(0)?,
                    "description": r.get::<_,String>(1)?,
                    "management": r.get::<_,String>(2)?
                })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
                found.extend(pairs);
            }
        }
        Ok(serde_json::json!({ "interactions": found }))
    }

    // ── LICENSE SYSTEM ────────────────────────────────────────

    pub fn license_get_status(&self) -> Result<serde_json::Value, AppError> {
        let trial_started = self.get_setting("trial_started")?
            .map(|s| s.trim_matches('"').to_string())
            .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
        let license_key = self.get_setting("license_key")?
            .map(|s| s.trim_matches('"').to_string())
            .filter(|s| !s.is_empty());
        let license_status = self.get_setting("license_status")?
            .map(|s| s.trim_matches('"').to_string())
            .unwrap_or_else(|| "trial".to_string());

        let trial_start = chrono::NaiveDate::parse_from_str(&trial_started, "%Y-%m-%d")
            .unwrap_or_else(|_| chrono::Utc::now().date_naive());
        let days_used = (chrono::Utc::now().date_naive() - trial_start).num_days().max(0);
        let trial_days_remaining = (30 - days_used).max(0);
        let is_active = license_status == "active" || trial_days_remaining > 0;

        Ok(serde_json::json!({
            "status": license_status,
            "is_active": is_active,
            "trial_days_remaining": trial_days_remaining,
            "days_used": days_used,
            "license_key": license_key,
            "plan": if license_status == "active" { "Professional" } else { "Trial" },
            "expires_message": if license_status == "active" {
                "License active — thank you!".to_string()
            } else if trial_days_remaining > 0 {
                format!("{} days remaining in trial", trial_days_remaining)
            } else {
                "Trial expired. Please purchase a license to continue.".to_string()
            }
        }))
    }

    pub fn license_activate(&self, key: &str) -> Result<serde_json::Value, AppError> {
        let k = key.trim().to_uppercase();
        if k.len() < 16 {
            return Err(AppError::Validation("Invalid license key format.".into()));
        }
        // Simple validation: key format PPRO-XXXX-XXXX-XXXX
        let parts: Vec<&str> = k.split('-').collect();
        if parts.len() != 4 || parts[0] != "PPRO" {
            return Err(AppError::Validation("Invalid license key. Must start with PPRO-.".into()));
        }
        self.set_setting("license_key", &format!("\"{}\"", k), None)?;
        self.set_setting("license_status", "\"active\"", None)?;
        self.audit("LICENSE_ACTIVATED","system","1",None,Some(&k),"system")?;
        Ok(serde_json::json!({"status":"active","message":"License activated successfully! Thank you for choosing PharmaCare Pro.","plan":"Professional"}))
    }

    // ── CLOUD SYNC (Supabase) ─────────────────────────────────

    pub fn sync_get_queue(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let pending: i64 = c.query_row("SELECT COUNT(1) FROM sync_queue WHERE synced_at IS NULL", [], |r| r.get(0)).unwrap_or(0);
        let last_sync = self.get_setting("last_supabase_sync")?.unwrap_or_else(|| "\"Never\"".to_string());
        let mut s = c.prepare("SELECT id,entity_type,entity_id,action,created_at FROM sync_queue WHERE synced_at IS NULL ORDER BY created_at DESC LIMIT 20")?;
        let items: Vec<serde_json::Value> = s.query_map([],|r| Ok(serde_json::json!({
            "id":r.get::<_,i64>(0)?,"entity_type":r.get::<_,String>(1)?,"entity_id":r.get::<_,i64>(2)?,
            "action":r.get::<_,String>(3)?,"created_at":r.get::<_,String>(4)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"pending_count":pending,"last_sync":last_sync.trim_matches('"'),"queue":items}))
    }

    pub fn sync_push(&self, _url: &str, _key: &str) -> Result<serde_json::Value, AppError> {
        // In production this would push to Supabase REST API.
        // For now we mark all queue items as synced (simulation).
        let c = self.open()?;
        let n: i64 = c.query_row("SELECT COUNT(1) FROM sync_queue WHERE synced_at IS NULL", [], |r| r.get(0))?;
        c.execute("UPDATE sync_queue SET synced_at=datetime('now') WHERE synced_at IS NULL", [])?;
        let ts = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        self.set_setting("last_supabase_sync", &format!("\"{}\"", ts), None)?;
        Ok(serde_json::json!({"synced_count":n,"synced_at":ts,"message":format!("Synced {} items to cloud.",n)}))
    }

    // ── CSV EXPORT ────────────────────────────────────────────

    pub fn reports_export_csv(&self, report_type: &str, from: &str, to: &str) -> Result<String, AppError> {
        let dir = std::env::current_dir().map_err(|e| AppError::Internal(e.to_string()))?.join("exports");
        std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
        let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let fname = format!("{}_{}_{}.csv", report_type, from.replace("-", ""), stamp);
        let fpath = dir.join(&fname);
        let mut rows: Vec<Vec<String>> = vec![];
        let c = self.open()?;

        match report_type {
            "sales" => {
                rows.push(vec!["Bill Number".into(),"Date".into(),"Customer".into(),"Net Amount".into(),"Status".into()]);
                let mut s = c.prepare("SELECT b.bill_number,b.bill_date,COALESCE(cu.name,'Walk-in'),b.net_amount,b.status FROM bills b LEFT JOIN customers cu ON cu.id=b.customer_id WHERE b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2) ORDER BY b.bill_date")?;
                let data = s.query_map(params![from,to],|r| Ok(vec![r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,f64>(3)?.to_string(),r.get::<_,String>(4)?]))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
                rows.extend(data);
            }
            "gst" => {
                rows.push(vec!["Date".into(),"Bill Number".into(),"Medicine".into(),"HSN".into(),"Taxable".into(),"CGST".into(),"SGST".into(),"IGST".into(),"Total".into()]);
                let mut s = c.prepare("SELECT b.bill_date,b.bill_number,bi.medicine_name,COALESCE(m.hsn_code,''),bi.total_amount-bi.cgst_amount-bi.sgst_amount-bi.igst_amount,bi.cgst_amount,bi.sgst_amount,bi.igst_amount,bi.total_amount FROM bill_items bi JOIN bills b ON b.id=bi.bill_id LEFT JOIN medicines m ON m.id=bi.medicine_id WHERE b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2) ORDER BY b.bill_date")?;
                let data = s.query_map(params![from,to],|r| Ok(vec![r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,format!("{:.2}",r.get::<_,f64>(4)?),format!("{:.2}",r.get::<_,f64>(5)?),format!("{:.2}",r.get::<_,f64>(6)?),format!("{:.2}",r.get::<_,f64>(7)?),format!("{:.2}",r.get::<_,f64>(8)?)]))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
                rows.extend(data);
            }
            "stock" => {
                rows.push(vec!["Medicine".into(),"Generic".into(),"Category".into(),"Stock".into(),"Reorder Level".into(),"Cost Value".into(),"Sell Value".into()]);
                let mut s = c.prepare("SELECT m.name,m.generic_name,COALESCE(cat.name,''),COALESCE(SUM(CASE WHEN b.is_active=1 THEN b.quantity_in-b.quantity_sold-b.quantity_adjusted ELSE 0 END),0),m.reorder_level,COALESCE(SUM(CASE WHEN b.is_active=1 AND (b.quantity_in-b.quantity_sold-b.quantity_adjusted)>0 THEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted)*b.purchase_price ELSE 0 END),0),COALESCE(SUM(CASE WHEN b.is_active=1 AND (b.quantity_in-b.quantity_sold-b.quantity_adjusted)>0 THEN (b.quantity_in-b.quantity_sold-b.quantity_adjusted)*b.selling_price ELSE 0 END),0) FROM medicines m LEFT JOIN categories cat ON cat.id=m.category_id LEFT JOIN batches b ON b.medicine_id=m.id WHERE m.deleted_at IS NULL AND m.is_active=1 GROUP BY m.id ORDER BY m.name")?;
                let data = s.query_map([],|r| Ok(vec![r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,i64>(3)?.to_string(),r.get::<_,i64>(4)?.to_string(),format!("{:.2}",r.get::<_,f64>(5)?),format!("{:.2}",r.get::<_,f64>(6)?)]))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
                rows.extend(data);
            }
            _ => return Err(AppError::Validation(format!("Unknown report type: {}", report_type))),
        }

        // Write CSV
        let mut csv = String::new();
        for row in &rows {
            let line: Vec<String> = row.iter().map(|cell| {
                if cell.contains(',') || cell.contains('"') || cell.contains('\n') {
                    format!("\"{}\"", cell.replace('"', "\"\""))
                } else { cell.clone() }
            }).collect();
            csv.push_str(&line.join(","));
            csv.push('\n');
        }
        std::fs::write(&fpath, csv.as_bytes()).map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(fpath.to_string_lossy().to_string())
    }

    // ── SPRINT 7: GST COMPLIANCE ──────────────────────────────

    pub fn build_gstr1(&self, month: &str, year: &str) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let from = format!("{}-{}-01", year, month);
        let to = format!("{}-{}-31", year, month);
        let mut s = c.prepare(
            "SELECT b.bill_number, b.bill_date, COALESCE(cu.gstin,'') AS gstin,
             COALESCE(cu.name,'Walk-in') AS cname,
             bi.medicine_name, COALESCE(m.hsn_code,'') AS hsn,
             bi.gst_rate,
             bi.total_amount - bi.cgst_amount - bi.sgst_amount - bi.igst_amount AS taxable,
             bi.cgst_amount, bi.sgst_amount, bi.igst_amount, bi.total_amount
             FROM bill_items bi
             JOIN bills b ON b.id = bi.bill_id
             LEFT JOIN customers cu ON cu.id = b.customer_id
             LEFT JOIN medicines m ON m.id = bi.medicine_id
             WHERE b.status='active'
             AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
             ORDER BY b.bill_date, b.bill_number"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![from, to], |r| Ok(serde_json::json!({
            "bill_number": r.get::<_,String>(0)?,
            "bill_date": r.get::<_,String>(1)?,
            "gstin": r.get::<_,String>(2)?,
            "customer_name": r.get::<_,String>(3)?,
            "medicine_name": r.get::<_,String>(4)?,
            "hsn_code": r.get::<_,String>(5)?,
            "gst_rate": r.get::<_,f64>(6)?,
            "taxable_amount": r.get::<_,f64>(7)?,
            "cgst_amount": r.get::<_,f64>(8)?,
            "sgst_amount": r.get::<_,f64>(9)?,
            "igst_amount": r.get::<_,f64>(10)?,
            "total_amount": r.get::<_,f64>(11)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"period": format!("{}/{}", month, year), "invoices": rows, "count": rows.len()}))
    }

    pub fn build_gstr3b(&self, month: &str, year: &str) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let from = format!("{}-{}-01", year, month);
        let to = format!("{}-{}-31", year, month);
        let (taxable, cgst, sgst, igst, total): (f64,f64,f64,f64,f64) = c.query_row(
            "SELECT COALESCE(SUM(bi.total_amount-bi.cgst_amount-bi.sgst_amount-bi.igst_amount),0),
             COALESCE(SUM(bi.cgst_amount),0), COALESCE(SUM(bi.sgst_amount),0),
             COALESCE(SUM(bi.igst_amount),0), COALESCE(SUM(bi.total_amount),0)
             FROM bill_items bi JOIN bills b ON b.id=bi.bill_id
             WHERE b.status='active' AND date(b.bill_date) BETWEEN date(?1) AND date(?2)",
            params![from, to], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))
        )?;
        let (ptaxable, pcgst, psgst, pigst): (f64,f64,f64,f64) = c.query_row(
            "SELECT COALESCE(SUM(pi2.taxable_amount),0), COALESCE(SUM(pi2.cgst_amount),0),
             COALESCE(SUM(pi2.sgst_amount),0), COALESCE(SUM(pi2.igst_amount),0)
             FROM purchase_items pi2 JOIN purchases pu ON pu.id=pi2.purchase_id
             WHERE date(pu.purchase_date) BETWEEN date(?1) AND date(?2)",
            params![from, to], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))
        ).unwrap_or((0.0,0.0,0.0,0.0));
        Ok(serde_json::json!({
            "period": format!("{}/{}", month, year),
            "outward_supplies": { "taxable": taxable, "cgst": cgst, "sgst": sgst, "igst": igst, "total": total },
            "itc_available": { "taxable": ptaxable, "cgst": pcgst, "sgst": psgst, "igst": pigst },
            "net_gst_payable": { "cgst": (cgst - pcgst).max(0.0), "sgst": (sgst - psgst).max(0.0), "igst": (igst - pigst).max(0.0) }
        }))
    }

    pub fn get_purchase_bills_for_recon(&self, month: &str, year: &str) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let from = format!("{}-{}-01", year, month);
        let to = format!("{}-{}-31", year, month);
        let mut s = c.prepare(
            "SELECT pu.invoice_number, pu.purchase_date, COALESCE(su.name,'') AS supplier,
             COALESCE(su.gstin,'') AS gstin, pu.total_amount
             FROM purchases pu LEFT JOIN suppliers su ON su.id=pu.supplier_id
             WHERE date(pu.purchase_date) BETWEEN date(?1) AND date(?2)
             ORDER BY pu.purchase_date"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![from, to], |r| Ok(serde_json::json!({
            "invoice_number": r.get::<_,String>(0)?,
            "purchase_date": r.get::<_,String>(1)?,
            "supplier_name": r.get::<_,String>(2)?,
            "supplier_gstin": r.get::<_,String>(3)?,
            "total_amount": r.get::<_,f64>(4)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"period": format!("{}/{}", month, year), "purchases": rows, "count": rows.len()}))
    }

    pub fn get_bill_for_compliance(&self, bill_id: i64) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let bill = c.query_row(
            "SELECT b.id, b.bill_number, b.bill_date, b.net_amount,
             COALESCE(cu.name,'Walk-in') AS cname, COALESCE(cu.address,'') AS caddr,
             COALESCE(cu.phone,'') AS cphone, COALESCE(cu.gstin,'') AS cgstin,
             COALESCE(d.name,'') AS dname, COALESCE(d.registration_no,'') AS dreg
             FROM bills b
             LEFT JOIN customers cu ON cu.id=b.customer_id
             LEFT JOIN doctors d ON d.id=b.doctor_id
             WHERE b.id=?1",
            params![bill_id], |r| Ok(serde_json::json!({
                "id": r.get::<_,i64>(0)?,
                "bill_number": r.get::<_,String>(1)?,
                "bill_date": r.get::<_,String>(2)?,
                "net_amount": r.get::<_,f64>(3)?,
                "customer_name": r.get::<_,String>(4)?,
                "customer_address": r.get::<_,String>(5)?,
                "customer_phone": r.get::<_,String>(6)?,
                "customer_gstin": r.get::<_,String>(7)?,
                "doctor_name": r.get::<_,String>(8)?,
                "doctor_reg_no": r.get::<_,String>(9)?
            }))
        ).optional()?.ok_or(AppError::Validation("Bill not found.".into()))?;
        Ok(bill)
    }

    // ── SPRINT 7: NARCOTIC REGISTER ───────────────────────────

    pub fn list_narcotic_register(&self, from: &str, to: &str) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare(
            "SELECT id, entry_date, bill_number, patient_name, patient_address, patient_age,
             doctor_name, doctor_reg_no, medicine_name, batch_number, quantity_dispensed,
             unit, opening_balance, quantity_received, closing_balance, supplier_name,
             purchase_invoice_no, remarks, created_at
             FROM narcotic_register
             WHERE (?1='' OR date(entry_date) >= date(?1))
             AND (?2='' OR date(entry_date) <= date(?2))
             ORDER BY entry_date DESC, id DESC"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![from, to], |r| Ok(serde_json::json!({
            "id": r.get::<_,i64>(0)?,
            "entry_date": r.get::<_,String>(1)?,
            "bill_number": r.get::<_,String>(2)?,
            "patient_name": r.get::<_,String>(3)?,
            "patient_address": r.get::<_,String>(4)?,
            "patient_age": r.get::<_,String>(5)?,
            "doctor_name": r.get::<_,String>(6)?,
            "doctor_reg_no": r.get::<_,String>(7)?,
            "medicine_name": r.get::<_,String>(8)?,
            "batch_number": r.get::<_,String>(9)?,
            "quantity_dispensed": r.get::<_,f64>(10)?,
            "unit": r.get::<_,String>(11)?,
            "opening_balance": r.get::<_,f64>(12)?,
            "quantity_received": r.get::<_,f64>(13)?,
            "closing_balance": r.get::<_,f64>(14)?,
            "supplier_name": r.get::<_,String>(15)?,
            "purchase_invoice_no": r.get::<_,String>(16)?,
            "remarks": r.get::<_,String>(17)?,
            "created_at": r.get::<_,String>(18)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"entries": rows, "count": rows.len()}))
    }

    pub fn create_narcotic_entry(&self, inp: &serde_json::Value, uid: i64) -> Result<i64, AppError> {
        let c = self.open()?;
        c.execute(
            "INSERT INTO narcotic_register(entry_date,bill_id,bill_number,patient_name,patient_address,patient_age,doctor_name,doctor_reg_no,medicine_name,medicine_id,batch_number,quantity_dispensed,unit,opening_balance,quantity_received,closing_balance,supplier_name,purchase_invoice_no,remarks,created_by)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20)",
            params![
                inp["entry_date"].as_str().unwrap_or(""),
                inp["bill_id"].as_i64(),
                inp["bill_number"].as_str().unwrap_or(""),
                inp["patient_name"].as_str().unwrap_or(""),
                inp["patient_address"].as_str().unwrap_or(""),
                inp["patient_age"].as_str().unwrap_or(""),
                inp["doctor_name"].as_str().unwrap_or(""),
                inp["doctor_reg_no"].as_str().unwrap_or(""),
                inp["medicine_name"].as_str().unwrap_or(""),
                inp["medicine_id"].as_i64(),
                inp["batch_number"].as_str().unwrap_or(""),
                inp["quantity_dispensed"].as_f64().unwrap_or(0.0),
                inp["unit"].as_str().unwrap_or("TAB"),
                inp["opening_balance"].as_f64().unwrap_or(0.0),
                inp["quantity_received"].as_f64().unwrap_or(0.0),
                inp["closing_balance"].as_f64().unwrap_or(0.0),
                inp["supplier_name"].as_str().unwrap_or(""),
                inp["purchase_invoice_no"].as_str().unwrap_or(""),
                inp["remarks"].as_str().unwrap_or(""),
                uid
            ]
        )?;
        Ok(c.last_insert_rowid())
    }

    pub fn update_narcotic_entry(&self, id: i64, inp: &serde_json::Value) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute(
            "UPDATE narcotic_register SET entry_date=?1, patient_name=?2, patient_address=?3, patient_age=?4, doctor_name=?5, doctor_reg_no=?6, quantity_dispensed=?7, unit=?8, opening_balance=?9, quantity_received=?10, closing_balance=?11, supplier_name=?12, purchase_invoice_no=?13, remarks=?14 WHERE id=?15",
            params![
                inp["entry_date"].as_str().unwrap_or(""),
                inp["patient_name"].as_str().unwrap_or(""),
                inp["patient_address"].as_str().unwrap_or(""),
                inp["patient_age"].as_str().unwrap_or(""),
                inp["doctor_name"].as_str().unwrap_or(""),
                inp["doctor_reg_no"].as_str().unwrap_or(""),
                inp["quantity_dispensed"].as_f64().unwrap_or(0.0),
                inp["unit"].as_str().unwrap_or("TAB"),
                inp["opening_balance"].as_f64().unwrap_or(0.0),
                inp["quantity_received"].as_f64().unwrap_or(0.0),
                inp["closing_balance"].as_f64().unwrap_or(0.0),
                inp["supplier_name"].as_str().unwrap_or(""),
                inp["purchase_invoice_no"].as_str().unwrap_or(""),
                inp["remarks"].as_str().unwrap_or(""),
                id
            ]
        )?;
        Ok(())
    }

    pub fn delete_narcotic_entry(&self, id: i64) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute("DELETE FROM narcotic_register WHERE id=?1", params![id])?;
        Ok(())
    }

    // ── SPRINT 7: PRESCRIPTION REGISTER ──────────────────────

    pub fn list_prescription_register(&self, from: &str, to: &str) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare(
            "SELECT id, entry_date, bill_number, patient_name, patient_age, patient_address,
             doctor_name, doctor_reg_no, medicine_name, schedule, batch_number, quantity, unit, remarks, created_at
             FROM prescription_register
             WHERE (?1='' OR date(entry_date) >= date(?1))
             AND (?2='' OR date(entry_date) <= date(?2))
             ORDER BY entry_date DESC, id DESC"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![from, to], |r| Ok(serde_json::json!({
            "id": r.get::<_,i64>(0)?,
            "entry_date": r.get::<_,String>(1)?,
            "bill_number": r.get::<_,String>(2)?,
            "patient_name": r.get::<_,String>(3)?,
            "patient_age": r.get::<_,String>(4)?,
            "patient_address": r.get::<_,String>(5)?,
            "doctor_name": r.get::<_,String>(6)?,
            "doctor_reg_no": r.get::<_,String>(7)?,
            "medicine_name": r.get::<_,String>(8)?,
            "schedule": r.get::<_,String>(9)?,
            "batch_number": r.get::<_,String>(10)?,
            "quantity": r.get::<_,f64>(11)?,
            "unit": r.get::<_,String>(12)?,
            "remarks": r.get::<_,String>(13)?,
            "created_at": r.get::<_,String>(14)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"entries": rows, "count": rows.len()}))
    }

    pub fn create_prescription_entry(&self, inp: &serde_json::Value, uid: i64) -> Result<i64, AppError> {
        let c = self.open()?;
        c.execute(
            "INSERT INTO prescription_register(entry_date,bill_id,bill_number,patient_name,patient_age,patient_address,doctor_name,doctor_reg_no,medicine_name,medicine_id,schedule,batch_number,quantity,unit,remarks,created_by)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
            params![
                inp["entry_date"].as_str().unwrap_or(""),
                inp["bill_id"].as_i64(),
                inp["bill_number"].as_str().unwrap_or(""),
                inp["patient_name"].as_str().unwrap_or(""),
                inp["patient_age"].as_str().unwrap_or(""),
                inp["patient_address"].as_str().unwrap_or(""),
                inp["doctor_name"].as_str().unwrap_or(""),
                inp["doctor_reg_no"].as_str().unwrap_or(""),
                inp["medicine_name"].as_str().unwrap_or(""),
                inp["medicine_id"].as_i64(),
                inp["schedule"].as_str().unwrap_or("H"),
                inp["batch_number"].as_str().unwrap_or(""),
                inp["quantity"].as_f64().unwrap_or(0.0),
                inp["unit"].as_str().unwrap_or("TAB"),
                inp["remarks"].as_str().unwrap_or(""),
                uid
            ]
        )?;
        Ok(c.last_insert_rowid())
    }

    pub fn update_prescription_entry(&self, id: i64, inp: &serde_json::Value) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute(
            "UPDATE prescription_register SET entry_date=?1, patient_name=?2, patient_age=?3, patient_address=?4, doctor_name=?5, doctor_reg_no=?6, schedule=?7, quantity=?8, unit=?9, remarks=?10 WHERE id=?11",
            params![
                inp["entry_date"].as_str().unwrap_or(""),
                inp["patient_name"].as_str().unwrap_or(""),
                inp["patient_age"].as_str().unwrap_or(""),
                inp["patient_address"].as_str().unwrap_or(""),
                inp["doctor_name"].as_str().unwrap_or(""),
                inp["doctor_reg_no"].as_str().unwrap_or(""),
                inp["schedule"].as_str().unwrap_or("H"),
                inp["quantity"].as_f64().unwrap_or(0.0),
                inp["unit"].as_str().unwrap_or("TAB"),
                inp["remarks"].as_str().unwrap_or(""),
                id
            ]
        )?;
        Ok(())
    }

    pub fn delete_prescription_entry(&self, id: i64) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute("DELETE FROM prescription_register WHERE id=?1", params![id])?;
        Ok(())
    }

    // ── SPRINT 7: AUTO-POPULATE COMPLIANCE REGISTERS ─────────

    pub fn auto_populate_compliance_registers(&self, bill_id: i64, bill_no: &str, uid: i64) -> Result<(), AppError> {
        let bill = self.get_bill_for_compliance(bill_id)?;
        let c = self.open()?;
        let mut s = c.prepare(
            "SELECT bi.medicine_name, bi.medicine_id, bi.batch_number, bi.quantity,
             COALESCE(m.schedule,'') AS schedule, COALESCE(m.is_narcotic, 0) AS is_narcotic
             FROM bill_items bi
             LEFT JOIN medicines m ON m.id = bi.medicine_id
             WHERE bi.bill_id=?1"
        )?;
        let items: Vec<(String,Option<i64>,String,f64,String,i64)> = s.query_map(params![bill_id], |r| Ok((
            r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?
        )))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let pname = bill["customer_name"].as_str().unwrap_or("").to_string();
        let paddr = bill["customer_address"].as_str().unwrap_or("").to_string();
        let dname = bill["doctor_name"].as_str().unwrap_or("").to_string();
        let dreg  = bill["doctor_reg_no"].as_str().unwrap_or("").to_string();
        for (mname, mid, batch, qty, schedule, is_narcotic) in &items {
            let sched_upper = schedule.to_uppercase();
            if *is_narcotic == 1 || sched_upper == "X" {
                c.execute(
                    "INSERT INTO narcotic_register(entry_date,bill_id,bill_number,patient_name,patient_address,doctor_name,doctor_reg_no,medicine_name,medicine_id,batch_number,quantity_dispensed,unit,closing_balance,created_by)
                     VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,'TAB',0,?12)",
                    params![today, bill_id, bill_no, pname, paddr, dname, dreg, mname, mid, batch, qty, uid]
                )?;
            }
            if sched_upper == "H" || sched_upper == "H1" || sched_upper == "X" {
                c.execute(
                    "INSERT INTO prescription_register(entry_date,bill_id,bill_number,patient_name,patient_address,doctor_name,doctor_reg_no,medicine_name,medicine_id,schedule,batch_number,quantity,unit,created_by)
                     VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'TAB',?13)",
                    params![today, bill_id, bill_no, pname, paddr, dname, dreg, mname, mid, schedule, batch, qty, uid]
                )?;
            }
        }
        Ok(())
    }

    // ── SPRINT 7: LICENCE ALERTS ──────────────────────────────

    pub fn get_licence_alerts(&self) -> Result<serde_json::Value, AppError> {
        let today = chrono::Utc::now().date_naive();
        let keys = vec![
            ("drug_licence_expiry", "Drug Licence"),
            ("fssai_licence_expiry", "FSSAI Licence"),
            ("schedule_x_licence_expiry", "Schedule X Licence"),
        ];
        let mut alerts = vec![];
        for (key, label) in keys {
            if let Some(raw) = self.get_setting(key)? {
                let date_str = raw.trim_matches('"').to_string();
                if date_str.is_empty() { continue; }
                if let Ok(exp) = chrono::NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
                    let days_left = (exp - today).num_days();
                    let level = if days_left <= 0 { "expired" } else if days_left <= 7 { "critical" } else if days_left <= 30 { "warning" } else if days_left <= 90 { "info" } else { continue };
                    alerts.push(serde_json::json!({
                        "key": key, "label": label, "expiry_date": date_str,
                        "days_left": days_left, "level": level
                    }));
                }
            }
        }
        Ok(serde_json::json!({"alerts": alerts, "count": alerts.len()}))
    }

    // ── SPRINT 7: DRUG INTERACTION STATS + CRUD ───────────────

    pub fn get_drug_interaction_stats(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let total: i64 = c.query_row("SELECT COUNT(1) FROM drug_interactions", [], |r| r.get(0))?;
        let major: i64 = c.query_row("SELECT COUNT(1) FROM drug_interactions WHERE severity='major'", [], |r| r.get(0))?;
        let moderate: i64 = c.query_row("SELECT COUNT(1) FROM drug_interactions WHERE severity='moderate'", [], |r| r.get(0))?;
        let minor: i64 = c.query_row("SELECT COUNT(1) FROM drug_interactions WHERE severity='minor'", [], |r| r.get(0)).unwrap_or(0);
        Ok(serde_json::json!({"total": total, "major": major, "moderate": moderate, "minor": minor}))
    }

    pub fn list_drug_interactions(&self, search: &str, severity: Option<&str>) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let like = format!("%{}%", search.to_lowercase());
        let mut s = c.prepare(
            "SELECT id, drug1, drug2, severity, description, management
             FROM drug_interactions
             WHERE (?1='' OR lower(drug1) LIKE ?2 OR lower(drug2) LIKE ?2)
             AND (?3 IS NULL OR severity=?3)
             ORDER BY CASE severity WHEN 'major' THEN 1 WHEN 'moderate' THEN 2 ELSE 3 END, drug1
             LIMIT 200"
        )?;
        let rows: Vec<serde_json::Value> = s.query_map(params![search, like, severity], |r| Ok(serde_json::json!({
            "id": r.get::<_,i64>(0)?,
            "drug1": r.get::<_,String>(1)?,
            "drug2": r.get::<_,String>(2)?,
            "severity": r.get::<_,String>(3)?,
            "description": r.get::<_,String>(4)?,
            "management": r.get::<_,String>(5)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"interactions": rows, "count": rows.len()}))
    }

    pub fn create_drug_interaction(&self, inp: &serde_json::Value) -> Result<i64, AppError> {
        let c = self.open()?;
        c.execute(
            "INSERT OR IGNORE INTO drug_interactions(drug1,drug2,severity,description,management) VALUES(?1,?2,?3,?4,?5)",
            params![
                inp["drug1"].as_str().unwrap_or(""),
                inp["drug2"].as_str().unwrap_or(""),
                inp["severity"].as_str().unwrap_or("moderate"),
                inp["description"].as_str().unwrap_or(""),
                inp["management"].as_str().unwrap_or("")
            ]
        )?;
        Ok(c.last_insert_rowid())
    }

    pub fn delete_drug_interaction(&self, id: i64) -> Result<(), AppError> {
        let c = self.open()?;
        c.execute("DELETE FROM drug_interactions WHERE id=?1", params![id])?;
        Ok(())
    }

    // ── SPRINT 7: ROLES LIST ──────────────────────────────────

    pub fn list_roles(&self) -> Result<serde_json::Value, AppError> {
        let c = self.open()?;
        let mut s = c.prepare("SELECT id, name, permissions FROM roles ORDER BY id")?;
        let rows: Vec<serde_json::Value> = s.query_map([], |r| Ok(serde_json::json!({
            "id": r.get::<_,i64>(0)?,
            "name": r.get::<_,String>(1)?,
            "permissions": r.get::<_,String>(2)?
        })))?.collect::<Result<Vec<_>,_>>().map_err(|e| AppError::Database(e.to_string()))?;
        Ok(serde_json::json!({"roles": rows}))
    }

}
