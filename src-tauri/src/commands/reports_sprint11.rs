use tauri::State;
use crate::{AppState, error::AppError};
use serde_json::Value;

#[tauri::command]
pub async fn pl_report(
    state: State<'_, AppState>,
    period: String,   // "monthly" | "yearly"
    year: i32,
    month: Option<i32>,
) -> Result<Value, AppError> {
    let db = state.db.lock()?;
    db.get_pl_report(&period, year, month)
}

#[tauri::command]
pub async fn audit_log_list(
    state: State<'_, AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
    module: Option<String>,
    user_id: Option<i64>,
) -> Result<Value, AppError> {
    let db = state.db.lock()?;
    db.get_audit_log(limit.unwrap_or(50), offset.unwrap_or(0), module, user_id)
}

#[tauri::command]
pub async fn reorder_alerts(state: State<'_, AppState>) -> Result<Value, AppError> {
    let db = state.db.lock()?;
    db.get_reorder_alerts()
}

#[tauri::command]
pub async fn prescription_history(
    state: State<'_, AppState>,
    customer_id: i64,
    limit: Option<i64>,
) -> Result<Value, AppError> {
    let db = state.db.lock()?;
    db.get_prescription_history(customer_id, limit.unwrap_or(20))
}

#[tauri::command]
pub async fn sms_settings_get(state: State<'_, AppState>) -> Result<Value, AppError> {
    let db = state.db.lock()?;
    db.get_sms_settings()
}
