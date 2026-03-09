#![allow(unused_variables, dead_code)]
//! IMAP Email Import for Distributor Bills
//! This is an exclusive feature - no Indian pharmacy software has this.
//!
//! Flow:
//! 1. Store IMAP credentials in OS keychain (never in DB or .env)
//! 2. Background thread polls every 20 min using imapflow (Tauri shell plugin calls Node script)
//! 3. Detect emails from known supplier email_domain
//! 4. Download CSV/Excel attachments
//! 5. Load column mapper for that supplier (saved in settings)
//! 6. Parse file, show review UI
//! 7. On confirm: call purchase_create_bill with source="email_import"

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn email_test_connection(state: State<'_, AppState>, config: serde_json::Value) -> Result<bool, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.email_test_connection(&config)
}
#[tauri::command]
pub async fn email_fetch_invoices(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.email_fetch_invoices()
}
#[tauri::command]
pub async fn email_import_bill(state: State<'_, AppState>, import_id: i64, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.email_import_bill(import_id, &data, user_id)
}
#[tauri::command]
pub async fn email_list_imports(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.email_list_imports()
}

