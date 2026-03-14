#![allow(unused_variables, dead_code)]
//! Billing / POS Commands
//! billing_create_bill is the MOST CRITICAL command — runs as SQLite TRANSACTION
//!
//! billing_create_bill steps (ALL inside BEGIN TRANSACTION ... COMMIT):
//! 1.  Validate: for each item check batch.quantity_on_hand >= item.quantity
//!     On fail: ROLLBACK, return InsufficientStock(medicine_name, available, requested)
//! 2.  Generate bill_number: "POS-" + YYYYMM + "-" + zero-padded 5-digit sequence
//!     SELECT MAX(CAST(SUBSTR(bill_number,-5) AS INTEGER)) FROM bills WHERE bill_number LIKE "POS-YYYYMM-%"
//! 3.  Calculate all totals (frontend sends pre-calculated; Rust re-validates them)
//! 4.  INSERT INTO bills
//! 5.  For each item: INSERT INTO bill_items
//! 6.  For each item: UPDATE batches SET quantity_sold = quantity_sold + qty WHERE id = batch_id
//! 7.  For each payment: INSERT INTO payments
//! 8.  If any payment_mode="credit" and customer_id set:
//!     UPDATE customers SET outstanding_balance = outstanding_balance + credit_amount
//! 9.  If customer_id set: calculate loyalty points (1 pt per ₹100), UPDATE customers
//! 10. INSERT INTO audit_log
//! 11. COMMIT; return new bill_id

use crate::commands::permission::require_permission;
use crate::{error::AppError, AppState};
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct CreateBillInput {
    pub customer_id: Option<i64>,
    pub doctor_id: Option<i64>,
    pub prescription_ref: Option<String>,
    pub prescription_image: Option<String>,
    pub loyalty_points_redeemed: Option<i64>,
    pub items: Vec<BillItemInput>,
    pub payments: Vec<PaymentInput>,
    pub discount_amount: Option<f64>,
    pub notes: Option<String>,
    pub created_by: i64,
}

#[derive(Debug, Deserialize)]
pub struct BillItemInput {
    pub medicine_id: i64,
    pub batch_id: i64,
    pub medicine_name: String,
    pub batch_number: String,
    pub expiry_date: String,
    pub quantity: i64,
    pub unit_price: f64,
    pub mrp: f64,
    pub discount_percent: f64,
    pub discount_amount: f64,
    pub gst_rate: f64,
    pub cgst_amount: f64,
    pub sgst_amount: f64,
    pub igst_amount: f64,
    pub total_amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct PaymentInput {
    pub amount: f64,
    pub payment_mode: String,
    pub reference_no: Option<String>,
}

#[tauri::command]
pub async fn billing_create_bill(
    state: State<'_, AppState>,
    input: CreateBillInput,
) -> Result<i64, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, input.created_by, "billing")?;
    db.create_bill(&input)
}

#[tauri::command]
pub async fn billing_cancel_bill(
    state: State<'_, AppState>,
    bill_id: i64,
    reason: String,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, user_id, "billing")?;
    db.cancel_bill(bill_id, &reason, user_id)
}

#[tauri::command]
pub async fn billing_get_bill(
    state: State<'_, AppState>,
    bill_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.get_bill_json(bill_id)
}

#[tauri::command]
pub async fn billing_list_bills(
    state: State<'_, AppState>,
    filters: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.list_bills(&filters)
}

#[tauri::command]
pub async fn billing_hold_bill(
    state: State<'_, AppState>,
    input: serde_json::Value,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.hold_bill(&input)
}

#[tauri::command]
pub async fn billing_get_held_bills(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.get_held_bills()
}

#[tauri::command]
pub async fn billing_restore_held_bill(
    state: State<'_, AppState>,
    held_bill_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.restore_held_bill(held_bill_id)
}

#[tauri::command]
pub async fn billing_create_return(
    state: State<'_, AppState>,
    original_bill_id: i64,
    items: serde_json::Value,
    reason: String,
    user_id: i64,
) -> Result<i64, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, user_id, "billing")?;
    db.create_bill_return(original_bill_id, &items, &reason, user_id)
}

#[tauri::command]
pub async fn billing_list_returns(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.list_bill_returns(limit.unwrap_or(20))
}

#[tauri::command]
pub async fn billing_get_today_summary(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.get_today_summary()
}
