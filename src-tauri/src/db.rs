use crate::commands::auth::UserDto;
use crate::commands::billing::CreateBillInput;
use crate::commands::medicine::{BatchDto, CategoryDto, MedicineDetailDto, MedicineDto};
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
