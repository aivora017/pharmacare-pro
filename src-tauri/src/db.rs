use crate::commands::auth::UserDto;
use crate::commands::billing::CreateBillInput;
use crate::commands::customer::DoctorCreateInput;
use crate::commands::medicine::{BatchDto, CategoryDto, MedicineDetailDto, MedicineDto};
use crate::commands::purchase::PurchaseBillCreateInput;
use crate::commands::purchase::PurchaseReturnCreateInput;
use crate::commands::purchase::PurchaseOrderCreateInput;
use crate::commands::purchase::SupplierInput;
use crate::error::AppError;
use bcrypt::{hash, DEFAULT_COST};
use rusqlite::{params, Connection, OptionalExtension};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use tauri::AppHandle;
use zip::write::FileOptions;

const INITIAL_MIGRATION_SQL: &str = include_str!("../../src/db/migrations/001_initial.sql");
const PRINT_JOBS_MIGRATION_SQL: &str = include_str!("../../src/db/migrations/002_print_jobs.sql");

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

    #[cfg(test)]
    pub fn init_for_test(db_path: PathBuf) -> Result<Self, AppError> {
        let db = Self { db_path };
        let conn = db.connection()?;
        db.run_migrations(&conn)?;
        db.seed_default_user_if_needed(&conn)?;
        Ok(db)
    }

    #[cfg(test)]
    pub fn role_id_by_name(&self, role_name: &str) -> Result<i64, AppError> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT id FROM roles WHERE lower(name) = lower(?1)",
            params![role_name],
            |row| row.get(0),
        )
        .map_err(|e| AppError::Internal(e.to_string()))
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

    pub fn backup_create(&self, destination: Option<&str>) -> Result<String, AppError> {
        let backup_dir = if let Some(raw) = destination {
            let clean = raw.trim();
            if clean.is_empty() {
                std::env::current_dir()
                    .map_err(|e| AppError::Internal(e.to_string()))?
                    .join("backups")
            } else {
                PathBuf::from(clean)
            }
        } else {
            std::env::current_dir()
                .map_err(|e| AppError::Internal(e.to_string()))?
                .join("backups")
        };

        fs::create_dir_all(&backup_dir).map_err(|e| AppError::Internal(e.to_string()))?;

        let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let file_name = format!("pharmacare_backup_{}.db", stamp);
        let target = backup_dir.join(file_name);

        fs::copy(&self.db_path, &target).map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(target.to_string_lossy().to_string())
    }

    pub fn backup_list(&self) -> Result<Vec<serde_json::Value>, AppError> {
        let backup_dir = std::env::current_dir()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .join("backups");

        if !backup_dir.exists() {
            return Ok(vec![]);
        }

        let mut rows = Vec::new();
        let entries = fs::read_dir(&backup_dir).map_err(|e| AppError::Internal(e.to_string()))?;
        for entry in entries {
            let entry = entry.map_err(|e| AppError::Internal(e.to_string()))?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            if path.extension().and_then(|ext| ext.to_str()) != Some("db") {
                continue;
            }

            let metadata = entry
                .metadata()
                .map_err(|e| AppError::Internal(e.to_string()))?;

            rows.push(serde_json::json!({
                "file_name": path.file_name().and_then(|v| v.to_str()).unwrap_or_default(),
                "file_path": path.to_string_lossy().to_string(),
                "size_bytes": metadata.len(),
                "modified_at": metadata
                    .modified()
                    .ok()
                    .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or_default(),
            }));
        }

        rows.sort_by(|a, b| {
            let a_ts = a
                .get("modified_at")
                .and_then(|v| v.as_u64())
                .unwrap_or_default();
            let b_ts = b
                .get("modified_at")
                .and_then(|v| v.as_u64())
                .unwrap_or_default();
            b_ts.cmp(&a_ts)
        });

        Ok(rows)
    }

    pub fn backup_restore(&self, backup_path: &str, user_id: i64) -> Result<(), AppError> {
        let source = PathBuf::from(backup_path.trim());
        if !source.exists() || !source.is_file() {
            return Err(AppError::Validation("Backup file not found.".to_string()));
        }

        let pre_restore = self
            .db_path
            .with_file_name(format!("pharmacare_pre_restore_{}.db", chrono::Utc::now().format("%Y%m%d_%H%M%S")));
        let _ = fs::copy(&self.db_path, &pre_restore);

        fs::copy(&source, &self.db_path).map_err(|e| AppError::Internal(e.to_string()))?;

        self.write_audit_log(
            "BACKUP_RESTORE",
            "backup",
            &source.to_string_lossy(),
            None,
            Some(
                &serde_json::json!({
                    "restored_by": user_id,
                    "restored_at": chrono::Utc::now().to_rfc3339(),
                })
                .to_string(),
            ),
            &format!("user:{}", user_id),
        )?;

        Ok(())
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

        let loyalty_points_redeemed = input.loyalty_points_redeemed.unwrap_or(0).max(0);
        if loyalty_points_redeemed > 0 && input.customer_id.is_none() {
            return Err(AppError::Validation(
                "Select a customer to redeem loyalty points.".to_string(),
            ));
        }

        let loyalty_points_earned = if input.customer_id.is_some() {
            (net_amount / 100.0).floor() as i64
        } else {
            0
        };

        if let Some(customer_id) = input.customer_id {
            if loyalty_points_redeemed > 0 {
                let available_points: i64 = tx
                    .query_row(
                        "SELECT loyalty_points FROM customers WHERE id = ?1 AND is_active = 1",
                        params![customer_id],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(|e| AppError::Internal(e.to_string()))?
                    .ok_or_else(|| AppError::Validation("Customer not found.".to_string()))?;

                if available_points < loyalty_points_redeemed {
                    return Err(AppError::Validation(format!(
                        "Only {} loyalty points are available for redemption.",
                        available_points
                    )));
                }
            }
        }

        tx.execute(
            "INSERT INTO bills (
                bill_number, customer_id, doctor_id, bill_date, status, prescription_ref, prescription_image,
                subtotal, discount_amount, taxable_amount,
                cgst_amount, sgst_amount, igst_amount,
                total_amount, round_off, net_amount,
                amount_paid, change_returned, outstanding,
                loyalty_points_earned, loyalty_points_redeemed, notes, created_by
             ) VALUES (
                ?1, ?2, ?3, datetime('now'), 'active', ?4, ?5,
                ?6, ?7, ?8,
                ?9, ?10, ?11,
                ?12, ?13, ?14,
                ?15, ?16, ?17,
                ?18, ?19, ?20, ?21
             )",
            params![
                bill_number,
                input.customer_id,
                input.doctor_id,
                input.prescription_ref,
                input.prescription_image,
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
                loyalty_points_redeemed,
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
                     loyalty_points = loyalty_points + ?2 - ?3,
                     updated_at = datetime('now')
                 WHERE id = ?4",
                params![outstanding, loyalty_points_earned, loyalty_points_redeemed, customer_id],
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

    pub fn create_bill_return(
        &self,
        original_bill_id: i64,
        items: &serde_json::Value,
        reason: &str,
        user_id: i64,
    ) -> Result<i64, AppError> {
        #[derive(serde::Deserialize)]
        struct ReturnLineInput {
            bill_item_id: Option<i64>,
            batch_id: Option<i64>,
            quantity: i64,
        }

        let parsed_items: Vec<ReturnLineInput> = serde_json::from_value(items.clone())
            .map_err(|_| AppError::Validation("Invalid return items payload.".to_string()))?;

        if parsed_items.is_empty() {
            return Err(AppError::Validation(
                "At least one return item is required.".to_string(),
            ));
        }

        let mut conn = self.connection()?;
        let tx = conn
            .transaction()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let (bill_status, customer_id): (String, Option<i64>) = tx
            .query_row(
                "SELECT status, customer_id FROM bills WHERE id = ?1",
                params![original_bill_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Original bill not found.".to_string()))?;

        if bill_status != "active" {
            return Err(AppError::Validation(
                "Only active bills can be returned.".to_string(),
            ));
        }

        let month_key = chrono::Utc::now().format("%Y%m").to_string();
        let return_number_like = format!("SR-{}-%", month_key);
        let max_seq: i64 = tx
            .query_row(
                "SELECT COALESCE(MAX(CAST(SUBSTR(return_number, -5) AS INTEGER)), 0)
                 FROM sale_returns
                 WHERE return_number LIKE ?1",
                params![return_number_like],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let return_number = format!("SR-{}-{:05}", month_key, max_seq + 1);

        let mut total_amount = 0.0_f64;
        let mut resolved_lines: Vec<(i64, i64, i64, f64, f64, f64)> = Vec::new();

        for item in parsed_items {
            if item.quantity <= 0 {
                return Err(AppError::Validation(
                    "Return quantity must be greater than zero.".to_string(),
                ));
            }

            let bill_item_id = if let Some(id) = item.bill_item_id {
                id
            } else if let Some(batch_id) = item.batch_id {
                tx.query_row(
                    "SELECT id FROM bill_items WHERE bill_id = ?1 AND batch_id = ?2 ORDER BY id ASC LIMIT 1",
                    params![original_bill_id, batch_id],
                    |row| row.get::<_, i64>(0),
                )
                .optional()
                .map_err(|e| AppError::Internal(e.to_string()))?
                .ok_or_else(|| {
                    AppError::Validation("Return item does not belong to original bill.".to_string())
                })?
            } else {
                return Err(AppError::Validation(
                    "Each return item must include bill_item_id or batch_id.".to_string(),
                ));
            };

            let (source_bill_id, batch_id, sold_qty, unit_price, gst_rate, line_total):
                (i64, i64, i64, f64, f64, f64) = tx
                .query_row(
                    "SELECT bill_id, batch_id, quantity, unit_price, gst_rate, total_amount
                     FROM bill_items
                     WHERE id = ?1",
                    params![bill_item_id],
                    |row| {
                        Ok((
                            row.get(0)?,
                            row.get(1)?,
                            row.get(2)?,
                            row.get(3)?,
                            row.get(4)?,
                            row.get(5)?,
                        ))
                    },
                )
                .optional()
                .map_err(|e| AppError::Internal(e.to_string()))?
                .ok_or_else(|| AppError::Validation("Bill item not found for return.".to_string()))?;

            if source_bill_id != original_bill_id {
                return Err(AppError::Validation(
                    "Return item does not belong to original bill.".to_string(),
                ));
            }

            let already_returned: i64 = tx
                .query_row(
                    "SELECT COALESCE(SUM(sri.quantity), 0)
                     FROM sale_return_items sri
                     JOIN sale_returns sr ON sr.id = sri.return_id
                     WHERE sr.original_bill_id = ?1
                       AND sri.bill_item_id = ?2",
                    params![original_bill_id, bill_item_id],
                    |row| row.get(0),
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;

            if already_returned + item.quantity > sold_qty {
                return Err(AppError::Validation(
                    "Return quantity exceeds sold quantity for one of the items.".to_string(),
                ));
            }

            let per_unit_total = if sold_qty > 0 {
                line_total / sold_qty as f64
            } else {
                0.0
            };
            let return_total = per_unit_total * item.quantity as f64;
            total_amount += return_total;
            resolved_lines.push((bill_item_id, batch_id, item.quantity, unit_price, gst_rate, return_total));
        }

        tx.execute(
            "INSERT INTO sale_returns (
                return_number, original_bill_id, customer_id, return_date,
                reason, total_amount, refund_mode, created_by
             ) VALUES (?1, ?2, ?3, datetime('now'), ?4, ?5, ?6, ?7)",
            params![
                return_number,
                original_bill_id,
                customer_id,
                reason,
                total_amount,
                "cash",
                user_id,
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let return_id = tx.last_insert_rowid();

        for (bill_item_id, batch_id, quantity, unit_price, gst_rate, line_total) in resolved_lines {
            tx.execute(
                "INSERT INTO sale_return_items (
                    return_id, bill_item_id, batch_id, quantity, unit_price, gst_rate, total_amount
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    return_id,
                    bill_item_id,
                    batch_id,
                    quantity,
                    unit_price,
                    gst_rate,
                    line_total,
                ],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

            tx.execute(
                "UPDATE batches
                 SET quantity_sold = CASE WHEN quantity_sold - ?1 < 0 THEN 0 ELSE quantity_sold - ?1 END,
                     updated_at = datetime('now')
                 WHERE id = ?2",
                params![quantity, batch_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        }

        tx.execute(
            "INSERT INTO audit_log (user_id, user_name, action, module, record_id, old_value, new_value, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                user_id,
                format!("user:{}", user_id),
                "BILL_RETURN_CREATED",
                "billing",
                return_id.to_string(),
                Option::<String>::None,
                serde_json::json!({
                    "original_bill_id": original_bill_id,
                    "total_amount": total_amount,
                    "reason": reason,
                })
                .to_string(),
                chrono::Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        tx.commit().map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(return_id)
    }

    pub fn list_bill_returns(&self, limit: i64) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let safe_limit = limit.clamp(1, 100);

        let mut stmt = conn
            .prepare(
                "SELECT
                    sr.id,
                    sr.return_number,
                    sr.original_bill_id,
                    COALESCE(b.bill_number, '') AS original_bill_number,
                    sr.total_amount,
                    COALESCE(sr.reason, '') AS reason,
                    sr.return_date,
                    sr.created_at
                 FROM sale_returns sr
                 LEFT JOIN bills b ON b.id = sr.original_bill_id
                 ORDER BY datetime(sr.created_at) DESC, sr.id DESC
                 LIMIT ?1",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![safe_limit], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "return_number": row.get::<_, String>(1)?,
                    "original_bill_id": row.get::<_, i64>(2)?,
                    "original_bill_number": row.get::<_, String>(3)?,
                    "total_amount": row.get::<_, f64>(4)?,
                    "reason": row.get::<_, String>(5)?,
                    "return_date": row.get::<_, String>(6)?,
                    "created_at": row.get::<_, String>(7)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::Value::Array(items))
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

    pub fn ai_get_morning_briefing(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let low_stock_count: i64 = conn
            .query_row(
                "SELECT COUNT(1)
                 FROM medicines m
                 WHERE m.is_active = 1
                   AND m.deleted_at IS NULL
                   AND COALESCE((
                     SELECT SUM(b.quantity_in - b.quantity_sold - b.quantity_adjusted)
                     FROM batches b
                     WHERE b.medicine_id = m.id AND b.is_active = 1
                   ), 0) < m.reorder_level",
                [],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let expiry_count: i64 = conn
            .query_row(
                "SELECT COUNT(1)
                 FROM batches b
                 WHERE b.is_active = 1
                   AND (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0
                   AND date(b.expiry_date) <= date('now', '+30 day')",
                [],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let outstanding_customers: i64 = conn
            .query_row(
                "SELECT COUNT(1) FROM customers WHERE is_active = 1 AND outstanding_balance > 0",
                [],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut actions = Vec::new();
        if low_stock_count > 0 {
            actions.push(serde_json::json!({
                "priority": "urgent",
                "icon": "pill",
                "message": format!("{} medicines are below reorder level.", low_stock_count),
                "link": "/medicine"
            }));
        }
        if expiry_count > 0 {
            actions.push(serde_json::json!({
                "priority": "important",
                "icon": "alert",
                "message": format!("{} batches are expiring within 30 days.", expiry_count),
                "link": "/expiry"
            }));
        }
        if outstanding_customers > 0 {
            actions.push(serde_json::json!({
                "priority": "info",
                "icon": "users",
                "message": format!("{} customers have outstanding balances.", outstanding_customers),
                "link": "/customers"
            }));
        }
        if actions.is_empty() {
            actions.push(serde_json::json!({
                "priority": "info",
                "icon": "check",
                "message": "No urgent operational alerts this morning.",
                "link": "/dashboard"
            }));
        }

        Ok(serde_json::json!({ "actions": actions }))
    }

    pub fn ai_get_demand_forecast(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT
                    m.id,
                    m.name,
                    COALESCE(SUM(CASE WHEN date(b.bill_date) >= date('now', '-30 day') THEN bi.quantity ELSE 0 END), 0) AS qty_30,
                    COALESCE(SUM(CASE WHEN date(b.bill_date) >= date('now', '-90 day') THEN bi.quantity ELSE 0 END), 0) AS qty_90,
                    COALESCE(SUM(bt.quantity_in - bt.quantity_sold - bt.quantity_adjusted), 0) AS current_stock
                 FROM medicines m
                 LEFT JOIN bill_items bi ON bi.medicine_id = m.id
                 LEFT JOIN bills b ON b.id = bi.bill_id AND b.status = 'active'
                 LEFT JOIN batches bt ON bt.medicine_id = m.id AND bt.is_active = 1
                 WHERE m.is_active = 1 AND m.deleted_at IS NULL
                 GROUP BY m.id, m.name
                 ORDER BY qty_30 DESC
                 LIMIT 30",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mapped = stmt
            .query_map([], |row| {
                let qty_30 = row.get::<_, i64>(2)? as f64;
                let qty_90 = row.get::<_, i64>(3)? as f64;
                let current_stock = row.get::<_, i64>(4)?;
                let forecast_30 = ((qty_90 / 3.0) * 1.1).round() as i64;
                let recommended_order = (forecast_30 - current_stock).max(0);
                let trend = if qty_30 > (qty_90 / 3.0) * 1.1 {
                    "up"
                } else if qty_30 < (qty_90 / 3.0) * 0.9 {
                    "down"
                } else {
                    "stable"
                };

                Ok(serde_json::json!({
                    "medicine_id": row.get::<_, i64>(0)?,
                    "medicine_name": row.get::<_, String>(1)?,
                    "current_stock": current_stock,
                    "forecast_30day": forecast_30,
                    "recommended_order": recommended_order,
                    "confidence": if qty_90 > 0.0 { 0.72 } else { 0.4 },
                    "trend": trend,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut rows = Vec::new();
        for row in mapped {
            rows.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }
        Ok(serde_json::Value::Array(rows))
    }

    pub fn ai_get_expiry_risks(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT
                    b.id,
                    CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_to_expiry,
                    (b.quantity_in - b.quantity_sold - b.quantity_adjusted) AS qty_on_hand
                 FROM batches b
                 WHERE b.is_active = 1
                   AND (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mapped = stmt
            .query_map([], |row| {
                let days = row.get::<_, i64>(1)?;
                let qty = row.get::<_, i64>(2)?;
                let risk_score = if days <= 0 {
                    95.0
                } else if days <= 30 {
                    80.0 + (qty as f64 / 10.0).min(15.0)
                } else if days <= 90 {
                    50.0 + (qty as f64 / 20.0).min(20.0)
                } else {
                    20.0 + (qty as f64 / 40.0).min(20.0)
                };
                let level = if risk_score >= 85.0 {
                    "critical"
                } else if risk_score >= 70.0 {
                    "high"
                } else if risk_score >= 45.0 {
                    "medium"
                } else {
                    "low"
                };

                Ok(serde_json::json!({
                    "batch_id": row.get::<_, i64>(0)?,
                    "risk_score": risk_score,
                    "risk_level": level,
                    "sellable_days": days,
                    "action_suggested": if level == "critical" { "Return/discount immediately" } else if level == "high" { "Promote fast moving sale" } else { "Monitor" },
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut rows = Vec::new();
        for row in mapped {
            rows.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }
        Ok(serde_json::Value::Array(rows))
    }

    pub fn ai_get_customer_segments(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let mut stmt = conn
            .prepare(
                "SELECT
                    c.id,
                    c.name,
                    COALESCE(MAX(date(b.bill_date)), ''),
                    COALESCE(SUM(CASE WHEN date(b.bill_date) >= date('now', '-90 day') THEN b.net_amount ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN date(b.bill_date) >= date('now', '-90 day') THEN 1 ELSE 0 END), 0),
                    COALESCE(CAST(julianday('now') - julianday(MAX(date(b.bill_date))) AS INTEGER), 999)
                 FROM customers c
                 LEFT JOIN bills b ON b.customer_id = c.id AND b.status = 'active'
                 WHERE c.is_active = 1
                 GROUP BY c.id, c.name
                 ORDER BY c.name ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mapped = stmt
            .query_map([], |row| {
                let spend_90 = row.get::<_, f64>(3)?;
                let count_90 = row.get::<_, i64>(4)?;
                let days_since = row.get::<_, i64>(5)?;

                let segment = if count_90 >= 6 && spend_90 >= 5000.0 {
                    "champion"
                } else if count_90 >= 3 {
                    "loyal"
                } else if days_since > 90 {
                    "dormant"
                } else if days_since > 45 {
                    "at_risk"
                } else {
                    "new"
                };

                Ok(serde_json::json!({
                    "customer_id": row.get::<_, i64>(0)?,
                    "customer_name": row.get::<_, String>(1)?,
                    "segment": segment,
                    "last_purchase_days": days_since,
                    "avg_monthly_spend": spend_90 / 3.0,
                    "purchase_count_90d": count_90,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut rows = Vec::new();
        for row in mapped {
            rows.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }
        Ok(serde_json::Value::Array(rows))
    }

    pub fn ai_get_anomalies(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let mut anomalies = Vec::new();

        let mut discount_stmt = conn
            .prepare(
                "SELECT id, bill_id, medicine_name, discount_percent
                 FROM bill_items
                 WHERE discount_percent >= 35
                 ORDER BY discount_percent DESC
                 LIMIT 25",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let discount_rows = discount_stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "anomaly_type": "high_discount",
                    "severity": "medium",
                    "description": format!(
                        "Bill item {} in bill {} has high discount ({}%).",
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, f64>(3)?
                    ),
                    "record_type": "bill_item",
                    "record_id": row.get::<_, i64>(0)?,
                    "is_reviewed": false,
                    "detected_at": chrono::Utc::now().to_rfc3339(),
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;
        for row in discount_rows {
            anomalies.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        let mut below_cost_stmt = conn
            .prepare(
                "SELECT bi.id, bi.bill_id, bi.medicine_name, bi.unit_price, COALESCE(b.purchase_price, 0)
                 FROM bill_items bi
                 LEFT JOIN batches b ON b.id = bi.batch_id
                 WHERE bi.unit_price < COALESCE(b.purchase_price, 0)
                 ORDER BY bi.id DESC
                 LIMIT 25",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let below_cost_rows = below_cost_stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "anomaly_type": "below_cost_sale",
                    "severity": "high",
                    "description": format!(
                        "Bill item {} in bill {} sold below purchase cost.",
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(1)?
                    ),
                    "record_type": "bill_item",
                    "record_id": row.get::<_, i64>(0)?,
                    "is_reviewed": false,
                    "detected_at": chrono::Utc::now().to_rfc3339(),
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;
        for row in below_cost_rows {
            anomalies.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::Value::Array(anomalies))
    }

    pub fn reports_sales(
        &self,
        from_date: &str,
        to_date: &str,
    ) -> Result<serde_json::Value, AppError> {
        let from = from_date.trim();
        let to = to_date.trim();

        if from.is_empty() || to.is_empty() {
            return Err(AppError::Validation(
                "From date and to date are required.".to_string(),
            ));
        }

        let conn = self.connection()?;

        let (total_bills, total_quantity, gross_sales, total_discount, net_sales, avg_bill_value):
            (i64, i64, f64, f64, f64, f64) = conn
            .query_row(
                "SELECT
                    COUNT(1),
                    COALESCE(SUM((SELECT COALESCE(SUM(quantity), 0) FROM bill_items bi WHERE bi.bill_id = b.id)), 0),
                    COALESCE(SUM(b.total_amount), 0),
                    COALESCE(SUM(b.discount_amount), 0),
                    COALESCE(SUM(b.net_amount), 0),
                    COALESCE(AVG(b.net_amount), 0)
                 FROM bills b
                 WHERE b.status = 'active'
                   AND date(b.bill_date) BETWEEN date(?1) AND date(?2)",
                params![from, to],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut daily_stmt = conn
            .prepare(
                "SELECT
                    date(b.bill_date) AS report_date,
                    COUNT(1) AS bill_count,
                    COALESCE(SUM(b.net_amount), 0) AS net_sales,
                    COALESCE(SUM(b.total_amount), 0) AS gross_sales,
                    COALESCE(SUM(b.discount_amount), 0) AS discount_amount
                 FROM bills b
                 WHERE b.status = 'active'
                   AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
                 GROUP BY date(b.bill_date)
                 ORDER BY report_date ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let daily_rows = daily_stmt
            .query_map(params![from, to], |row| {
                Ok(serde_json::json!({
                    "report_date": row.get::<_, String>(0)?,
                    "bill_count": row.get::<_, i64>(1)?,
                    "net_sales": row.get::<_, f64>(2)?,
                    "gross_sales": row.get::<_, f64>(3)?,
                    "discount_amount": row.get::<_, f64>(4)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut daily = Vec::new();
        for row in daily_rows {
            daily.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        let mut payment_stmt = conn
            .prepare(
                "SELECT
                    p.payment_mode,
                    COALESCE(SUM(p.amount), 0) AS total_amount
                 FROM payments p
                 JOIN bills b ON b.id = p.bill_id
                 WHERE b.status = 'active'
                   AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
                 GROUP BY p.payment_mode
                 ORDER BY total_amount DESC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let payment_rows = payment_stmt
            .query_map(params![from, to], |row| {
                Ok(serde_json::json!({
                    "payment_mode": row.get::<_, String>(0)?,
                    "total_amount": row.get::<_, f64>(1)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut payment_breakdown = Vec::new();
        for row in payment_rows {
            payment_breakdown.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        let mut top_medicine_stmt = conn
            .prepare(
                "SELECT
                    bi.medicine_name,
                    COALESCE(SUM(bi.quantity), 0) AS total_quantity,
                    COALESCE(SUM(bi.total_amount), 0) AS total_amount
                 FROM bill_items bi
                 JOIN bills b ON b.id = bi.bill_id
                 WHERE b.status = 'active'
                   AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
                 GROUP BY bi.medicine_name
                 ORDER BY total_amount DESC
                 LIMIT 10",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let top_medicine_rows = top_medicine_stmt
            .query_map(params![from, to], |row| {
                Ok(serde_json::json!({
                    "medicine_name": row.get::<_, String>(0)?,
                    "total_quantity": row.get::<_, i64>(1)?,
                    "total_amount": row.get::<_, f64>(2)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut top_medicines = Vec::new();
        for row in top_medicine_rows {
            top_medicines.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "summary": {
                "from_date": from,
                "to_date": to,
                "total_bills": total_bills,
                "total_quantity": total_quantity,
                "gross_sales": gross_sales,
                "total_discount": total_discount,
                "net_sales": net_sales,
                "avg_bill_value": avg_bill_value,
            },
            "daily": daily,
            "payment_breakdown": payment_breakdown,
            "top_medicines": top_medicines,
        }))
    }

    pub fn reports_purchase(
        &self,
        from_date: &str,
        to_date: &str,
        supplier_id: Option<i64>,
    ) -> Result<serde_json::Value, AppError> {
        let from = from_date.trim();
        let to = to_date.trim();

        if from.is_empty() || to.is_empty() {
            return Err(AppError::Validation(
                "From date and to date are required.".to_string(),
            ));
        }

        let conn = self.connection()?;

        let (
            total_bills,
            total_quantity,
            gross_purchase,
            total_discount,
            net_purchase,
            avg_bill_value,
        ): (i64, i64, f64, f64, f64, f64) = conn
            .query_row(
                "SELECT
                    COUNT(1),
                    COALESCE(SUM((SELECT COALESCE(SUM(quantity + free_quantity), 0) FROM purchase_bill_items pbi WHERE pbi.purchase_bill_id = pb.id)), 0),
                    COALESCE(SUM(pb.subtotal), 0),
                    COALESCE(SUM(pb.discount_amount), 0),
                    COALESCE(SUM(pb.total_amount), 0),
                    COALESCE(AVG(pb.total_amount), 0)
                 FROM purchase_bills pb
                 WHERE date(pb.bill_date) BETWEEN date(?1) AND date(?2)
                   AND (?3 IS NULL OR pb.supplier_id = ?3)",
                params![from, to, supplier_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut daily_stmt = conn
            .prepare(
                "SELECT
                    date(pb.bill_date) AS report_date,
                    COUNT(1) AS bill_count,
                    COALESCE(SUM(pb.total_amount), 0) AS net_purchase,
                    COALESCE(SUM(pb.subtotal), 0) AS gross_purchase,
                    COALESCE(SUM(pb.discount_amount), 0) AS discount_amount
                 FROM purchase_bills pb
                 WHERE date(pb.bill_date) BETWEEN date(?1) AND date(?2)
                   AND (?3 IS NULL OR pb.supplier_id = ?3)
                 GROUP BY date(pb.bill_date)
                 ORDER BY report_date ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let daily_rows = daily_stmt
            .query_map(params![from, to, supplier_id], |row| {
                Ok(serde_json::json!({
                    "report_date": row.get::<_, String>(0)?,
                    "bill_count": row.get::<_, i64>(1)?,
                    "net_purchase": row.get::<_, f64>(2)?,
                    "gross_purchase": row.get::<_, f64>(3)?,
                    "discount_amount": row.get::<_, f64>(4)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut daily = Vec::new();
        for row in daily_rows {
            daily.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        let mut supplier_stmt = conn
            .prepare(
                "SELECT
                    pb.supplier_id,
                    COALESCE(s.name, 'Unknown Supplier') AS supplier_name,
                    COUNT(1) AS bill_count,
                    COALESCE(SUM(pb.total_amount), 0) AS total_amount
                 FROM purchase_bills pb
                 LEFT JOIN suppliers s ON s.id = pb.supplier_id
                 WHERE date(pb.bill_date) BETWEEN date(?1) AND date(?2)
                   AND (?3 IS NULL OR pb.supplier_id = ?3)
                 GROUP BY pb.supplier_id, COALESCE(s.name, 'Unknown Supplier')
                 ORDER BY total_amount DESC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let supplier_rows = supplier_stmt
            .query_map(params![from, to, supplier_id], |row| {
                Ok(serde_json::json!({
                    "supplier_id": row.get::<_, i64>(0)?,
                    "supplier_name": row.get::<_, String>(1)?,
                    "bill_count": row.get::<_, i64>(2)?,
                    "total_amount": row.get::<_, f64>(3)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut supplier_breakdown = Vec::new();
        for row in supplier_rows {
            supplier_breakdown.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        let mut top_medicine_stmt = conn
            .prepare(
                "SELECT
                    COALESCE(m.name, pbi.batch_number) AS medicine_name,
                    COALESCE(SUM(pbi.quantity + pbi.free_quantity), 0) AS total_quantity,
                    COALESCE(SUM(pbi.total_amount), 0) AS total_amount
                 FROM purchase_bill_items pbi
                 JOIN purchase_bills pb ON pb.id = pbi.purchase_bill_id
                 LEFT JOIN medicines m ON m.id = pbi.medicine_id
                 WHERE date(pb.bill_date) BETWEEN date(?1) AND date(?2)
                   AND (?3 IS NULL OR pb.supplier_id = ?3)
                 GROUP BY COALESCE(m.name, pbi.batch_number)
                 ORDER BY total_amount DESC
                 LIMIT 10",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let top_medicine_rows = top_medicine_stmt
            .query_map(params![from, to, supplier_id], |row| {
                Ok(serde_json::json!({
                    "medicine_name": row.get::<_, String>(0)?,
                    "total_quantity": row.get::<_, i64>(1)?,
                    "total_amount": row.get::<_, f64>(2)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut top_medicines = Vec::new();
        for row in top_medicine_rows {
            top_medicines.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "summary": {
                "from_date": from,
                "to_date": to,
                "total_bills": total_bills,
                "total_quantity": total_quantity,
                "gross_purchase": gross_purchase,
                "total_discount": total_discount,
                "net_purchase": net_purchase,
                "avg_bill_value": avg_bill_value,
            },
            "daily": daily,
            "supplier_breakdown": supplier_breakdown,
            "top_medicines": top_medicines,
        }))
    }

    pub fn reports_stock(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let (total_lines, total_units, purchase_value, selling_value): (i64, i64, f64, f64) = conn
            .query_row(
                "SELECT
                    COUNT(1),
                    COALESCE(SUM(CASE WHEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0 THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0 THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) * b.purchase_price ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0 THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) * b.selling_price ELSE 0 END), 0)
                 FROM batches b
                 WHERE b.is_active = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn
            .prepare(
                "SELECT
                    m.id,
                    m.name,
                    COALESCE(SUM(CASE WHEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0 THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) ELSE 0 END), 0) AS qty_on_hand,
                    COALESCE(SUM(CASE WHEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0 THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) * b.purchase_price ELSE 0 END), 0) AS purchase_value,
                    COALESCE(SUM(CASE WHEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0 THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) * b.selling_price ELSE 0 END), 0) AS selling_value,
                    COUNT(b.id) AS batch_count
                 FROM medicines m
                 JOIN batches b ON b.medicine_id = m.id
                 WHERE m.deleted_at IS NULL
                   AND m.is_active = 1
                   AND b.is_active = 1
                 GROUP BY m.id, m.name
                 HAVING qty_on_hand > 0
                 ORDER BY purchase_value DESC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "medicine_id": row.get::<_, i64>(0)?,
                    "medicine_name": row.get::<_, String>(1)?,
                    "quantity_on_hand": row.get::<_, i64>(2)?,
                    "purchase_value": row.get::<_, f64>(3)?,
                    "selling_value": row.get::<_, f64>(4)?,
                    "batch_count": row.get::<_, i64>(5)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "summary": {
                "total_lines": total_lines,
                "total_units": total_units,
                "purchase_value": purchase_value,
                "selling_value": selling_value,
                "estimated_margin": selling_value - purchase_value,
            },
            "items": items,
        }))
    }

    pub fn reports_gst(&self, from_date: &str, to_date: &str) -> Result<serde_json::Value, AppError> {
        let from = from_date.trim();
        let to = to_date.trim();

        if from.is_empty() || to.is_empty() {
            return Err(AppError::Validation(
                "From date and to date are required.".to_string(),
            ));
        }

        let conn = self.connection()?;

        let (taxable_amount, cgst_amount, sgst_amount, igst_amount, total_invoice_value):
            (f64, f64, f64, f64, f64) = conn
            .query_row(
                "SELECT
                    COALESCE(SUM(b.taxable_amount), 0),
                    COALESCE(SUM(b.cgst_amount), 0),
                    COALESCE(SUM(b.sgst_amount), 0),
                    COALESCE(SUM(b.igst_amount), 0),
                    COALESCE(SUM(b.net_amount), 0)
                 FROM bills b
                 WHERE b.status = 'active'
                   AND date(b.bill_date) BETWEEN date(?1) AND date(?2)",
                params![from, to],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut daily_stmt = conn
            .prepare(
                "SELECT
                    date(b.bill_date) AS report_date,
                    COUNT(1) AS bill_count,
                    COALESCE(SUM(b.taxable_amount), 0) AS taxable_amount,
                    COALESCE(SUM(b.cgst_amount), 0) AS cgst_amount,
                    COALESCE(SUM(b.sgst_amount), 0) AS sgst_amount,
                    COALESCE(SUM(b.igst_amount), 0) AS igst_amount,
                    COALESCE(SUM(b.net_amount), 0) AS invoice_value
                 FROM bills b
                 WHERE b.status = 'active'
                   AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
                 GROUP BY date(b.bill_date)
                 ORDER BY report_date ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let daily_rows = daily_stmt
            .query_map(params![from, to], |row| {
                Ok(serde_json::json!({
                    "report_date": row.get::<_, String>(0)?,
                    "bill_count": row.get::<_, i64>(1)?,
                    "taxable_amount": row.get::<_, f64>(2)?,
                    "cgst_amount": row.get::<_, f64>(3)?,
                    "sgst_amount": row.get::<_, f64>(4)?,
                    "igst_amount": row.get::<_, f64>(5)?,
                    "invoice_value": row.get::<_, f64>(6)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut daily = Vec::new();
        for row in daily_rows {
            daily.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        let mut hsn_stmt = conn
            .prepare(
                "SELECT
                    COALESCE(NULLIF(TRIM(COALESCE(m.hsn_code, '')), ''), 'UNKNOWN') AS hsn_code,
                    COUNT(DISTINCT bi.bill_id) AS bill_count,
                    COALESCE(SUM(bi.total_amount - bi.cgst_amount - bi.sgst_amount - bi.igst_amount), 0) AS taxable_amount,
                    COALESCE(SUM(bi.cgst_amount), 0) AS cgst_amount,
                    COALESCE(SUM(bi.sgst_amount), 0) AS sgst_amount,
                    COALESCE(SUM(bi.igst_amount), 0) AS igst_amount,
                    COALESCE(SUM(bi.total_amount), 0) AS total_amount
                 FROM bill_items bi
                 JOIN bills b ON b.id = bi.bill_id
                 LEFT JOIN medicines m ON m.id = bi.medicine_id
                 WHERE b.status = 'active'
                   AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
                 GROUP BY hsn_code
                 ORDER BY total_amount DESC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let hsn_rows = hsn_stmt
            .query_map(params![from, to], |row| {
                Ok(serde_json::json!({
                    "hsn_code": row.get::<_, String>(0)?,
                    "bill_count": row.get::<_, i64>(1)?,
                    "taxable_amount": row.get::<_, f64>(2)?,
                    "cgst_amount": row.get::<_, f64>(3)?,
                    "sgst_amount": row.get::<_, f64>(4)?,
                    "igst_amount": row.get::<_, f64>(5)?,
                    "total_amount": row.get::<_, f64>(6)?,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut hsn_summary = Vec::new();
        for row in hsn_rows {
            hsn_summary.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "summary": {
                "from_date": from,
                "to_date": to,
                "taxable_amount": taxable_amount,
                "cgst_amount": cgst_amount,
                "sgst_amount": sgst_amount,
                "igst_amount": igst_amount,
                "total_gst": cgst_amount + sgst_amount + igst_amount,
                "total_invoice_value": total_invoice_value,
            },
            "daily": daily,
            "hsn_summary": hsn_summary,
        }))
    }

    pub fn reports_profit_loss(
        &self,
        from_date: &str,
        to_date: &str,
    ) -> Result<serde_json::Value, AppError> {
        let from = from_date.trim();
        let to = to_date.trim();

        if from.is_empty() || to.is_empty() {
            return Err(AppError::Validation(
                "From date and to date are required.".to_string(),
            ));
        }

        let conn = self.connection()?;

        let (revenue, discounts, estimated_cogs): (f64, f64, f64) = conn
            .query_row(
                "SELECT
                    COALESCE(SUM(b.net_amount), 0) AS revenue,
                    COALESCE(SUM(b.discount_amount), 0) AS discounts,
                    COALESCE(SUM(bi.quantity * COALESCE(bt.purchase_price, 0)), 0) AS estimated_cogs
                 FROM bills b
                 LEFT JOIN bill_items bi ON bi.bill_id = b.id
                 LEFT JOIN batches bt ON bt.id = bi.batch_id
                 WHERE b.status = 'active'
                   AND date(b.bill_date) BETWEEN date(?1) AND date(?2)",
                params![from, to],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let purchase_expense: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(pb.total_amount), 0)
                 FROM purchase_bills pb
                 WHERE date(pb.bill_date) BETWEEN date(?1) AND date(?2)",
                params![from, to],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let gross_profit = revenue - estimated_cogs;
        let net_profit = gross_profit - (purchase_expense * 0.0);
        let gross_margin_pct = if revenue > 0.0 {
            (gross_profit / revenue) * 100.0
        } else {
            0.0
        };

        let mut daily_stmt = conn
            .prepare(
                "SELECT
                    date(b.bill_date) AS report_date,
                    COALESCE(SUM(b.net_amount), 0) AS revenue,
                    COALESCE(SUM(b.discount_amount), 0) AS discounts,
                    COALESCE(SUM(bi.quantity * COALESCE(bt.purchase_price, 0)), 0) AS estimated_cogs
                 FROM bills b
                 LEFT JOIN bill_items bi ON bi.bill_id = b.id
                 LEFT JOIN batches bt ON bt.id = bi.batch_id
                 WHERE b.status = 'active'
                   AND date(b.bill_date) BETWEEN date(?1) AND date(?2)
                 GROUP BY date(b.bill_date)
                 ORDER BY report_date ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let daily_rows = daily_stmt
            .query_map(params![from, to], |row| {
                let revenue_row = row.get::<_, f64>(1)?;
                let cogs_row = row.get::<_, f64>(3)?;
                let gross_profit_row = revenue_row - cogs_row;
                let gross_margin_pct_row = if revenue_row > 0.0 {
                    (gross_profit_row / revenue_row) * 100.0
                } else {
                    0.0
                };

                Ok(serde_json::json!({
                    "report_date": row.get::<_, String>(0)?,
                    "revenue": revenue_row,
                    "discounts": row.get::<_, f64>(2)?,
                    "estimated_cogs": cogs_row,
                    "gross_profit": gross_profit_row,
                    "gross_margin_pct": gross_margin_pct_row,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut daily = Vec::new();
        for row in daily_rows {
            daily.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "summary": {
                "from_date": from,
                "to_date": to,
                "revenue": revenue,
                "discounts": discounts,
                "estimated_cogs": estimated_cogs,
                "gross_profit": gross_profit,
                "purchase_expense": purchase_expense,
                "net_profit": net_profit,
                "gross_margin_pct": gross_margin_pct,
            },
            "daily": daily,
        }))
    }

    pub fn reports_expiry_writeoff(
        &self,
        from_date: &str,
        to_date: &str,
    ) -> Result<serde_json::Value, AppError> {
        let from = from_date.trim();
        let to = to_date.trim();

        if from.is_empty() || to.is_empty() {
            return Err(AppError::Validation(
                "From date and to date are required.".to_string(),
            ));
        }

        let conn = self.connection()?;

        let (expired_lines, near_expiry_lines, expired_stock_value, near_expiry_stock_value):
            (i64, i64, f64, f64) = conn
            .query_row(
                "SELECT
                    COALESCE(SUM(CASE WHEN date(b.expiry_date) < date('now') THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN date(b.expiry_date) >= date('now') AND date(b.expiry_date) <= date('now', '+90 day') THEN 1 ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN date(b.expiry_date) < date('now')
                        THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) * b.purchase_price ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN date(b.expiry_date) >= date('now') AND date(b.expiry_date) <= date('now', '+90 day')
                        THEN (b.quantity_in - b.quantity_sold - b.quantity_adjusted) * b.purchase_price ELSE 0 END), 0)
                 FROM batches b
                 WHERE b.is_active = 1
                   AND (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let writeoff_value: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(sa.quantity * COALESCE(b.purchase_price, 0)), 0)
                 FROM stock_adjustments sa
                 JOIN batches b ON b.id = sa.batch_id
                 WHERE sa.adjustment_type IN ('expired', 'damage', 'theft')
                   AND date(sa.created_at) BETWEEN date(?1) AND date(?2)",
                params![from, to],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn
            .prepare(
                "SELECT
                    m.name,
                    b.batch_number,
                    b.expiry_date,
                    (b.quantity_in - b.quantity_sold - b.quantity_adjusted) AS quantity_on_hand,
                    (b.quantity_in - b.quantity_sold - b.quantity_adjusted) * b.purchase_price AS purchase_value,
                    CAST(julianday(b.expiry_date) - julianday('now') AS INTEGER) AS days_to_expiry
                 FROM batches b
                 JOIN medicines m ON m.id = b.medicine_id
                 WHERE b.is_active = 1
                   AND (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0
                   AND date(b.expiry_date) BETWEEN date(?1) AND date(?2)
                 ORDER BY date(b.expiry_date) ASC, m.name ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![from, to], |row| {
                let days: i64 = row.get(5)?;
                let status = if days < 0 {
                    "expired"
                } else if days <= 90 {
                    "near_expiry"
                } else {
                    "ok"
                };

                Ok(serde_json::json!({
                    "medicine_name": row.get::<_, String>(0)?,
                    "batch_number": row.get::<_, String>(1)?,
                    "expiry_date": row.get::<_, String>(2)?,
                    "quantity_on_hand": row.get::<_, i64>(3)?,
                    "purchase_value": row.get::<_, f64>(4)?,
                    "days_to_expiry": days,
                    "status": status,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "summary": {
                "from_date": from,
                "to_date": to,
                "expired_lines": expired_lines,
                "near_expiry_lines": near_expiry_lines,
                "expired_stock_value": expired_stock_value,
                "near_expiry_stock_value": near_expiry_stock_value,
                "writeoff_value": writeoff_value,
            },
            "items": items,
        }))
    }

    pub fn reports_customer_outstanding(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let (total_customers, total_outstanding, over_30_days, over_90_days): (i64, f64, f64, f64) =
            conn.query_row(
                "SELECT
                    COUNT(1),
                    COALESCE(SUM(c.outstanding_balance), 0),
                    COALESCE(SUM(CASE WHEN CAST(julianday('now') - julianday(lb.last_bill_date) AS INTEGER) > 30 THEN c.outstanding_balance ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN CAST(julianday('now') - julianday(lb.last_bill_date) AS INTEGER) > 90 THEN c.outstanding_balance ELSE 0 END), 0)
                 FROM customers c
                 LEFT JOIN (
                    SELECT b.customer_id, MAX(date(b.bill_date)) AS last_bill_date
                    FROM bills b
                    WHERE b.customer_id IS NOT NULL
                    GROUP BY b.customer_id
                 ) lb ON lb.customer_id = c.id
                 WHERE c.is_active = 1
                   AND c.outstanding_balance > 0",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn
            .prepare(
                "SELECT
                    c.id,
                    c.name,
                    COALESCE(c.phone, ''),
                    c.outstanding_balance,
                    COALESCE(lb.last_bill_date, ''),
                    COALESCE(CAST(julianday('now') - julianday(lb.last_bill_date) AS INTEGER), 0) AS days_since_last_bill
                 FROM customers c
                 LEFT JOIN (
                    SELECT b.customer_id, MAX(date(b.bill_date)) AS last_bill_date
                    FROM bills b
                    WHERE b.customer_id IS NOT NULL
                    GROUP BY b.customer_id
                 ) lb ON lb.customer_id = c.id
                 WHERE c.is_active = 1
                   AND c.outstanding_balance > 0
                 ORDER BY c.outstanding_balance DESC, c.name ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mapped = stmt
            .query_map([], |row| {
                let days: i64 = row.get(5)?;
                let age_bucket = if days > 90 {
                    "90+"
                } else if days > 30 {
                    "31-90"
                } else {
                    "0-30"
                };

                Ok(serde_json::json!({
                    "customer_id": row.get::<_, i64>(0)?,
                    "customer_name": row.get::<_, String>(1)?,
                    "phone": row.get::<_, String>(2)?,
                    "outstanding_balance": row.get::<_, f64>(3)?,
                    "last_bill_date": row.get::<_, String>(4)?,
                    "days_since_last_bill": days,
                    "age_bucket": age_bucket,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut rows = Vec::new();
        for row in mapped {
            rows.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "summary": {
                "total_customers": total_customers,
                "total_outstanding": total_outstanding,
                "over_30_days": over_30_days,
                "over_90_days": over_90_days,
            },
            "rows": rows,
        }))
    }

    pub fn reports_supplier_outstanding(&self) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let (total_suppliers, total_outstanding, over_30_days, over_90_days): (i64, f64, f64, f64) =
            conn.query_row(
                "SELECT
                    COUNT(1),
                    COALESCE(SUM(s.outstanding_balance), 0),
                    COALESCE(SUM(CASE WHEN CAST(julianday('now') - julianday(lb.last_bill_date) AS INTEGER) > 30 THEN s.outstanding_balance ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN CAST(julianday('now') - julianday(lb.last_bill_date) AS INTEGER) > 90 THEN s.outstanding_balance ELSE 0 END), 0)
                 FROM suppliers s
                 LEFT JOIN (
                    SELECT pb.supplier_id, MAX(date(pb.bill_date)) AS last_bill_date
                    FROM purchase_bills pb
                    GROUP BY pb.supplier_id
                 ) lb ON lb.supplier_id = s.id
                 WHERE s.is_active = 1
                   AND s.outstanding_balance > 0",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn
            .prepare(
                "SELECT
                    s.id,
                    s.name,
                    COALESCE(s.phone, ''),
                    s.outstanding_balance,
                    COALESCE(lb.last_bill_date, ''),
                    COALESCE(CAST(julianday('now') - julianday(lb.last_bill_date) AS INTEGER), 0) AS days_since_last_bill
                 FROM suppliers s
                 LEFT JOIN (
                    SELECT pb.supplier_id, MAX(date(pb.bill_date)) AS last_bill_date
                    FROM purchase_bills pb
                    GROUP BY pb.supplier_id
                 ) lb ON lb.supplier_id = s.id
                 WHERE s.is_active = 1
                   AND s.outstanding_balance > 0
                 ORDER BY s.outstanding_balance DESC, s.name ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mapped = stmt
            .query_map([], |row| {
                let days: i64 = row.get(5)?;
                let age_bucket = if days > 90 {
                    "90+"
                } else if days > 30 {
                    "31-90"
                } else {
                    "0-30"
                };

                Ok(serde_json::json!({
                    "supplier_id": row.get::<_, i64>(0)?,
                    "supplier_name": row.get::<_, String>(1)?,
                    "phone": row.get::<_, String>(2)?,
                    "outstanding_balance": row.get::<_, f64>(3)?,
                    "last_bill_date": row.get::<_, String>(4)?,
                    "days_since_last_bill": days,
                    "age_bucket": age_bucket,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut rows = Vec::new();
        for row in mapped {
            rows.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "summary": {
                "total_suppliers": total_suppliers,
                "total_outstanding": total_outstanding,
                "over_30_days": over_30_days,
                "over_90_days": over_90_days,
            },
            "rows": rows,
        }))
    }

    pub fn reports_audit_log(
        &self,
        from_date: &str,
        to_date: &str,
        user_id: Option<i64>,
        module: Option<&str>,
        action: Option<&str>,
    ) -> Result<serde_json::Value, AppError> {
        let from = from_date.trim();
        let to = to_date.trim();

        if from.is_empty() || to.is_empty() {
            return Err(AppError::Validation(
                "From date and to date are required.".to_string(),
            ));
        }

        let module_filter = module
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let action_filter = action
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());

        let conn = self.connection()?;

        let (total_events, unique_users, unique_modules): (i64, i64, i64) = conn
            .query_row(
                "SELECT
                    COUNT(1),
                    COUNT(DISTINCT COALESCE(user_name, '')),
                    COUNT(DISTINCT COALESCE(module, ''))
                 FROM audit_log
                 WHERE date(created_at) BETWEEN date(?1) AND date(?2)
                   AND (?3 IS NULL OR user_id = ?3)
                   AND (?4 IS NULL OR lower(module) = lower(?4))
                   AND (?5 IS NULL OR lower(action) = lower(?5))",
                params![from, to, user_id, module_filter, action_filter],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut stmt = conn
            .prepare(
                "SELECT
                    id,
                    created_at,
                    COALESCE(user_name, 'Unknown'),
                    COALESCE(action, ''),
                    COALESCE(module, ''),
                    COALESCE(record_id, ''),
                    COALESCE(old_value, ''),
                    COALESCE(new_value, ''),
                    COALESCE(notes, '')
                 FROM audit_log
                 WHERE date(created_at) BETWEEN date(?1) AND date(?2)
                   AND (?3 IS NULL OR user_id = ?3)
                   AND (?4 IS NULL OR lower(module) = lower(?4))
                   AND (?5 IS NULL OR lower(action) = lower(?5))
                 ORDER BY datetime(created_at) DESC
                 LIMIT 1000",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mapped = stmt
            .query_map(
                params![from, to, user_id, module_filter, action_filter],
                |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, i64>(0)?,
                        "created_at": row.get::<_, String>(1)?,
                        "user_name": row.get::<_, String>(2)?,
                        "action": row.get::<_, String>(3)?,
                        "module": row.get::<_, String>(4)?,
                        "record_id": row.get::<_, String>(5)?,
                        "old_value": row.get::<_, String>(6)?,
                        "new_value": row.get::<_, String>(7)?,
                        "notes": row.get::<_, String>(8)?,
                    }))
                },
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut rows = Vec::new();
        for row in mapped {
            rows.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "summary": {
                "from_date": from,
                "to_date": to,
                "total_events": total_events,
                "unique_users": unique_users,
                "unique_modules": unique_modules,
            },
            "rows": rows,
        }))
    }

    pub fn reports_ca_package(&self, financial_year: &str) -> Result<String, AppError> {
        let (from_date, to_date, year_label) = Self::parse_financial_year(financial_year)?;

        let sales = self.reports_sales(&from_date, &to_date)?;
        let purchase = self.reports_purchase(&from_date, &to_date, None)?;
        let stock = self.reports_stock()?;
        let gst = self.reports_gst(&from_date, &to_date)?;
        let profit_loss = self.reports_profit_loss(&from_date, &to_date)?;
        let expiry_writeoff = self.reports_expiry_writeoff(&from_date, &to_date)?;
        let customer_outstanding = self.reports_customer_outstanding()?;
        let supplier_outstanding = self.reports_supplier_outstanding()?;
        let audit = self.reports_audit_log(&from_date, &to_date, None, None, None)?;

        let package_dir = std::env::temp_dir().join("pharmacare-pro").join("reports");
        fs::create_dir_all(&package_dir).map_err(|e| AppError::Internal(e.to_string()))?;

        let timestamp = chrono::Utc::now().format("%Y%m%d%H%M%S").to_string();
        let zip_path = package_dir.join(format!("ca_package_{}_{}.zip", year_label, timestamp));
        let zip_file = File::create(&zip_path).map_err(|e| AppError::Internal(e.to_string()))?;
        let mut zip = zip::ZipWriter::new(zip_file);
        let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        let readme = format!(
            "PharmaCare Pro CA Package\nFinancial Year: {}\nDate Range: {} to {}\nGenerated At (UTC): {}\n\nFiles include JSON report exports for sales, purchase, stock, GST, profit-loss and audit logs.\n",
            year_label,
            from_date,
            to_date,
            chrono::Utc::now().to_rfc3339()
        );

        zip.start_file("README.txt", options)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        zip.write_all(readme.as_bytes())
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let manifest = serde_json::json!({
            "financial_year": year_label,
            "from_date": from_date,
            "to_date": to_date,
            "generated_at": chrono::Utc::now().to_rfc3339(),
            "reports": [
                "sales.json",
                "purchase.json",
                "stock.json",
                "gst.json",
                "profit_loss.json",
                "expiry_writeoff.json",
                "customer_outstanding.json",
                "supplier_outstanding.json",
                "audit_log.json"
            ]
        });

        zip.start_file("manifest.json", options)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&manifest)
                .map_err(|e| AppError::Internal(e.to_string()))?
                .as_bytes(),
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Self::zip_json_file(&mut zip, "sales.json", &sales, options)?;
        Self::zip_json_file(&mut zip, "purchase.json", &purchase, options)?;
        Self::zip_json_file(&mut zip, "stock.json", &stock, options)?;
        Self::zip_json_file(&mut zip, "gst.json", &gst, options)?;
        Self::zip_json_file(&mut zip, "profit_loss.json", &profit_loss, options)?;
        Self::zip_json_file(&mut zip, "expiry_writeoff.json", &expiry_writeoff, options)?;
        Self::zip_json_file(
            &mut zip,
            "customer_outstanding.json",
            &customer_outstanding,
            options,
        )?;
        Self::zip_json_file(
            &mut zip,
            "supplier_outstanding.json",
            &supplier_outstanding,
            options,
        )?;
        Self::zip_json_file(&mut zip, "audit_log.json", &audit, options)?;

        zip.finish().map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(zip_path.to_string_lossy().to_string())
    }

    fn zip_json_file(
        zip: &mut zip::ZipWriter<File>,
        file_name: &str,
        value: &serde_json::Value,
        options: FileOptions,
    ) -> Result<(), AppError> {
        zip.start_file(file_name, options)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let bytes = serde_json::to_vec_pretty(value).map_err(|e| AppError::Internal(e.to_string()))?;
        zip.write_all(&bytes)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    fn parse_financial_year(financial_year: &str) -> Result<(String, String, String), AppError> {
        let trimmed = financial_year.trim();
        if trimmed.is_empty() {
            return Err(AppError::Validation("Financial year is required.".to_string()));
        }

        let normalized = trimmed.replace('/', "-");
        let parts: Vec<&str> = normalized.split('-').collect();

        let start_year = if parts.len() == 1 {
            parts[0].parse::<i32>().map_err(|_| {
                AppError::Validation("Financial year must be like 2025-26.".to_string())
            })?
        } else if parts.len() == 2 {
            parts[0].parse::<i32>().map_err(|_| {
                AppError::Validation("Financial year must be like 2025-26.".to_string())
            })?
        } else {
            return Err(AppError::Validation(
                "Financial year must be like 2025-26.".to_string(),
            ));
        };

        let end_year = start_year + 1;
        let label = format!("{}-{}", start_year, end_year);
        Ok((
            format!("{}-04-01", start_year),
            format!("{}-03-31", end_year),
            label,
        ))
    }

    pub fn customer_search(&self, query: &str) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let q = query.trim();
        let like = format!("%{}%", q);

        let mut stmt = conn
            .prepare(
                "SELECT id, name, phone, outstanding_balance, loyalty_points, allergies, chronic_conditions
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
                    "allergies": serde_json::from_str::<serde_json::Value>(&row.get::<_, Option<String>>(5)?.unwrap_or_else(|| "[]".to_string())).unwrap_or_else(|_| serde_json::json!([])),
                    "chronic_conditions": serde_json::from_str::<serde_json::Value>(&row.get::<_, Option<String>>(6)?.unwrap_or_else(|| "[]".to_string())).unwrap_or_else(|_| serde_json::json!([])),
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
        let safe_limit = limit.clamp(1, 500);

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

    pub fn purchase_create_return(&self, data: &PurchaseReturnCreateInput, user_id: i64) -> Result<i64, AppError> {
        let debit_note_no = data.debit_note_no.trim();
        if debit_note_no.is_empty() {
            return Err(AppError::Validation("Debit note number is required.".to_string()));
        }
        if data.total_amount <= 0.0 {
            return Err(AppError::Validation("Return amount must be greater than zero.".to_string()));
        }

        let mut conn = self.connection()?;
        let tx = conn.transaction().map_err(|e| AppError::Internal(e.to_string()))?;

        let supplier_outstanding: f64 = tx
            .query_row(
                "SELECT outstanding_balance FROM suppliers WHERE id = ?1 AND deleted_at IS NULL",
                params![data.supplier_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Supplier not found.".to_string()))?;

        tx.execute(
            "INSERT INTO purchase_returns (
                debit_note_no, supplier_id, return_date, reason,
                total_amount, status, notes, created_by
             ) VALUES (?1, ?2, COALESCE(?3, date('now')), ?4, ?5, 'raised', ?6, ?7)",
            params![
                debit_note_no,
                data.supplier_id,
                data.return_date,
                data.reason,
                data.total_amount,
                data.notes,
                user_id,
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        let return_id = tx.last_insert_rowid();
        let updated_outstanding = (supplier_outstanding - data.total_amount).max(0.0);

        tx.execute(
            "UPDATE suppliers
             SET outstanding_balance = ?1,
                 updated_at = ?2
             WHERE id = ?3",
            params![updated_outstanding, chrono::Utc::now().to_rfc3339(), data.supplier_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        tx.commit().map_err(|e| AppError::Internal(e.to_string()))?;

        self.write_audit_log(
            "PURCHASE_RETURN_CREATED",
            "purchase",
            &return_id.to_string(),
            None,
            Some(
                &serde_json::json!({
                    "debit_note_no": debit_note_no,
                    "supplier_id": data.supplier_id,
                    "total_amount": data.total_amount,
                })
                .to_string(),
            ),
            &format!("user:{}", user_id),
        )?;

        Ok(return_id)
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

    pub fn create_print_job(
        &self,
        job_type: &str,
        printer_type: Option<&str>,
        printer_name: Option<&str>,
        file_name: &str,
        file_path: &str,
        size_bytes: i64,
    ) -> Result<i64, AppError> {
        let conn = self.connection()?;
        conn.execute(
            "INSERT INTO print_jobs (
                job_type, printer_type, printer_name, file_name, file_path,
                size_bytes, status, retry_count, last_error, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'queued', 0, NULL, ?7, ?7)",
            params![
                job_type,
                printer_type,
                printer_name,
                file_name,
                file_path,
                size_bytes,
                chrono::Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        Ok(conn.last_insert_rowid())
    }

    pub fn update_print_job_status(
        &self,
        file_name: &str,
        status: &str,
        last_error: Option<&str>,
        increment_retry: bool,
    ) -> Result<(), AppError> {
        let conn = self.connection()?;
        let retry_sql = if increment_retry {
            "retry_count = retry_count + 1,"
        } else {
            ""
        };
        let sql = format!(
            "UPDATE print_jobs
             SET status = ?1,
                 {} 
                 last_error = ?2,
                 updated_at = ?3
             WHERE file_name = ?4",
            retry_sql
        );
        conn.execute(
            &sql,
            params![status, last_error, chrono::Utc::now().to_rfc3339(), file_name],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(())
    }

    pub fn list_print_jobs(&self, limit: i64) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let safe_limit = limit.clamp(1, 200);
        let mut stmt = conn
            .prepare(
                "SELECT
                    file_name,
                    size_bytes,
                    CAST(strftime('%s', updated_at) AS INTEGER) AS modified_at,
                    COALESCE(printer_name, '') AS printer_name,
                    COALESCE(printer_type, '') AS printer_type,
                    status,
                    retry_count,
                    COALESCE(last_error, '') AS last_error,
                    file_path,
                    job_type
                 FROM print_jobs
                 ORDER BY datetime(updated_at) DESC, id DESC
                 LIMIT ?1",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![safe_limit], |row| {
                let file_name: String = row.get(0)?;
                let extension = std::path::Path::new(&file_name)
                    .extension()
                    .and_then(|v| v.to_str())
                    .unwrap_or("")
                    .to_string();
                Ok(serde_json::json!({
                    "file_name": file_name,
                    "size_bytes": row.get::<_, i64>(1)?,
                    "modified_at": row.get::<_, i64>(2)?,
                    "printer_name": row.get::<_, String>(3)?,
                    "printer_type": row.get::<_, String>(4)?,
                    "status": row.get::<_, String>(5)?,
                    "retry_count": row.get::<_, i64>(6)?,
                    "last_error": row.get::<_, String>(7)?,
                    "file_path": row.get::<_, String>(8)?,
                    "job_type": row.get::<_, String>(9)?,
                    "extension": extension,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "items": items,
            "total": items.len(),
        }))
    }

    pub fn get_print_job_path_by_name(&self, file_name: &str) -> Result<Option<String>, AppError> {
        let conn = self.connection()?;
        conn.query_row(
            "SELECT file_path FROM print_jobs WHERE file_name = ?1",
            params![file_name],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::Internal(e.to_string()))
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

    #[allow(clippy::too_many_arguments)]
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

    #[allow(clippy::too_many_arguments)]
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

    #[allow(clippy::too_many_arguments)]
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
        let medicine_code = format!("{medicine_id:05}");
        let barcode = format!(
            "MED{}-{}",
            medicine_code,
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

    pub fn inventory_get_stock(&self, filters: &serde_json::Value) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let search = filters
            .get("search")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_lowercase();
        let like = format!("%{}%", search);
        let category_id = filters.get("category_id").and_then(|v| v.as_i64());
        let low_stock_only = filters
            .get("low_stock")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let mut stmt = conn
            .prepare(
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
                   AND (?1 = '' OR lower(m.name) LIKE ?2 OR lower(m.generic_name) LIKE ?2)
                   AND (?3 IS NULL OR m.category_id = ?3)
                 GROUP BY m.id, m.name, m.generic_name, m.category_id, c.name, m.schedule, m.default_gst_rate, m.reorder_level, m.is_active
                 HAVING (?4 = 0 OR total_stock <= m.reorder_level)
                 ORDER BY m.name ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(
                params![search, like, category_id, if low_stock_only { 1 } else { 0 }],
                |row| {
                    Ok(serde_json::json!({
                        "id": row.get::<_, i64>(0)?,
                        "name": row.get::<_, String>(1)?,
                        "generic_name": row.get::<_, String>(2)?,
                        "category_id": row.get::<_, Option<i64>>(3)?,
                        "category_name": row.get::<_, Option<String>>(4)?,
                        "schedule": row.get::<_, String>(5)?,
                        "default_gst_rate": row.get::<_, f64>(6)?,
                        "reorder_level": row.get::<_, i64>(7)?,
                        "total_stock": row.get::<_, i64>(8)?,
                        "is_active": row.get::<_, i64>(9)? == 1,
                    }))
                },
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::json!({
            "items": items,
            "total": items.len(),
        }))
    }

    pub fn inventory_get_low_stock(&self) -> Result<serde_json::Value, AppError> {
        let payload = self.inventory_get_stock(&serde_json::json!({ "low_stock": true }))?;
        Ok(payload
            .get("items")
            .cloned()
            .unwrap_or_else(|| serde_json::Value::Array(vec![])))
    }

    pub fn inventory_get_expiry_list(&self, within_days: i64) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;
        let days = within_days.max(1);

        let mut stmt = conn
            .prepare(
                "SELECT
                    b.id,
                    b.medicine_id,
                    m.name,
                    b.batch_number,
                    b.barcode,
                    b.expiry_date,
                    b.purchase_price,
                    b.selling_price,
                    b.quantity_in,
                    b.quantity_sold,
                    b.quantity_adjusted,
                    (b.quantity_in - b.quantity_sold - b.quantity_adjusted) AS quantity_on_hand,
                    b.rack_location,
                    b.supplier_id,
                    s.name
                 FROM batches b
                 JOIN medicines m ON m.id = b.medicine_id
                 LEFT JOIN suppliers s ON s.id = b.supplier_id
                 WHERE b.is_active = 1
                   AND m.deleted_at IS NULL
                   AND (b.quantity_in - b.quantity_sold - b.quantity_adjusted) > 0
                   AND date(b.expiry_date) <= date('now', '+' || ?1 || ' days')
                 ORDER BY date(b.expiry_date) ASC, m.name ASC",
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let rows = stmt
            .query_map(params![days], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "medicine_id": row.get::<_, i64>(1)?,
                    "medicine_name": row.get::<_, String>(2)?,
                    "batch_number": row.get::<_, String>(3)?,
                    "barcode": row.get::<_, Option<String>>(4)?,
                    "expiry_date": row.get::<_, String>(5)?,
                    "purchase_price": row.get::<_, f64>(6)?,
                    "selling_price": row.get::<_, f64>(7)?,
                    "quantity_in": row.get::<_, i64>(8)?,
                    "quantity_sold": row.get::<_, i64>(9)?,
                    "quantity_adjusted": row.get::<_, i64>(10)?,
                    "quantity_on_hand": row.get::<_, i64>(11)?,
                    "rack_location": row.get::<_, Option<String>>(12)?,
                    "supplier_id": row.get::<_, Option<i64>>(13)?,
                    "supplier_name": row.get::<_, Option<String>>(14)?,
                    "is_active": true,
                }))
            })
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
        }

        Ok(serde_json::Value::Array(items))
    }

    pub fn inventory_adjust_stock(
        &self,
        batch_id: i64,
        quantity: i64,
        adjustment_type: &str,
        reason: &str,
        user_id: i64,
    ) -> Result<(), AppError> {
        if quantity == 0 {
            return Err(AppError::Validation("Quantity must be non-zero.".to_string()));
        }
        if reason.trim().is_empty() {
            return Err(AppError::Validation("Reason is required for stock adjustment.".to_string()));
        }

        let mut conn = self.connection()?;
        let tx = conn.transaction().map_err(|e| AppError::Internal(e.to_string()))?;

        let current_on_hand: i64 = tx
            .query_row(
                "SELECT (quantity_in - quantity_sold - quantity_adjusted) FROM batches WHERE id = ?1 AND is_active = 1",
                params![batch_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Batch not found.".to_string()))?;

        let after = current_on_hand - quantity;
        if after < 0 {
            return Err(AppError::Validation(
                "Adjustment would result in negative stock.".to_string(),
            ));
        }

        tx.execute(
            "UPDATE batches
             SET quantity_adjusted = quantity_adjusted + ?1,
                 updated_at = ?2
             WHERE id = ?3",
            params![quantity, chrono::Utc::now().to_rfc3339(), batch_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        tx.execute(
            "INSERT INTO stock_adjustments (batch_id, adjustment_type, quantity, reason, created_by)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![batch_id, adjustment_type.trim(), quantity, reason.trim(), user_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        tx.commit().map_err(|e| AppError::Internal(e.to_string()))?;

        self.write_audit_log(
            "STOCK_ADJUSTED",
            "inventory",
            &batch_id.to_string(),
            None,
            Some(
                &serde_json::json!({
                    "adjustment_type": adjustment_type,
                    "quantity": quantity,
                    "reason": reason,
                })
                .to_string(),
            ),
            &format!("user:{}", user_id),
        )?;

        Ok(())
    }

    pub fn barcode_generate_for_batch(&self, batch_id: i64) -> Result<String, AppError> {
        let conn = self.connection()?;

        let row = conn
            .query_row(
                "SELECT medicine_id, batch_number, barcode
                 FROM batches
                 WHERE id = ?1 AND is_active = 1",
                params![batch_id],
                |r| {
                    Ok((
                        r.get::<_, i64>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, Option<String>>(2)?,
                    ))
                },
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::Validation("Batch not found.".to_string()))?;

        if let Some(existing) = row.2 {
            let clean = existing.trim();
            if !clean.is_empty() {
                return Ok(clean.to_string());
            }
        }

        let barcode = format!(
            "MED{:05}-{}",
            row.0,
            row.1
                .chars()
                .filter(|c| c.is_ascii_alphanumeric())
                .collect::<String>()
                .to_uppercase()
        );

        conn.execute(
            "UPDATE batches SET barcode = ?1, updated_at = ?2 WHERE id = ?3",
            params![barcode, chrono::Utc::now().to_rfc3339(), batch_id],
        )
        .map_err(|e| AppError::Internal(e.to_string()))?;

        self.write_audit_log(
            "BARCODE_GENERATED",
            "barcode",
            &batch_id.to_string(),
            None,
            Some(&serde_json::json!({ "barcode": barcode }).to_string()),
            "system",
        )?;

        Ok(barcode)
    }

    pub fn barcode_generate_bulk(&self, batch_ids: &[i64]) -> Result<serde_json::Value, AppError> {
        let conn = self.connection()?;

        let mut candidates: Vec<(i64, i64, String, Option<String>)> = Vec::new();
        if batch_ids.is_empty() {
            let mut stmt = conn
                .prepare(
                    "SELECT id, medicine_id, batch_number, barcode
                     FROM batches
                     WHERE is_active = 1 AND (barcode IS NULL OR trim(barcode) = '')
                     ORDER BY id ASC",
                )
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let rows = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                })
                .map_err(|e| AppError::Internal(e.to_string()))?;
            for row in rows {
                candidates.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
            }
        } else {
            let placeholders = (0..batch_ids.len()).map(|_| "?").collect::<Vec<_>>().join(",");
            let sql = format!(
                "SELECT id, medicine_id, batch_number, barcode
                 FROM batches
                 WHERE is_active = 1 AND id IN ({})
                 ORDER BY id ASC",
                placeholders
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| AppError::Internal(e.to_string()))?;
            let rows = stmt
                .query_map(rusqlite::params_from_iter(batch_ids.iter()), |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                })
                .map_err(|e| AppError::Internal(e.to_string()))?;
            for row in rows {
                candidates.push(row.map_err(|e| AppError::Internal(e.to_string()))?);
            }
        }

        let mut generated = Vec::new();
        for (batch_id, medicine_id, batch_number, existing) in candidates {
            let barcode = if let Some(existing_value) = existing {
                let clean = existing_value.trim();
                if !clean.is_empty() {
                    clean.to_string()
                } else {
                    format!(
                        "MED{:05}-{}",
                        medicine_id,
                        batch_number
                            .chars()
                            .filter(|c| c.is_ascii_alphanumeric())
                            .collect::<String>()
                            .to_uppercase()
                    )
                }
            } else {
                format!(
                    "MED{:05}-{}",
                    medicine_id,
                    batch_number
                        .chars()
                        .filter(|c| c.is_ascii_alphanumeric())
                        .collect::<String>()
                        .to_uppercase()
                )
            };

            conn.execute(
                "UPDATE batches SET barcode = ?1, updated_at = ?2 WHERE id = ?3",
                params![barcode, chrono::Utc::now().to_rfc3339(), batch_id],
            )
            .map_err(|e| AppError::Internal(e.to_string()))?;

            generated.push(serde_json::json!({
                "batch_id": batch_id,
                "barcode": barcode,
            }));
        }

        self.write_audit_log(
            "BARCODE_BULK_GENERATED",
            "barcode",
            "bulk",
            None,
            Some(
                &serde_json::json!({
                    "requested": batch_ids.len(),
                    "generated": generated.len(),
                })
                .to_string(),
            ),
            "system",
        )?;

        Ok(serde_json::json!({
            "items": generated,
            "total": generated.len(),
        }))
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

        let print_jobs_applied: Option<String> = conn
            .query_row(
                "SELECT version FROM schema_migrations WHERE version = '002_print_jobs'",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if print_jobs_applied.is_none() {
            conn.execute_batch(PRINT_JOBS_MIGRATION_SQL)
                .map_err(|e| AppError::Internal(e.to_string()))?;

            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
                params!["002_print_jobs", chrono::Utc::now().to_rfc3339()],
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
