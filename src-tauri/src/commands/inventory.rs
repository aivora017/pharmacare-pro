use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command] pub async fn inventory_get_expiry_list(state: State<'_, AppState>, within_days: Option<i64>) -> Result<serde_json::Value, AppError> { state.db.lock()?.inventory_get_expiry_list(within_days.unwrap_or(90)) }
#[tauri::command] pub async fn inventory_get_low_stock(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.inventory_get_low_stock() }
#[tauri::command] pub async fn inventory_adjust_stock(state: State<'_, AppState>, batch_id: i64, quantity: i64, adjustment_type: String, reason: String, user_id: i64) -> Result<(), AppError> { state.db.lock()?.inventory_adjust_stock(batch_id, quantity, &adjustment_type, &reason, user_id) }
#[tauri::command] pub async fn inventory_get_stock(state: State<'_, AppState>, filters: serde_json::Value) -> Result<serde_json::Value, AppError> { state.db.lock()?.inventory_get_stock(&filters) }
#[tauri::command] pub async fn inventory_physical_count(state: State<'_, AppState>, batch_id: i64, actual_qty: i64, user_id: i64) -> Result<(), AppError> { state.db.lock()?.inventory_physical_count(batch_id, actual_qty, user_id) }
