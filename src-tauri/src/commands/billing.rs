use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command] pub async fn billing_create_bill(state: State<'_, AppState>, input: serde_json::Value) -> Result<i64, AppError> { state.db.lock()?.create_bill(&input) }
#[tauri::command] pub async fn billing_cancel_bill(state: State<'_, AppState>, bill_id: i64, reason: String, user_id: i64) -> Result<(), AppError> { state.db.lock()?.cancel_bill(bill_id, &reason, user_id) }
#[tauri::command] pub async fn billing_get_bill(state: State<'_, AppState>, bill_id: i64) -> Result<serde_json::Value, AppError> { state.db.lock()?.get_bill(bill_id) }
#[tauri::command] pub async fn billing_list_bills(state: State<'_, AppState>, filters: serde_json::Value) -> Result<serde_json::Value, AppError> { state.db.lock()?.list_bills(&filters) }
#[tauri::command] pub async fn billing_hold_bill(state: State<'_, AppState>, input: serde_json::Value) -> Result<(), AppError> { state.db.lock()?.hold_bill(&input) }
#[tauri::command] pub async fn billing_get_held_bills(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.get_held_bills() }
#[tauri::command] pub async fn billing_restore_held_bill(state: State<'_, AppState>, held_bill_id: i64) -> Result<serde_json::Value, AppError> { state.db.lock()?.restore_held_bill(held_bill_id) }
#[tauri::command] pub async fn billing_get_today_summary(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.today_summary() }
#[tauri::command] pub async fn billing_create_return(state: State<'_, AppState>, original_bill_id: i64, items: serde_json::Value, reason: String, user_id: i64) -> Result<i64, AppError> { state.db.lock()?.create_return(original_bill_id, &items, &reason, user_id) }
#[tauri::command] pub async fn billing_list_returns(state: State<'_, AppState>, limit: Option<i64>) -> Result<serde_json::Value, AppError> { state.db.lock()?.list_returns(limit.unwrap_or(50)) }
