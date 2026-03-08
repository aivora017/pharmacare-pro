//! Purchase Bills, Suppliers, Email Import
//! purchase_create_bill steps:
//! 1. Validate supplier exists and is active
//! 2. Generate bill_number: "PUR-" + YYYYMM + "-" + sequence
//! 3. TRANSACTION: INSERT purchase_bills, INSERT purchase_bill_items,
//!    INSERT batches (for each new batch), UPDATE supplier.outstanding_balance, audit
//!
//! Email auto-import flow:
//! 1. IMAP connect using credentials from OS keychain
//! 2. Poll for new emails from known supplier email domains
//! 3. Detect CSV/Excel attachments
//! 4. Parse with column mapper (saved per supplier)
//! 5. Show review screen (frontend) before saving
//! 6. On confirm: call purchase_create_bill with source="email_import"

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn purchase_create_bill(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { todo!("purchase_create_bill") }
#[tauri::command]
pub async fn purchase_get_bill(state: State<'_, AppState>, id: i64) -> Result<serde_json::Value, AppError> { todo!("purchase_get_bill") }
#[tauri::command]
pub async fn purchase_list_bills(state: State<'_, AppState>, filters: serde_json::Value) -> Result<serde_json::Value, AppError> { todo!("purchase_list_bills") }
#[tauri::command]
pub async fn purchase_create_po(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { todo!("purchase_create_po") }
#[tauri::command]
pub async fn purchase_create_supplier(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { todo!("purchase_create_supplier") }
#[tauri::command]
pub async fn purchase_list_suppliers(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { todo!("purchase_list_suppliers") }
#[tauri::command]
pub async fn purchase_update_supplier(state: State<'_, AppState>, id: i64, data: serde_json::Value, user_id: i64) -> Result<(), AppError> { todo!("purchase_update_supplier") }
