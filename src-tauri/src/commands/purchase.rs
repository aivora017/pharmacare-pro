use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command] pub async fn supplier_list(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.supplier_list() }
#[tauri::command] pub async fn supplier_create(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { state.db.lock()?.supplier_create(&data, user_id) }
#[tauri::command] pub async fn supplier_update(state: State<'_, AppState>, id: i64, data: serde_json::Value, user_id: i64) -> Result<(), AppError> { state.db.lock()?.supplier_update(id, &data, user_id) }
#[tauri::command] pub async fn purchase_list_bills(state: State<'_, AppState>, filters: serde_json::Value) -> Result<serde_json::Value, AppError> { state.db.lock()?.purchase_list_bills(&filters) }
#[tauri::command] pub async fn purchase_create_bill(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { state.db.lock()?.purchase_create_bill(&data, user_id) }
#[tauri::command] pub async fn purchase_get_bill(state: State<'_, AppState>, id: i64) -> Result<serde_json::Value, AppError> { state.db.lock()?.purchase_get_bill(id) }
#[tauri::command] pub async fn purchase_add_batch_from_bill(state: State<'_, AppState>, purchase_bill_id: i64, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { state.db.lock()?.purchase_add_batch_from_bill(purchase_bill_id, &data, user_id) }
