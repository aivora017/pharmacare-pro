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
    // TODO: try connecting with provided IMAP config, return success/failure
    todo!("email_test_connection")
}
#[tauri::command]
pub async fn email_fetch_invoices(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: poll IMAP, return list of detected invoice emails with parsed data
    todo!("email_fetch_invoices")
}
#[tauri::command]
pub async fn email_import_bill(state: State<'_, AppState>, import_id: i64, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> {
    // TODO: call purchase_create_bill with source="email_import", mark email_imports as processed
    todo!("email_import_bill")
}
#[tauri::command]
pub async fn email_list_imports(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: SELECT email_imports ORDER BY received_at DESC
    todo!("email_list_imports")
}
