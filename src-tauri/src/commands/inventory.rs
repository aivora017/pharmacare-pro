#![allow(unused_variables, dead_code)]
//! Inventory queries and stock adjustments

use crate::commands::permission::require_permission;
use crate::{error::AppError, AppState};
use tauri::State;

#[tauri::command]
pub async fn inventory_get_stock(
    state: State<'_, AppState>,
    filters: Option<serde_json::Value>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.inventory_get_stock(filters.as_ref().unwrap_or(&serde_json::json!({})))
}
#[tauri::command]
pub async fn inventory_get_low_stock(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.inventory_get_low_stock()
}
#[tauri::command]
pub async fn inventory_get_expiry_list(
    state: State<'_, AppState>,
    within_days: Option<i64>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.inventory_get_expiry_list(within_days.unwrap_or(90))
}
#[tauri::command]
pub async fn inventory_adjust_stock(
    state: State<'_, AppState>,
    batch_id: i64,
    quantity: i64,
    adjustment_type: String,
    reason: String,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, user_id, "medicine")?;
    db.inventory_adjust_stock(batch_id, quantity, &adjustment_type, &reason, user_id)
}
