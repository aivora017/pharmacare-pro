use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn reports_dead_stock(state: State<'_, AppState>, days: Option<i64>) -> Result<Value, AppError> {
    state.db.lock()?.get_dead_stock_report(days.unwrap_or(90))
}

#[tauri::command]
pub async fn billing_create_amendment(state: State<'_, AppState>, bill_id: i64, reason: String, user_id: i64) -> Result<i64, AppError> {
    state.db.lock()?.create_bill_amendment(bill_id, &reason, user_id)
}

#[tauri::command]
pub async fn billing_get_amendments(state: State<'_, AppState>, bill_id: i64) -> Result<Value, AppError> {
    state.db.lock()?.get_bill_amendments(bill_id)
}
