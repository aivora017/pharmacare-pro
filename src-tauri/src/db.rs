use crate::commands::auth::UserDto;
use crate::commands::billing::CreateBillInput;
use crate::commands::customer::DoctorCreateInput;
use crate::commands::medicine::{BatchDto, CategoryDto, MedicineDetailDto, MedicineDto};
use crate::commands::purchase::PurchaseBillCreateInput;
use crate::commands::purchase::PurchaseOrderCreateInput;
use crate::commands::purchase::SupplierInput;
use crate::error::AppError;
use bcrypt::{hash, DEFAULT_COST};
use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;
use tauri::AppHandle;

const INITIAL_MIGRATION_SQL: &str = include_str!("../../src/db/migrations/001_initial.sql");

#[derive(Clone, Debug)]
pub struct UserRecord {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub role_id: i64,
    pub password_hash: String,
    pub is_active: bool,
    pub last_login_at: Option<String>,
    pub login_attempts: i64,
    pub locked_until: Option<String>,
}

#[derive(Clone, Debug)]
pub struct RoleRecord {
    pub name: String,
    pub permissions: String,
}

#[derive(Clone, Debug)]
pub struct SessionRecord {
    pub revoked_at: Option<String>,
}

#[derive(Default)]
pub struct Database {
    db_path: PathBuf,
}

impl Database {
    pub fn init(_app: &AppHandle) -> Result<Self, AppError> {
        let db_path = std::env::current_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .join("pharmacare_pro.db");

        let db = Self { db_path };
        let conn = db.connection()?;
        db.run_migrations(&conn)?;
        db.seed_default_user_if_needed(&conn)?;
        Ok(db)
    }

    pub fn get_user_by_email(&self, email: &str) -> Result<UserRecord, AppError> {
        let identifier = email.trim().to_lowercase();
        let conn = self.connection()?;

        conn.query_row(
            "SELECT id, name, email, phone, role_id, password_hash, is_active, last_login_at, login_attempts, locked_until
             FROM users
             WHERE lower(email) = ?1 OR lower(name) = ?1",
            params![identifier],
            |row| {
                Ok(UserRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    role_id: row.get(4)?,
                    password_hash: row.get(5)?,
                    is_active: row.get::<_, i64>(6)? == 1,
                    last_login_at: row.get(7)?,
                    login_attempts: row.get(8)?,
                    locked_until: row.get(9)?,
                })
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or(AppError::InvalidCredentials)
    }

    pub fn update_login_attempts(
        &self,
        user_id: i64,
        attempts: i64,
        locked_until: Option<&str>,
    ) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE users SET login_attempts = ?1, locked_until = ?2 WHERE id = ?3",
            params![attempts, locked_until, user_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn write_audit_log(
        &self,
        action: &str,
        entity: &str,
        entity_id: &str,
        old_value: Option<&str>,
        new_value: Option<&str>,
        actor_name: &str,
    ) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO audit_log (action, module, record_id, old_value, new_value, user_name, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                action,
                entity,
                entity_id,
                old_value,
                new_value,
                actor_name,
                chrono::Utc::now().to_rfc3339()
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn reset_login_attempts(&self, user_id: i64) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE users SET login_attempts = 0, locked_until = NULL, last_login_at = ?1 WHERE id = ?2",
            params![chrono::Utc::now().to_rfc3339(), user_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn get_role(&self, role_id: i64) -> Result<RoleRecord, AppError> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT name, permissions FROM roles WHERE id = ?1",
            params![role_id],
            |row| {
                Ok(RoleRecord {
                    name: row.get(0)?,
                    permissions: row.get(1)?,
                })
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or(AppError::Validation("Role not found.".to_string()))
    }

    pub fn create_session(&self, session_id: &str, user_id: i64) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO sessions (id, user_id, created_at, expires_at, revoked_at)
             VALUES (?1, ?2, ?3, ?4, NULL)
             ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, revoked_at=NULL",
            params![
                session_id,
                user_id,
                chrono::Utc::now().to_rfc3339(),
                (chrono::Utc::now() + chrono::Duration::hours(8)).to_rfc3339(),
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn revoke_session(&self, session_id: &str) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE sessions SET revoked_at = ?1 WHERE id = ?2",
            params![chrono::Utc::now().to_rfc3339(), session_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn get_session(&self, session_id: &str) -> Result<SessionRecord, AppError> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT revoked_at FROM sessions WHERE id = ?1",
            params![session_id],
            |row| {
                Ok(SessionRecord {
                    revoked_at: row.get(0)?,
                })
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or(AppError::Validation("Session not found.".to_string()))
    }

    pub fn get_user(&self, user_id: i64) -> Result<UserRecord, AppError> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT id, name, email, phone, role_id, password_hash, is_active, last_login_at, login_attempts, locked_until
             FROM users WHERE id = ?1",
            params![user_id],
            |row| {
                Ok(UserRecord {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    email: row.get(2)?,
                    phone: row.get(3)?,
                    role_id: row.get(4)?,
                    password_hash: row.get(5)?,
                    is_active: row.get::<_, i64>(6)? == 1,
                    last_login_at: row.get(7)?,
                    login_attempts: row.get(8)?,
                    locked_until: row.get(9)?,
                })
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or(AppError::Validation("User not found.".to_string()))
    }

    pub fn create_bill(&self, input: &CreateBillInput) -> Result<i64, AppError> {
        if input.items.is_empty() {
            return Err(AppError::Validation("Bill must contain at least one item.".to_string()));
        }

        if input.payments.is_empty() {
            return Err(AppError::Validation("At least one payment entry is required.".to_string()));
        }

        let mut conn = self.connection()?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        for item in &input.items {
            let available: i64 = tx
                .query_row(
                    "SELECT quantity_in - quantity_sold - quantity_adjusted FROM batches WHERE id = ?1",
                    params![item.batch_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| AppError::Internal(e.to_string()))?
                .ok_or_else(|| AppError::Validation(format!("Batch not found: {}", item.batch_id)))?;

            if available < item.quantity {
                return Err(AppError::Validation(format!(
                    "Insufficient stock for {} (available {}, requested {}).",
                    item.medicine_name, available, item.quantity
                )));
            }
        }

        let month_key = chrono::Utc::now().format("%Y%m").to_string();
        let pattern = format!("POS-{}-%", month_key);
        let next_seq: i64 = tx
            .query_row(
                "SELECT COALESCE(MAX(CAST(SUBSTR(bill_number, -5) AS INTEGER)), 0) + 1
                 FROM bills
                 WHERE bill_number LIKE ?1",
                params![pattern],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let bill_number = format!("POS-{}-{:05}", month_key, next_seq);

        let subtotal = input
            .items
            .iter()
            .map(|item| item.unit_price * item.quantity as f64)
            .sum::<f64>();
        let item_discount = input.items.iter().map(|item| item.discount_amount).sum::<f64>();
        let discount_amount = input.discount_amount.unwrap_or(0.0);
        let taxable_amount = subtotal - item_discount - discount_amount;
        let cgst_amount = input.items.iter().map(|item| item.cgst_amount).sum::<f64>();
        let sgst_amount = input.items.iter().map(|item| item.sgst_amount).sum::<f64>();
        let igst_amount = input.items.iter().map(|item| item.igst_amount).sum::<f64>();
        let total_amount = input.items.iter().map(|item| item.total_amount).sum::<f64>();
        let round_off = (total_amount.round() * 100.0 - total_amount * 100.0).round() / 100.0;
        let net_amount = total_amount + round_off;

        let amount_paid = input.payments.iter().map(|payment| payment.amount).sum::<f64>();
        let change_returned = if amount_paid > net_amount {
            amount_paid - net_amount
        } else {
            0.0
        };
        let outstanding = if net_amount > amount_paid {
            net_amount - amount_paid
        } else {
            0.0
        };

        let loyalty_points_earned = if input.customer_id.is_some() {
            (net_amount / 100.0).floor() as i64
        } else {
            0
        };

        tx.execute(
            "INSERT INTO bills (
                bill_number, customer_id, doctor_id, bill_date, status, prescription_ref,
                subtotal, discount_amount, taxable_amount,
                cgst_amount, sgst_amount, igst_amount,
                total_amount, round_off, net_amount,
                amount_paid, change_returned, outstanding,
                loyalty_points_earned, notes, created_by
             ) VALUES (
                ?1, ?2, ?3, datetime('now'), 'active', ?4,
                ?5, ?6, ?7,
                ?8, ?9, ?10,
                ?11, ?12, ?13,
                ?14, ?15, ?16,
                ?17, ?18, ?19
             )",
            params![
                bill_number,
                input.customer_id,
                input.doctor_id,
                input.prescription_ref,
                subtotal,
                discount_amount,
                taxable_amount,
                cgst_amount,
                sgst_amount,
                igst_amount,
                total_amount,
                round_off,
                net_amount,
                amount_paid,
                change_returned,
                outstanding,
                loyalty_points_earned,
                input.notes,
                input.created_by,
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let bill_id = tx.last_insert_rowid();

        for item in &input.items {
            tx.execute(
                "INSERT INTO bill_items (
                    bill_id, medicine_id, batch_id, medicine_name, batch_number, expiry_date,
                    quantity, unit_price, mrp,
                    discount_percent, discount_amount, gst_rate,
                    cgst_amount, sgst_amount, igst_amount, total_amount
                 ) VALUES (
                    ?1, ?2, ?3, ?4, ?5, ?6,
                    ?7, ?8, ?9,
                    ?10, ?11, ?12,
                    ?13, ?14, ?15, ?16
                 )",
                params![
                    bill_id,
                    item.medicine_id,
                    item.batch_id,
                    item.medicine_name,
                    item.batch_number,
                    item.expiry_date,
                    item.quantity,
                    item.unit_price,
                    item.mrp,
                    item.discount_percent,
                    item.discount_amount,
                    item.gst_rate,
                    item.cgst_amount,
                    item.sgst_amount,
                    item.igst_amount,
                    item.total_amount,
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

            tx.execute(
                "UPDATE batches
                 SET quantity_sold = quantity_sold + ?1, updated_at = datetime('now')
                 WHERE id = ?2",
                params![item.quantity, item.batch_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        for payment in &input.payments {
            tx.execute(
                "INSERT INTO payments (bill_id, amount, payment_mode, reference_no, created_by)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    bill_id,
                    payment.amount,
                    payment.payment_mode,
                    payment.reference_no,
                    input.created_by,
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        if let Some(customer_id) = input.customer_id {
            tx.execute(
                "UPDATE customers
                 SET outstanding_balance = outstanding_balance + ?1,
                     loyalty_points = loyalty_points + ?2,
                     updated_at = datetime('now')
                 WHERE id = ?3",
                params![outstanding, loyalty_points_earned, customer_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        let payload = serde_json::json!({
            "bill_id": bill_id,
            "bill_number": bill_number,
            "customer_id": input.customer_id,
            "item_count": input.items.len(),
            "net_amount": net_amount,
            "outstanding": outstanding,
        })
        .to_string();

        tx.execute(
            "INSERT INTO audit_log (user_id, user_name, action, module, record_id, old_value, new_value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                input.created_by,
                format!("user:{}", input.created_by),
                "BILL_CREATED",
                "billing",
                bill_id.to_string(),
                Option::<String>::None,
                payload,
                chrono::Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        tx.commit().map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(bill_id)
    }

    pub fn hold_bill(&self, input: &serde_json::Value) -> Result<(), AppError> {
        let conn = self.connection()?;
        let label = input
            .get("label")
            .and_then(|value| value.as_str())
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .unwrap_or("Held Bill");

        let created_by = input.get("created_by").and_then(|value| value.as_i64());
        let cart_data = serde_json::to_string(input).map_err(|e| AppError::Internal(e.to_string()))?;

        conn.execute(
            "INSERT INTO held_bills (label, cart_data, created_by) VALUES (?1, ?2, ?3)",
            params![label, cart_data, created_by],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(())
    }

    pub fn get_held_bills(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, label, created_at
                 FROM held_bills
                 ORDER BY datetime(created_at) DESC, id DESC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "label": row.get::<_, String>(1)?,
                    "created_at": row.get::<_, String>(2)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::Value::Array(items))
    }

    pub fn restore_held_bill(&self, held_bill_id: i64) -> Result<serde_json::Value, AppError> {
        let mut conn = self.connection()?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let cart_data: String = tx
            .query_row(
                "SELECT cart_data FROM held_bills WHERE id = ?1",
                params![held_bill_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Held bill not found.".to_string()))?;

        tx.execute("DELETE FROM held_bills WHERE id = ?1", params![held_bill_id])
            .map_err(|e| AppError::Internal(e.to_string()))?;
        tx.commit().map_err(|e| AppError::Internal(e.to_string()))?;

        let payload: serde_json::Value =
            serde_json::from_str(&cart_data).map_err(|e| AppError::Internal(e.to_string()))?;
        let items = payload
            .get("items")
            .cloned()
            .unwrap_or_else(|| serde_json::Value::Array(vec![]));

        Ok(items)
    }

    pub fn get_bill_json(&self, bill_id: i64) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let bill = conn
            .query_row(
                "SELECT
                    id, bill_number, customer_id, doctor_id, bill_date, status,
                    subtotal, discount_amount, taxable_amount,
                    cgst_amount, sgst_amount, igst_amount,
                    total_amount, round_off, net_amount,
                    amount_paid, change_returned, outstanding,
                    loyalty_points_earned, loyalty_points_redeemed,
                    notes, created_by, created_at
                 FROM bills
                 WHERE id = ?1",
                params![bill_id],
                |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, i64>(0)?,
                        "bill_number": row.get::<_, String>(1)?,
                        "customer_id": row.get::<_, Option<i64>>(2)?,
                        "doctor_id": row.get::<_, Option<i64>>(3)?,
                        "bill_date": row.get::<_, String>(4)?,
                        "status": row.get::<_, String>(5)?,
                        "subtotal": row.get::<_, f64>(6)?,
                        "discount_amount": row.get::<_, f64>(7)?,
                        "taxable_amount": row.get::<_, f64>(8)?,
                        "cgst_amount": row.get::<_, f64>(9)?,
                        "sgst_amount": row.get::<_, f64>(10)?,
                        "igst_amount": row.get::<_, f64>(11)?,
                        "total_amount": row.get::<_, f64>(12)?,
                        "round_off": row.get::<_, f64>(13)?,
                        "net_amount": row.get::<_, f64>(14)?,
                        "amount_paid": row.get::<_, f64>(15)?,
                        "change_returned": row.get::<_, f64>(16)?,
                        "outstanding": row.get::<_, f64>(17)?,
                        "loyalty_points_earned": row.get::<_, i64>(18)?,
                        "loyalty_points_redeemed": row.get::<_, i64>(19)?,
                        "notes": row.get::<_, Option<String>>(20)?,
                        "created_by": row.get::<_, i64>(21)?,
                        "created_at": row.get::<_, String>(22)?,
                    }))
                },
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Bill not found.".to_string()))?;

        let mut item_stmt = conn
            .prepare(
                "SELECT
                    id, bill_id, medicine_id, batch_id,
                    medicine_name, batch_number, expiry_date,
                    quantity, unit_price, mrp,
                    discount_percent, discount_amount, gst_rate,
                    cgst_amount, sgst_amount, igst_amount, total_amount
                 FROM bill_items
                 WHERE bill_id = ?1
                 ORDER BY id ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let item_rows = item_stmt
            .query_map(params![bill_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "bill_id": row.get::<_, i64>(1)?,
                    "medicine_id": row.get::<_, i64>(2)?,
                    "batch_id": row.get::<_, i64>(3)?,
                    "medicine_name": row.get::<_, String>(4)?,
                    "batch_number": row.get::<_, String>(5)?,
                    "expiry_date": row.get::<_, String>(6)?,
                    "quantity": row.get::<_, i64>(7)?,
                    "unit_price": row.get::<_, f64>(8)?,
                    "mrp": row.get::<_, f64>(9)?,
                    "discount_percent": row.get::<_, f64>(10)?,
                    "discount_amount": row.get::<_, f64>(11)?,
                    "gst_rate": row.get::<_, f64>(12)?,
                    "cgst_amount": row.get::<_, f64>(13)?,
                    "sgst_amount": row.get::<_, f64>(14)?,
                    "igst_amount": row.get::<_, f64>(15)?,
                    "total_amount": row.get::<_, f64>(16)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in item_rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        let mut payment_stmt = conn
            .prepare(
                "SELECT id, amount, payment_mode, reference_no, payment_date
                 FROM payments
                 WHERE bill_id = ?1
                 ORDER BY id ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let payment_rows = payment_stmt
            .query_map(params![bill_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "amount": row.get::<_, f64>(1)?,
                    "payment_mode": row.get::<_, String>(2)?,
                    "reference_no": row.get::<_, Option<String>>(3)?,
                    "payment_date": row.get::<_, String>(4)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut payments = Vec::new();
        for row in payment_rows {
            payments.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        let mut bill_with_lines = bill;
        if let serde_json::Value::Object(ref mut map) = bill_with_lines {
            map.insert("items".to_string(), serde_json::Value::Array(items));
            map.insert("payments".to_string(), serde_json::Value::Array(payments));
        }

        Ok(bill_with_lines)
    }

    pub fn list_bills(&self, filters: &serde_json::Value) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let status = filters.get("status").and_then(|v| v.as_str());
        let customer_id = filters.get("customer_id").and_then(|v| v.as_i64());
        let page = filters.get("page").and_then(|v| v.as_i64()).unwrap_or(1).max(1);
        let page_size = filters
            .get("page_size")
            .and_then(|v| v.as_i64())
            .unwrap_or(50)
            .clamp(1, 200);
        let offset = (page - 1) * page_size;

        let total: i64 = conn
            .query_row(
                "SELECT COUNT(1)
                 FROM bills
                 WHERE (?1 IS NULL OR status = ?1)
                   AND (?2 IS NULL OR customer_id = ?2)",
                params![status, customer_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn
            .prepare(
                "SELECT
                    id, bill_number, customer_id, doctor_id, bill_date, status,
                    subtotal, discount_amount, taxable_amount,
                    cgst_amount, sgst_amount, igst_amount,
                    total_amount, round_off, net_amount,
                    amount_paid, change_returned, outstanding,
                    loyalty_points_earned, loyalty_points_redeemed,
                    notes, created_by, created_at
                 FROM bills
                 WHERE (?1 IS NULL OR status = ?1)
                   AND (?2 IS NULL OR customer_id = ?2)
                 ORDER BY datetime(bill_date) DESC, id DESC
                 LIMIT ?3 OFFSET ?4",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![status, customer_id, page_size, offset], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "bill_number": row.get::<_, String>(1)?,
                    "customer_id": row.get::<_, Option<i64>>(2)?,
                    "doctor_id": row.get::<_, Option<i64>>(3)?,
                    "bill_date": row.get::<_, String>(4)?,
                    "status": row.get::<_, String>(5)?,
                    "subtotal": row.get::<_, f64>(6)?,
                    "discount_amount": row.get::<_, f64>(7)?,
                    "taxable_amount": row.get::<_, f64>(8)?,
                    "cgst_amount": row.get::<_, f64>(9)?,
                    "sgst_amount": row.get::<_, f64>(10)?,
                    "igst_amount": row.get::<_, f64>(11)?,
                    "total_amount": row.get::<_, f64>(12)?,
                    "round_off": row.get::<_, f64>(13)?,
                    "net_amount": row.get::<_, f64>(14)?,
                    "amount_paid": row.get::<_, f64>(15)?,
                    "change_returned": row.get::<_, f64>(16)?,
                    "outstanding": row.get::<_, f64>(17)?,
                    "loyalty_points_earned": row.get::<_, i64>(18)?,
                    "loyalty_points_redeemed": row.get::<_, i64>(19)?,
                    "notes": row.get::<_, Option<String>>(20)?,
                    "created_by": row.get::<_, i64>(21)?,
                    "created_at": row.get::<_, String>(22)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut bills = Vec::new();
        for row in rows {
            bills.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "bills": bills,
            "total": total,
        }))
    }

    pub fn cancel_bill(&self, bill_id: i64, reason: &str, user_id: i64) -> Result<(), AppError> {
        let mut conn = self.connection()?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let status: String = tx
            .query_row(
                "SELECT status FROM bills WHERE id = ?1",
                params![bill_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Bill not found.".to_string()))?;

        if status != "active" {
            return Err(AppError::Validation("Only active bills can be cancelled.".to_string()));
        }

        let mut bill_items: Vec<(i64, i64)> = Vec::new();
        {
            let mut item_stmt = tx
                .prepare("SELECT batch_id, quantity FROM bill_items WHERE bill_id = ?1")
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let item_rows = item_stmt
                .query_map(params![bill_id], |row| {
                    Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
                })
                .map_err(|e| AppError::Internal(e.to_string()))?;

            for item in item_rows {
                bill_items.push(item.map_err(|e| AppError::Internal(e.to_string()))?);
            }
        }

        for (batch_id, qty) in bill_items {
            tx.execute(
                "UPDATE batches
                 SET quantity_sold = CASE WHEN quantity_sold - ?1 < 0 THEN 0 ELSE quantity_sold - ?1 END,
                     updated_at = datetime('now')
                 WHERE id = ?2",
                params![qty, batch_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        tx.execute(
            "UPDATE bills
             SET status = 'cancelled', cancel_reason = ?1, cancelled_by = ?2, cancelled_at = datetime('now')
             WHERE id = ?3",
            params![reason, user_id, bill_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        tx.execute(
            "INSERT INTO audit_log (user_id, user_name, action, module, record_id, old_value, new_value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                user_id,
                format!("user:{}", user_id),
                "BILL_CANCELLED",
                "billing",
                bill_id.to_string(),
                Option::<String>::None,
                serde_json::json!({"reason": reason}).to_string(),
                chrono::Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        tx.commit().map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn get_today_summary(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let (total_revenue, bill_count, avg_bill_value): (f64, i64, f64) = conn
            .query_row(
                "SELECT
                    COALESCE(SUM(net_amount), 0),
                    COUNT(*),
                    COALESCE(AVG(net_amount), 0)
                 FROM bills
                 WHERE date(bill_date) = date('now') AND status = 'active'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let payment_total_for_mode = |mode: &str| -> Result<f64, AppError> {
            conn.query_row(
                "SELECT COALESCE(SUM(p.amount), 0)
                 FROM payments p
                 JOIN bills b ON b.id = p.bill_id
                 WHERE date(p.payment_date) = date('now')
                   AND b.status = 'active'
                   AND p.payment_mode = ?1",
                params![mode],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))
        };

        Ok(serde_json::json!({
            "total_revenue": total_revenue,
            "bill_count": bill_count,
            "avg_bill_value": avg_bill_value,
            "cash_amount": payment_total_for_mode("cash")?,
            "upi_amount": payment_total_for_mode("upi")?,
            "card_amount": payment_total_for_mode("card")?,
            "credit_amount": payment_total_for_mode("credit")?,
        }))
    }

    pub fn customer_search(&self, query: &str) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let q = query.trim();
        let like = format!("%{}%", q);

        let mut stmt = conn
            .prepare(
                "SELECT id, name, phone, outstanding_balance, loyalty_points
                 FROM customers
                 WHERE is_active = 1
                   AND (
                     ?1 = ''
                     OR name LIKE ?2 COLLATE NOCASE
                     OR COALESCE(phone, '') LIKE ?2
                   )
                 ORDER BY name ASC
                 LIMIT 50",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![q, like], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "phone": row.get::<_, Option<String>>(2)?,
                    "outstanding_balance": row.get::<_, f64>(3)?,
                    "loyalty_points": row.get::<_, i64>(4)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::Value::Array(items))
    }

    pub fn customer_create(
        &self,
        name: &str,
        phone: Option<&str>,
        email: Option<&str>,
        user_id: i64,
    ) -> Result<i64, AppError> {
        let clean_name = name.trim();
        if clean_name.is_empty() {
            return Err(AppError::Validation("Customer name is required.".to_string()));
        }

        let clean_phone = phone.map(|value| value.trim()).filter(|value| !value.is_empty());
        let clean_email = email.map(|value| value.trim()).filter(|value| !value.is_empty());

        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO customers (name, phone, email, allergies, chronic_conditions, created_by)
             VALUES (?1, ?2, ?3, '[]', '[]', ?4)",
            params![clean_name, clean_phone, clean_email, user_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let customer_id = conn.last_insert_rowid();
        self.write_audit_log(
            "CUSTOMER_CREATED",
            "customer",
            &customer_id.to_string(),
            None,
            Some(
                &serde_json::json!({
                    "name": clean_name,
                    "phone": clean_phone,
                    "email": clean_email,
                })
                .to_string(),
            ),
            &format!("user:{}", user_id),
        )?;

        Ok(customer_id)
    }

    pub fn customer_get(&self, id: i64) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        conn.query_row(
            "SELECT
                c.id, c.name, c.phone, c.phone2, c.email,
                c.date_of_birth, c.gender, c.blood_group,
                c.address, c.pincode, c.doctor_id,
                d.name,
                c.allergies, c.chronic_conditions,
                c.outstanding_balance, c.loyalty_points,
                c.med_sync_date, c.notes, c.is_active,
                c.created_at, c.updated_at
             FROM customers c
             LEFT JOIN doctors d ON d.id = c.doctor_id
             WHERE c.id = ?1",
            params![id],
            |row| {
                let allergies_raw = row.get::<_, Option<String>>(12)?.unwrap_or_else(|| "[]".to_string());
                let chronic_raw = row.get::<_, Option<String>>(13)?.unwrap_or_else(|| "[]".to_string());

                let allergies = serde_json::from_str::<serde_json::Value>(&allergies_raw)
                    .unwrap_or_else(|_| serde_json::json!([]));
                let chronic_conditions = serde_json::from_str::<serde_json::Value>(&chronic_raw)
                    .unwrap_or_else(|_| serde_json::json!([]));

                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "phone": row.get::<_, Option<String>>(2)?,
                    "phone2": row.get::<_, Option<String>>(3)?,
                    "email": row.get::<_, Option<String>>(4)?,
                    "date_of_birth": row.get::<_, Option<String>>(5)?,
                    "gender": row.get::<_, Option<String>>(6)?,
                    "blood_group": row.get::<_, Option<String>>(7)?,
                    "address": row.get::<_, Option<String>>(8)?,
                    "pincode": row.get::<_, Option<String>>(9)?,
                    "doctor_id": row.get::<_, Option<i64>>(10)?,
                    "doctor_name": row.get::<_, Option<String>>(11)?,
                    "allergies": allergies,
                    "chronic_conditions": chronic_conditions,
                    "outstanding_balance": row.get::<_, f64>(14)?,
                    "loyalty_points": row.get::<_, i64>(15)?,
                    "med_sync_date": row.get::<_, Option<i64>>(16)?,
                    "notes": row.get::<_, Option<String>>(17)?,
                    "is_active": row.get::<_, i64>(18)? == 1,
                    "created_at": row.get::<_, String>(19)?,
                    "updated_at": row.get::<_, String>(20)?,
                }))
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or_else(|| AppError::Validation("Customer not found.".to_string()))
    }

    pub fn customer_update(&self, id: i64, data: &serde_json::Value, user_id: i64) -> Result<(), AppError> {
        let current = self.customer_get(id)?;

        let current_name = current.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let name = data
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or(current_name)
            .trim()
            .to_string();

        if name.is_empty() {
            return Err(AppError::Validation("Customer name is required.".to_string()));
        }

        let pick_string = |key: &str| -> Option<String> {
            if let Some(value) = data.get(key) {
                return value
                    .as_str()
                    .map(|text| text.trim().to_string())
                    .filter(|text| !text.is_empty());
            }

            current
                .get(key)
                .and_then(|v| v.as_str())
                .map(|text| text.trim().to_string())
                .filter(|text| !text.is_empty())
        };

        let pick_i64 = |key: &str| -> Option<i64> {
            if let Some(value) = data.get(key) {
                return value.as_i64();
            }
            current.get(key).and_then(|v| v.as_i64())
        };

        let pick_f64 = |key: &str| -> f64 {
            if let Some(value) = data.get(key) {
                return value.as_f64().unwrap_or(0.0);
            }
            current.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0)
        };

        let pick_bool = |key: &str| -> bool {
            if let Some(value) = data.get(key) {
                return value.as_bool().unwrap_or(false);
            }
            current.get(key).and_then(|v| v.as_bool()).unwrap_or(false)
        };

        let allergies = data
            .get("allergies")
            .cloned()
            .or_else(|| current.get("allergies").cloned())
            .unwrap_or_else(|| serde_json::json!([]));

        let chronic_conditions = data
            .get("chronic_conditions")
            .cloned()
            .or_else(|| current.get("chronic_conditions").cloned())
            .unwrap_or_else(|| serde_json::json!([]));

        let conn = self.connection()?;
        let changed = conn
            .execute(
                "UPDATE customers
                 SET name = ?1,
                     phone = ?2,
                     phone2 = ?3,
                     email = ?4,
                     date_of_birth = ?5,
                     gender = ?6,
                     blood_group = ?7,
                     address = ?8,
                     pincode = ?9,
                     doctor_id = ?10,
                     allergies = ?11,
                     chronic_conditions = ?12,
                     outstanding_balance = ?13,
                     loyalty_points = ?14,
                     med_sync_date = ?15,
                     notes = ?16,
                     is_active = ?17,
                     updated_at = ?18
                 WHERE id = ?19",
                params![
                    name,
                    pick_string("phone"),
                    pick_string("phone2"),
                    pick_string("email"),
                    pick_string("date_of_birth"),
                    pick_string("gender"),
                    pick_string("blood_group"),
                    pick_string("address"),
                    pick_string("pincode"),
                    pick_i64("doctor_id"),
                    allergies.to_string(),
                    chronic_conditions.to_string(),
                    pick_f64("outstanding_balance"),
                    pick_i64("loyalty_points").unwrap_or(0),
                    pick_i64("med_sync_date"),
                    pick_string("notes"),
                    if pick_bool("is_active") { 1 } else { 0 },
                    chrono::Utc::now().to_rfc3339(),
                    id,
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if changed == 0 {
            return Err(AppError::Validation("Customer not found.".to_string()));
        }

        self.write_audit_log(
            "CUSTOMER_UPDATED",
            "customer",
            &id.to_string(),
            Some(&current.to_string()),
            Some(&data.to_string()),
            &format!("user:{}", user_id),
        )?;

        Ok(())
    }

    pub fn customer_get_history(&self, customer_id: i64, limit: i64) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let safe_limit = if limit < 1 { 1 } else if limit > 500 { 500 } else { limit };

        let mut stmt = conn
            .prepare(
                "SELECT
                    b.id, b.bill_number, b.bill_date, b.status,
                    b.net_amount, b.outstanding,
                    COUNT(bi.id) AS item_count
                 FROM bills b
                 LEFT JOIN bill_items bi ON bi.bill_id = b.id
                 WHERE b.customer_id = ?1
                 GROUP BY b.id, b.bill_number, b.bill_date, b.status, b.net_amount, b.outstanding
                 ORDER BY b.bill_date DESC
                 LIMIT ?2",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![customer_id, safe_limit], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "bill_number": row.get::<_, String>(1)?,
                    "bill_date": row.get::<_, String>(2)?,
                    "status": row.get::<_, String>(3)?,
                    "net_amount": row.get::<_, f64>(4)?,
                    "outstanding": row.get::<_, f64>(5)?,
                    "item_count": row.get::<_, i64>(6)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut history = Vec::new();
        for row in rows {
            history.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::Value::Array(history))
    }

    pub fn customer_record_credit_payment(
        &self,
        customer_id: i64,
        amount: f64,
        user_id: i64,
    ) -> Result<(), AppError> {
        if amount <= 0.0 {
            return Err(AppError::Validation("Payment amount must be greater than zero.".to_string()));
        }

        let conn = self.connection()?;
        let current_outstanding: f64 = conn
            .query_row(
                "SELECT outstanding_balance FROM customers WHERE id = ?1 AND is_active = 1",
                params![customer_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Customer not found.".to_string()))?;

        if current_outstanding <= 0.0 {
            return Err(AppError::Validation("Customer has no outstanding balance.".to_string()));
        }

        let applied = amount.min(current_outstanding);
        let remaining = (current_outstanding - applied).max(0.0);

        conn.execute(
            "UPDATE customers
             SET outstanding_balance = ?1,
                 updated_at = ?2
             WHERE id = ?3",
            params![remaining, chrono::Utc::now().to_rfc3339(), customer_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        self.write_audit_log(
            "CUSTOMER_CREDIT_PAYMENT",
            "customer",
            &customer_id.to_string(),
            None,
            Some(
                &serde_json::json!({
                    "paid_amount": applied,
                    "before_outstanding": current_outstanding,
                    "after_outstanding": remaining,
                })
                .to_string(),
            ),
            &format!("user:{}", user_id),
        )?;

        Ok(())
    }

    pub fn doctor_list(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, name, registration_no, specialisation, qualification, clinic_name, phone, email, is_active, created_at
                 FROM doctors
                 WHERE is_active = 1
                 ORDER BY name ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "registration_no": row.get::<_, Option<String>>(2)?,
                    "specialisation": row.get::<_, Option<String>>(3)?,
                    "qualification": row.get::<_, Option<String>>(4)?,
                    "clinic_name": row.get::<_, Option<String>>(5)?,
                    "phone": row.get::<_, Option<String>>(6)?,
                    "email": row.get::<_, Option<String>>(7)?,
                    "is_active": row.get::<_, i64>(8)? == 1,
                    "created_at": row.get::<_, String>(9)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }
        Ok(serde_json::Value::Array(items))
    }

    pub fn doctor_create(&self, data: &DoctorCreateInput, user_id: i64) -> Result<i64, AppError> {
        let name = data.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("Doctor name is required.".to_string()));
        }

        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO doctors (name, registration_no, specialisation, qualification, clinic_name, phone, email, address, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                name,
                data.registration_no.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.specialisation.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.qualification.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.clinic_name.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.phone.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.email.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.address.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.notes.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let doctor_id = conn.last_insert_rowid();
        self.write_audit_log(
            "DOCTOR_CREATED",
            "doctor",
            &doctor_id.to_string(),
            None,
            Some(&serde_json::json!({
                "name": name,
                "registration_no": data.registration_no,
            }).to_string()),
            &format!("user:{}", user_id),
        )?;

        Ok(doctor_id)
    }

    pub fn doctor_update(&self, id: i64, data: &serde_json::Value, user_id: i64) -> Result<(), AppError> {
        let conn = self.connection()?;

        let current = conn.query_row(
            "SELECT id, name, registration_no, specialisation, qualification, clinic_name, phone, email, address, notes, is_active
             FROM doctors WHERE id = ?1",
            params![id],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "registration_no": row.get::<_, Option<String>>(2)?,
                    "specialisation": row.get::<_, Option<String>>(3)?,
                    "qualification": row.get::<_, Option<String>>(4)?,
                    "clinic_name": row.get::<_, Option<String>>(5)?,
                    "phone": row.get::<_, Option<String>>(6)?,
                    "email": row.get::<_, Option<String>>(7)?,
                    "address": row.get::<_, Option<String>>(8)?,
                    "notes": row.get::<_, Option<String>>(9)?,
                    "is_active": row.get::<_, i64>(10)? == 1,
                }))
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or_else(|| AppError::Validation("Doctor not found.".to_string()))?;

        let pick_string = |key: &str| -> Option<String> {
            if let Some(value) = data.get(key) {
                return value
                    .as_str()
                    .map(|text| text.trim().to_string())
                    .filter(|text| !text.is_empty());
            }

            current
                .get(key)
                .and_then(|v| v.as_str())
                .map(|text| text.trim().to_string())
                .filter(|text| !text.is_empty())
        };

        let name = pick_string("name").unwrap_or_default();
        if name.is_empty() {
            return Err(AppError::Validation("Doctor name is required.".to_string()));
        }

        let is_active = data
            .get("is_active")
            .and_then(|v| v.as_bool())
            .or_else(|| current.get("is_active").and_then(|v| v.as_bool()))
            .unwrap_or(true);

        let changed = conn
            .execute(
                "UPDATE doctors
                 SET name = ?1,
                     registration_no = ?2,
                     specialisation = ?3,
                     qualification = ?4,
                     clinic_name = ?5,
                     phone = ?6,
                     email = ?7,
                     address = ?8,
                     notes = ?9,
                     is_active = ?10,
                     updated_at = ?11
                 WHERE id = ?12",
                params![
                    name,
                    pick_string("registration_no"),
                    pick_string("specialisation"),
                    pick_string("qualification"),
                    pick_string("clinic_name"),
                    pick_string("phone"),
                    pick_string("email"),
                    pick_string("address"),
                    pick_string("notes"),
                    if is_active { 1 } else { 0 },
                    chrono::Utc::now().to_rfc3339(),
                    id,
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if changed == 0 {
            return Err(AppError::Validation("Doctor not found.".to_string()));
        }

        self.write_audit_log(
            "DOCTOR_UPDATED",
            "doctor",
            &id.to_string(),
            Some(&current.to_string()),
            Some(&data.to_string()),
            &format!("user:{}", user_id),
        )?;

        Ok(())
    }

    pub fn purchase_list_suppliers(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT
                    id, name, contact_person, phone, email,
                    email_domain, gstin, drug_licence_no, drug_licence_expiry,
                    payment_terms, credit_limit, outstanding_balance, reliability_score,
                    is_active, created_at
                 FROM suppliers
                 WHERE deleted_at IS NULL
                 ORDER BY name ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "contact_person": row.get::<_, Option<String>>(2)?,
                    "phone": row.get::<_, Option<String>>(3)?,
                    "email": row.get::<_, Option<String>>(4)?,
                    "email_domain": row.get::<_, Option<String>>(5)?,
                    "gstin": row.get::<_, Option<String>>(6)?,
                    "drug_licence_no": row.get::<_, Option<String>>(7)?,
                    "drug_licence_expiry": row.get::<_, Option<String>>(8)?,
                    "payment_terms": row.get::<_, i64>(9)?,
                    "credit_limit": row.get::<_, f64>(10)?,
                    "outstanding_balance": row.get::<_, f64>(11)?,
                    "reliability_score": row.get::<_, f64>(12)?,
                    "is_active": row.get::<_, i64>(13)? == 1,
                    "created_at": row.get::<_, String>(14)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }
        Ok(serde_json::Value::Array(items))
    }

    pub fn purchase_create_bill(&self, data: &PurchaseBillCreateInput, user_id: i64) -> Result<i64, AppError> {
        let bill_number = data.bill_number.trim();
        if bill_number.is_empty() {
            return Err(AppError::Validation("Purchase bill number is required.".to_string()));
        }
        if data.total_amount <= 0.0 {
            return Err(AppError::Validation("Total amount must be greater than zero.".to_string()));
        }

        let amount_paid = data.amount_paid.unwrap_or(0.0);
        if amount_paid < 0.0 {
            return Err(AppError::Validation("Amount paid cannot be negative.".to_string()));
        }

        let payment_status = if amount_paid <= 0.0 {
            "unpaid"
        } else if amount_paid + f64::EPSILON < data.total_amount {
            "partial"
        } else {
            "paid"
        };

        let conn = self.connection()?;

        let supplier_active: i64 = conn
            .query_row(
                "SELECT is_active FROM suppliers WHERE id = ?1 AND deleted_at IS NULL",
                params![data.supplier_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Supplier not found.".to_string()))?;

        if supplier_active != 1 {
            return Err(AppError::Validation("Supplier is inactive.".to_string()));
        }

        conn.execute(
            "INSERT INTO purchase_bills (
                bill_number, supplier_id, bill_date, due_date,
                subtotal, taxable_amount, total_amount,
                amount_paid, payment_status, source, notes, created_by
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?5, ?6, ?7, 'manual', ?8, ?9)",
            params![
                bill_number,
                data.supplier_id,
                data.bill_date,
                data.due_date,
                data.total_amount,
                amount_paid,
                payment_status,
                data.notes.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                user_id,
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let bill_id = conn.last_insert_rowid();

        conn.execute(
            "UPDATE suppliers
             SET outstanding_balance = outstanding_balance + (?1 - ?2),
                 updated_at = ?3
             WHERE id = ?4",
            params![data.total_amount, amount_paid, chrono::Utc::now().to_rfc3339(), data.supplier_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        self.write_audit_log(
            "PURCHASE_BILL_CREATED",
            "purchase",
            &bill_id.to_string(),
            None,
            Some(
                &serde_json::json!({
                    "bill_number": bill_number,
                    "supplier_id": data.supplier_id,
                    "total_amount": data.total_amount,
                    "amount_paid": amount_paid,
                })
                .to_string(),
            ),
            &format!("user:{}", user_id),
        )?;

        Ok(bill_id)
    }

    pub fn purchase_create_po(&self, data: &PurchaseOrderCreateInput, user_id: i64) -> Result<i64, AppError> {
        let po_number = data.po_number.trim();
        if po_number.is_empty() {
            return Err(AppError::Validation("Purchase order number is required.".to_string()));
        }

        let conn = self.connection()?;

        let supplier_active: i64 = conn
            .query_row(
                "SELECT is_active FROM suppliers WHERE id = ?1 AND deleted_at IS NULL",
                params![data.supplier_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Supplier not found.".to_string()))?;

        if supplier_active != 1 {
            return Err(AppError::Validation("Supplier is inactive.".to_string()));
        }

        let total_amount = data.total_amount.unwrap_or(0.0).max(0.0);

        conn.execute(
            "INSERT INTO purchase_orders (
                po_number, supplier_id, status, order_date,
                expected_by, notes, total_amount, created_by
             ) VALUES (?1, ?2, 'draft', date('now'), ?3, ?4, ?5, ?6)",
            params![
                po_number,
                data.supplier_id,
                data.expected_by.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.notes.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                total_amount,
                user_id,
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let po_id = conn.last_insert_rowid();
        self.write_audit_log(
            "PURCHASE_PO_CREATED",
            "purchase",
            &po_id.to_string(),
            None,
            Some(
                &serde_json::json!({
                    "po_number": po_number,
                    "supplier_id": data.supplier_id,
                    "total_amount": total_amount,
                })
                .to_string(),
            ),
            &format!("user:{}", user_id),
        )?;

        Ok(po_id)
    }

    pub fn purchase_get_bill(&self, id: i64) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        conn.query_row(
            "SELECT
                pb.id, pb.bill_number, pb.supplier_id, s.name,
                pb.bill_date, pb.due_date, pb.total_amount,
                pb.amount_paid, pb.payment_status, pb.source, pb.created_at
             FROM purchase_bills pb
             JOIN suppliers s ON s.id = pb.supplier_id
             WHERE pb.id = ?1",
            params![id],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "bill_number": row.get::<_, String>(1)?,
                    "supplier_id": row.get::<_, i64>(2)?,
                    "supplier_name": row.get::<_, String>(3)?,
                    "bill_date": row.get::<_, String>(4)?,
                    "due_date": row.get::<_, Option<String>>(5)?,
                    "total_amount": row.get::<_, f64>(6)?,
                    "amount_paid": row.get::<_, f64>(7)?,
                    "payment_status": row.get::<_, String>(8)?,
                    "source": row.get::<_, String>(9)?,
                    "created_at": row.get::<_, String>(10)?,
                    "items": serde_json::json!([]),
                }))
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or_else(|| AppError::Validation("Purchase bill not found.".to_string()))
    }

    pub fn purchase_list_bills(&self, filters: &serde_json::Value) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let supplier_id = filters.get("supplier_id").and_then(|v| v.as_i64());
        let payment_status = filters.get("payment_status").and_then(|v| v.as_str()).unwrap_or("");

        let mut stmt = conn
            .prepare(
                "SELECT
                    pb.id, pb.bill_number, pb.supplier_id, s.name,
                    pb.bill_date, pb.due_date, pb.total_amount,
                    pb.amount_paid, pb.payment_status, pb.source, pb.created_at
                 FROM purchase_bills pb
                 JOIN suppliers s ON s.id = pb.supplier_id
                 WHERE (?1 IS NULL OR pb.supplier_id = ?1)
                   AND (?2 = '' OR pb.payment_status = ?2)
                 ORDER BY pb.bill_date DESC, pb.id DESC
                 LIMIT 200",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![supplier_id, payment_status], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "bill_number": row.get::<_, String>(1)?,
                    "supplier_id": row.get::<_, i64>(2)?,
                    "supplier_name": row.get::<_, String>(3)?,
                    "bill_date": row.get::<_, String>(4)?,
                    "due_date": row.get::<_, Option<String>>(5)?,
                    "total_amount": row.get::<_, f64>(6)?,
                    "amount_paid": row.get::<_, f64>(7)?,
                    "payment_status": row.get::<_, String>(8)?,
                    "source": row.get::<_, String>(9)?,
                    "created_at": row.get::<_, String>(10)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        let total = items.len();
        Ok(serde_json::json!({
            "bills": items,
            "total": total,
        }))
    }

    pub fn purchase_create_supplier(&self, data: &SupplierInput, user_id: i64) -> Result<i64, AppError> {
        let name = data.name.trim();
        if name.is_empty() {
            return Err(AppError::Validation("Supplier name is required.".to_string()));
        }

        let payment_terms = data.payment_terms.unwrap_or(30);
        if payment_terms < 0 {
            return Err(AppError::Validation("Payment terms cannot be negative.".to_string()));
        }

        let credit_limit = data.credit_limit.unwrap_or(0.0);
        if credit_limit < 0.0 {
            return Err(AppError::Validation("Credit limit cannot be negative.".to_string()));
        }

        let reliability_score = data.reliability_score.unwrap_or(50.0).clamp(0.0, 100.0);
        let conn = self.connection()?;

        conn.execute(
            "INSERT INTO suppliers (
                name, contact_person, phone, email, email_domain,
                gstin, drug_licence_no, drug_licence_expiry,
                payment_terms, credit_limit, reliability_score
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                name,
                data.contact_person.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.phone.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.email.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.email_domain.as_ref().map(|v| v.trim().to_lowercase()).filter(|v| !v.is_empty()),
                data.gstin.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.drug_licence_no.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                data.drug_licence_expiry.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()),
                payment_terms,
                credit_limit,
                reliability_score,
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let supplier_id = conn.last_insert_rowid();
        self.write_audit_log(
            "SUPPLIER_CREATED",
            "supplier",
            &supplier_id.to_string(),
            None,
            Some(
                &serde_json::json!({
                    "name": name,
                    "phone": data.phone,
                    "email": data.email,
                })
                .to_string(),
            ),
            &format!("user:{}", user_id),
        )?;

        Ok(supplier_id)
    }

    pub fn purchase_update_supplier(
        &self,
        id: i64,
        data: &serde_json::Value,
        user_id: i64,
    ) -> Result<(), AppError> {
        let conn = self.connection()?;

        let current = conn
            .query_row(
                "SELECT
                    id, name, contact_person, phone, email,
                    email_domain, gstin, drug_licence_no, drug_licence_expiry,
                    payment_terms, credit_limit, reliability_score, is_active
                 FROM suppliers
                 WHERE id = ?1 AND deleted_at IS NULL",
                params![id],
                |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, i64>(0)?,
                        "name": row.get::<_, String>(1)?,
                        "contact_person": row.get::<_, Option<String>>(2)?,
                        "phone": row.get::<_, Option<String>>(3)?,
                        "email": row.get::<_, Option<String>>(4)?,
                        "email_domain": row.get::<_, Option<String>>(5)?,
                        "gstin": row.get::<_, Option<String>>(6)?,
                        "drug_licence_no": row.get::<_, Option<String>>(7)?,
                        "drug_licence_expiry": row.get::<_, Option<String>>(8)?,
                        "payment_terms": row.get::<_, i64>(9)?,
                        "credit_limit": row.get::<_, f64>(10)?,
                        "reliability_score": row.get::<_, f64>(11)?,
                        "is_active": row.get::<_, i64>(12)? == 1,
                    }))
                },
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Supplier not found.".to_string()))?;

        let pick_string = |key: &str| -> Option<String> {
            if let Some(value) = data.get(key) {
                return value
                    .as_str()
                    .map(|text| text.trim().to_string())
                    .filter(|text| !text.is_empty());
            }

            current
                .get(key)
                .and_then(|v| v.as_str())
                .map(|text| text.trim().to_string())
                .filter(|text| !text.is_empty())
        };

        let name = pick_string("name").unwrap_or_default();
        if name.is_empty() {
            return Err(AppError::Validation("Supplier name is required.".to_string()));
        }

        let payment_terms = data
            .get("payment_terms")
            .and_then(|v| v.as_i64())
            .or_else(|| current.get("payment_terms").and_then(|v| v.as_i64()))
            .unwrap_or(30);
        if payment_terms < 0 {
            return Err(AppError::Validation("Payment terms cannot be negative.".to_string()));
        }

        let credit_limit = data
            .get("credit_limit")
            .and_then(|v| v.as_f64())
            .or_else(|| current.get("credit_limit").and_then(|v| v.as_f64()))
            .unwrap_or(0.0);
        if credit_limit < 0.0 {
            return Err(AppError::Validation("Credit limit cannot be negative.".to_string()));
        }

        let reliability_score = data
            .get("reliability_score")
            .and_then(|v| v.as_f64())
            .or_else(|| current.get("reliability_score").and_then(|v| v.as_f64()))
            .unwrap_or(50.0)
            .clamp(0.0, 100.0);

        let is_active = data
            .get("is_active")
            .and_then(|v| v.as_bool())
            .or_else(|| current.get("is_active").and_then(|v| v.as_bool()))
            .unwrap_or(true);

        let changed = conn
            .execute(
                "UPDATE suppliers
                 SET name = ?1,
                     contact_person = ?2,
                     phone = ?3,
                     email = ?4,
                     email_domain = ?5,
                     gstin = ?6,
                     drug_licence_no = ?7,
                     drug_licence_expiry = ?8,
                     payment_terms = ?9,
                     credit_limit = ?10,
                     reliability_score = ?11,
                     is_active = ?12,
                     updated_at = ?13
                 WHERE id = ?14",
                params![
                    name,
                    pick_string("contact_person"),
                    pick_string("phone"),
                    pick_string("email"),
                    pick_string("email_domain").map(|v| v.to_lowercase()),
                    pick_string("gstin"),
                    pick_string("drug_licence_no"),
                    pick_string("drug_licence_expiry"),
                    payment_terms,
                    credit_limit,
                    reliability_score,
                    if is_active { 1 } else { 0 },
                    chrono::Utc::now().to_rfc3339(),
                    id,
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if changed == 0 {
            return Err(AppError::Validation("Supplier not found.".to_string()));
        }

        self.write_audit_log(
            "SUPPLIER_UPDATED",
            "supplier",
            &id.to_string(),
            Some(&current.to_string()),
            Some(&data.to_string()),
            &format!("user:{}", user_id),
        )?;

        Ok(())
    }

    pub fn email_test_connection(&self, config: &serde_json::Value) -> Result<bool, AppError> {
        let host = config.get("host").and_then(|v| v.as_str()).unwrap_or("").trim();
        let email = config.get("email").and_then(|v| v.as_str()).unwrap_or("").trim();
        let password = config
            .get("password")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        let port = config.get("port").and_then(|v| v.as_i64()).unwrap_or(0);

        if host.is_empty() || email.is_empty() || password.is_empty() || port <= 0 {
            return Err(AppError::Validation(
                "Please enter host, port, email, and password to test connection.".to_string(),
            ));
        }

        // Placeholder until real IMAP wiring is added; validates config shape for now.
        Ok(true)
    }

    pub fn email_fetch_invoices(&self) -> Result<serde_json::Value, AppError> {
        // Placeholder: in next phase this will poll IMAP and parse attachments.
        Ok(serde_json::json!([]))
    }

    pub fn email_import_bill(
        &self,
        import_id: i64,
        _data: &serde_json::Value,
        _user_id: i64,
    ) -> Result<i64, AppError> {
        let conn = self.connection()?;

        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM email_imports WHERE id = ?1",
                params![import_id],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if exists == 0 {
            return Err(AppError::Validation("Import record not found.".to_string()));
        }

        Err(AppError::Validation(
            "Invoice-to-purchase conversion will be enabled in the next phase.".to_string(),
        ))
    }

    pub fn email_list_imports(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT
                    id, email_from, email_subject, received_at,
                    attachment_name, status, error_message,
                    supplier_id, rows_parsed, rows_imported, created_at
                 FROM email_imports
                 ORDER BY received_at DESC, id DESC
                 LIMIT 200",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "email_from": row.get::<_, String>(1)?,
                    "email_subject": row.get::<_, Option<String>>(2)?,
                    "received_at": row.get::<_, String>(3)?,
                    "attachment_name": row.get::<_, Option<String>>(4)?,
                    "status": row.get::<_, Option<String>>(5)?,
                    "error_message": row.get::<_, Option<String>>(6)?,
                    "supplier_id": row.get::<_, Option<i64>>(7)?,
                    "rows_parsed": row.get::<_, i64>(8)?,
                    "rows_imported": row.get::<_, i64>(9)?,
                    "created_at": row.get::<_, String>(10)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::Value::Array(items))
    }

    pub fn update_password(&self, user_id: i64, new_hash: &str) -> Result<(), AppError> {
        let conn = self.connection()?;
        let changed = conn
            .execute(
                "UPDATE users SET password_hash = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_hash, chrono::Utc::now().to_rfc3339(), user_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if changed == 0 {
            return Err(AppError::Validation("User not found.".to_string()));
        }
        Ok(())
    }

    pub fn revoke_all_sessions(&self, user_id: i64) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute(
            "UPDATE sessions SET revoked_at = ?1 WHERE user_id = ?2",
            params![chrono::Utc::now().to_rfc3339(), user_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn create_user(
        &self,
        name: &str,
        email: &str,
        password_hash: &str,
        role_id: i64,
    ) -> Result<i64, AppError> {
        let username = name.trim();
        let identifier = email.trim().to_lowercase();
        let conn = self.connection()?;

        if username.is_empty() {
            return Err(AppError::Validation("Username is required.".to_string()));
        }

        if identifier.is_empty() {
            return Err(AppError::Validation("Login identifier is required.".to_string()));
        }

        let username_taken: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM users WHERE lower(name) = ?1",
                params![username.to_lowercase()],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let identifier_taken: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM users WHERE lower(email) = ?1",
                params![identifier],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if username_taken > 0 || identifier_taken > 0 {
            return Err(AppError::Validation(
                "Username already exists. Please choose a different one.".to_string(),
            ));
        }

        conn.execute(
            "INSERT INTO users (name, email, role_id, password_hash, is_active, login_attempts)
             VALUES (?1, ?2, ?3, ?4, 1, 0)",
            params![username, identifier, role_id, password_hash],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(conn.last_insert_rowid())
    }

    pub fn list_users(&self) -> Result<Vec<UserDto>, AppError> {
        let conn = self.connection()?;

        let mut users = Vec::new();
        let mut stmt = conn
            .prepare(
                "SELECT id, name, email, phone, role_id, is_active, last_login_at
                 FROM users ORDER BY id ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)? == 1,
                    row.get::<_, Option<String>>(6)?,
                ))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        for row in rows {
            let (id, name, email, phone, role_id, is_active, last_login_at) =
                row.map_err(|e| AppError::Internal(e.to_string()))?;
            let role = self.get_role(role_id)?;
            users.push(UserDto {
                id,
                name,
                email,
                phone,
                role_id,
                role_name: role.name,
                permissions: serde_json::from_str(&role.permissions).unwrap_or_default(),
                is_active,
                last_login_at,
            });
        }

        Ok(users)
    }

    pub fn update_user(
        &self,
        user_id: i64,
        name: &str,
        role_id: i64,
        is_active: bool,
    ) -> Result<(), AppError> {
        let conn = self.connection()?;
        let changed = conn
            .execute(
                "UPDATE users
                 SET name = ?1, role_id = ?2, is_active = ?3, updated_at = ?4
                 WHERE id = ?5",
                params![
                    name,
                    role_id,
                    if is_active { 1 } else { 0 },
                    chrono::Utc::now().to_rfc3339(),
                    user_id
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        if changed == 0 {
            return Err(AppError::Validation("User not found.".to_string()));
        }
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, AppError> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))
    }

    pub fn set_setting(&self, key: &str, value: &str, user_id: Option<i64>) -> Result<(), AppError> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO settings (key, value, updated_at, updated_by)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at,
               updated_by = excluded.updated_by",
            params![key, value, chrono::Utc::now().to_rfc3339(), user_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn list_settings(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare("SELECT key, value FROM settings")
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut map = serde_json::Map::new();
        for row in rows {
            let (key, value) = row.map_err(|e| AppError::Internal(e.to_string()))?;
            map.insert(key, serde_json::Value::String(value));
        }

        Ok(serde_json::Value::Object(map))
    }

    pub fn list_medicine_categories(&self) -> Result<Vec<CategoryDto>, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare("SELECT id, name FROM categories ORDER BY name ASC")
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(CategoryDto {
                    id: row.get(0)?,
                    name: row.get(1)?,
                })
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut categories = Vec::new();
        for row in rows {
            categories.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }
        Ok(categories)
    }

    pub fn search_medicines(
        &self,
        query: Option<&str>,
        category_id: Option<i64>,
        in_stock_only: bool,
        sort: Option<&str>,
    ) -> Result<Vec<MedicineDto>, AppError> {
        let conn = self.connection()?;
        let search = format!("%{}%", query.unwrap_or("").trim().to_lowercase());

        let order_clause = match sort.unwrap_or("name_asc") {
            "name_desc" => "m.name DESC",
            _ => "m.name ASC",
        };

        let sql = format!(
            "SELECT
                m.id,
                m.name,
                m.generic_name,
                m.category_id,
                c.name,
                m.schedule,
                m.default_gst_rate,
                m.reorder_level,
                COALESCE(SUM(CASE WHEN b.is_active = 1 THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) ELSE 0 END), 0) AS total_stock,
                m.is_active
             FROM medicines m
             LEFT JOIN categories c ON c.id = m.category_id
             LEFT JOIN batches b ON b.medicine_id = m.id
             WHERE m.deleted_at IS NULL
               AND (?1 = '%%' OR lower(m.name) LIKE ?1 OR lower(m.generic_name) LIKE ?1)
               AND (?2 IS NULL OR m.category_id = ?2)
             GROUP BY m.id, m.name, m.generic_name, m.category_id, c.name, m.schedule, m.default_gst_rate, m.reorder_level, m.is_active
             HAVING (?3 = 0 OR total_stock > 0)
             ORDER BY {}",
            order_clause
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![search, category_id, if in_stock_only { 1 } else { 0 }], |row| {
                Ok(MedicineDto {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    generic_name: row.get(2)?,
                    category_id: row.get(3)?,
                    category_name: row.get(4)?,
                    schedule: row.get(5)?,
                    default_gst_rate: row.get(6)?,
                    reorder_level: row.get(7)?,
                    total_stock: row.get(8)?,
                    is_active: row.get::<_, i64>(9)? == 1,
                })
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut medicines = Vec::new();
        for row in rows {
            medicines.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }
        Ok(medicines)
    }

    pub fn create_medicine(
        &self,
        name: &str,
        generic_name: &str,
        category_id: Option<i64>,
        schedule: &str,
        default_gst_rate: f64,
        reorder_level: i64,
        reorder_quantity: i64,
        created_by: i64,
    ) -> Result<i64, AppError> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO medicines (
                name,
                generic_name,
                category_id,
                schedule,
                default_gst_rate,
                reorder_level,
                reorder_quantity,
                is_active,
                created_by
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8)",
            params![
                name.trim(),
                generic_name.trim(),
                category_id,
                schedule,
                default_gst_rate,
                reorder_level,
                reorder_quantity,
                created_by
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(conn.last_insert_rowid())
    }

    pub fn get_medicine(&self, id: i64) -> Result<MedicineDetailDto, AppError> {
        let conn = self.connection()?;

        conn.query_row(
            "SELECT
                m.id,
                m.name,
                m.generic_name,
                m.category_id,
                c.name,
                m.schedule,
                m.default_gst_rate,
                m.reorder_level,
                m.reorder_quantity,
                COALESCE(SUM(CASE WHEN b.is_active = 1 THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) ELSE 0 END), 0) AS total_stock,
                m.is_active
             FROM medicines m
             LEFT JOIN categories c ON c.id = m.category_id
             LEFT JOIN batches b ON b.medicine_id = m.id
             WHERE m.id = ?1 AND m.deleted_at IS NULL
             GROUP BY m.id, m.name, m.generic_name, m.category_id, c.name, m.schedule, m.default_gst_rate, m.reorder_level, m.reorder_quantity, m.is_active",
            params![id],
            |row| {
                Ok(MedicineDetailDto {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    generic_name: row.get(2)?,
                    category_id: row.get(3)?,
                    category_name: row.get(4)?,
                    schedule: row.get(5)?,
                    default_gst_rate: row.get(6)?,
                    reorder_level: row.get(7)?,
                    reorder_quantity: row.get(8)?,
                    total_stock: row.get(9)?,
                    is_active: row.get::<_, i64>(10)? == 1,
                })
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or(AppError::Validation("Medicine not found.".to_string()))
    }

    pub fn update_medicine(
        &self,
        id: i64,
        name: &str,
        generic_name: &str,
        category_id: Option<i64>,
        schedule: &str,
        default_gst_rate: f64,
        reorder_level: i64,
        reorder_quantity: i64,
    ) -> Result<(), AppError> {
        let conn = self.connection()?;
        let changed = conn
            .execute(
                "UPDATE medicines
                 SET name = ?1,
                     generic_name = ?2,
                     category_id = ?3,
                     schedule = ?4,
                     default_gst_rate = ?5,
                     reorder_level = ?6,
                     reorder_quantity = ?7,
                     updated_at = ?8
                 WHERE id = ?9 AND deleted_at IS NULL",
                params![
                    name.trim(),
                    generic_name.trim(),
                    category_id,
                    schedule,
                    default_gst_rate,
                    reorder_level,
                    reorder_quantity,
                    chrono::Utc::now().to_rfc3339(),
                    id
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if changed == 0 {
            return Err(AppError::Validation("Medicine not found.".to_string()));
        }

        Ok(())
    }

    pub fn list_medicine_batches(&self, medicine_id: i64) -> Result<Vec<BatchDto>, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT
                    id,
                    medicine_id,
                    batch_number,
                    barcode,
                    expiry_date,
                    purchase_price,
                    selling_price,
                    quantity_in,
                    quantity_sold,
                    quantity_adjusted,
                    (quantity_in - quantity_sold - quantity_adjusted) AS quantity_on_hand,
                    rack_location,
                    is_active
                 FROM batches
                 WHERE medicine_id = ?1 AND is_active = 1
                 ORDER BY expiry_date ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![medicine_id], |row| {
                Ok(BatchDto {
                    id: row.get(0)?,
                    medicine_id: row.get(1)?,
                    batch_number: row.get(2)?,
                    barcode: row.get(3)?,
                    expiry_date: row.get(4)?,
                    purchase_price: row.get(5)?,
                    selling_price: row.get(6)?,
                    quantity_in: row.get(7)?,
                    quantity_sold: row.get(8)?,
                    quantity_adjusted: row.get(9)?,
                    quantity_on_hand: row.get(10)?,
                    rack_location: row.get(11)?,
                    is_active: row.get::<_, i64>(12)? == 1,
                })
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut batches = Vec::new();
        for row in rows {
            batches.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(batches)
    }

    pub fn create_medicine_batch(
        &self,
        medicine_id: i64,
        batch_number: &str,
        expiry_date: &str,
        purchase_price: f64,
        selling_price: f64,
        quantity_in: i64,
        rack_location: Option<&str>,
    ) -> Result<i64, AppError> {
        let conn = self.connection()?;
        let cleaned_batch = batch_number.trim();
        let barcode = format!(
            "MED{}-{}",
            format!("{:05}", medicine_id),
            cleaned_batch
                .chars()
                .filter(|c| c.is_ascii_alphanumeric())
                .collect::<String>()
                .to_uppercase()
        );

        conn.execute(
            "INSERT INTO batches (
                medicine_id,
                batch_number,
                barcode,
                expiry_date,
                purchase_price,
                selling_price,
                quantity_in,
                quantity_sold,
                quantity_adjusted,
                rack_location,
                is_active
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0, ?8, 1)",
            params![
                medicine_id,
                cleaned_batch,
                barcode,
                expiry_date.trim(),
                purchase_price,
                selling_price,
                quantity_in,
                rack_location.map(|v| v.trim()).filter(|v| !v.is_empty())
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(conn.last_insert_rowid())
    }

    pub fn delete_medicine(&self, id: i64) -> Result<(), AppError> {
        let conn = self.connection()?;
        let changed = conn
            .execute(
                "UPDATE medicines SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
                params![chrono::Utc::now().to_rfc3339(), id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if changed == 0 {
            return Err(AppError::Validation("Medicine not found.".to_string()));
        }

        Ok(())
    }

    pub fn get_batch_by_barcode(&self, barcode: &str) -> Result<BatchDto, AppError> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT
                id,
                medicine_id,
                batch_number,
                barcode,
                expiry_date,
                purchase_price,
                selling_price,
                quantity_in,
                quantity_sold,
                quantity_adjusted,
                (quantity_in - quantity_sold - quantity_adjusted) AS quantity_on_hand,
                rack_location,
                is_active
             FROM batches
             WHERE barcode = ?1 AND is_active = 1",
            params![barcode.trim()],
            |row| {
                Ok(BatchDto {
                    id: row.get(0)?,
                    medicine_id: row.get(1)?,
                    batch_number: row.get(2)?,
                    barcode: row.get(3)?,
                    expiry_date: row.get(4)?,
                    purchase_price: row.get(5)?,
                    selling_price: row.get(6)?,
                    quantity_in: row.get(7)?,
                    quantity_sold: row.get(8)?,
                    quantity_adjusted: row.get(9)?,
                    quantity_on_hand: row.get(10)?,
                    rack_location: row.get(11)?,
                    is_active: row.get::<_, i64>(12)? == 1,
                })
            },
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .ok_or(AppError::Validation("Batch not found.".to_string()))
    }

    pub fn update_medicine_batch(
        &self,
        batch_id: i64,
        expiry_date: &str,
        purchase_price: f64,
        selling_price: f64,
        rack_location: Option<&str>,
    ) -> Result<(), AppError> {
        let conn = self.connection()?;
        let changed = conn
            .execute(
                "UPDATE batches
                 SET expiry_date = ?1,
                     purchase_price = ?2,
                     selling_price = ?3,
                     rack_location = ?4,
                     updated_at = ?5
                 WHERE id = ?6 AND is_active = 1",
                params![
                    expiry_date.trim(),
                    purchase_price,
                    selling_price,
                    rack_location.map(|v| v.trim()).filter(|v| !v.is_empty()),
                    chrono::Utc::now().to_rfc3339(),
                    batch_id
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if changed == 0 {
            return Err(AppError::Validation("Batch not found.".to_string()));
        }

        Ok(())
    }

    fn connection(&self) -> Result<Connection, AppError> {
        let conn = Connection::open(&self.db_path).map_err(|e| AppError::Internal(e.to_string()))?;
        conn.execute_batch(
            "
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            ",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(conn)
    }

    fn run_migrations(&self, conn: &Connection) -> Result<(), AppError> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS schema_migrations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              version TEXT NOT NULL UNIQUE,
              applied_at TEXT NOT NULL
            );
            ",
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let already_applied: Option<String> = conn
            .query_row(
                "SELECT version FROM schema_migrations WHERE version = '001_initial'",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if already_applied.is_none() {
            conn.execute_batch(INITIAL_MIGRATION_SQL)
                .map_err(|e| AppError::Internal(e.to_string()))?;

            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
                params!["001_initial", chrono::Utc::now().to_rfc3339()],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        Ok(())
    }

    fn seed_default_user_if_needed(&self, conn: &Connection) -> Result<(), AppError> {
        let role_count: i64 = conn
            .query_row("SELECT COUNT(1) FROM roles", [], |row| row.get(0))
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if role_count == 0 {
            conn.execute(
                "INSERT INTO roles (name, permissions) VALUES (?1, ?2)",
                params!["admin", serde_json::json!(["*"]).to_string()],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

            conn.execute(
                "INSERT INTO roles (name, permissions) VALUES (?1, ?2)",
                params![
                    "pharmacist",
                    serde_json::json!([
                        "billing.create",
                        "medicine.read",
                        "medicine.update",
                        "inventory.read"
                    ])
                    .to_string()
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        let user_count: i64 = conn
            .query_row("SELECT COUNT(1) FROM users", [], |row| row.get(0))
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if user_count == 0 {
            let default_hash = hash("admin123", DEFAULT_COST)
                .map_err(|e| AppError::Internal(e.to_string()))?;

            conn.execute(
                "INSERT INTO users (name, email, role_id, password_hash, is_active, login_attempts)
                 VALUES (?1, ?2, ?3, ?4, 1, 0)",
                params!["admin", "admin", 1, default_hash],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        let category_count: i64 = conn
            .query_row("SELECT COUNT(1) FROM categories", [], |row| row.get(0))
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if category_count == 0 {
            let defaults = ["General", "Antibiotic", "Diabetes", "Cardiac", "Pain Relief"];
            for category in defaults {
                conn.execute("INSERT INTO categories (name) VALUES (?1)", params![category])
                    .map_err(|e| AppError::Internal(e.to_string()))?;
            }
        }

        Ok(())
    }
}
