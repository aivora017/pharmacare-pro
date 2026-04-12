use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn po_list(state: State<'_, AppState>, status: Option<String>) -> Result<Value, AppError> {
    state.db.lock()?.list_purchase_orders(status.as_deref())
}

#[tauri::command]
pub async fn po_get(state: State<'_, AppState>, id: i64) -> Result<Value, AppError> {
    state.db.lock()?.get_purchase_order(id)
}

#[tauri::command]
pub async fn po_create(state: State<'_, AppState>, data: Value, user_id: i64) -> Result<i64, AppError> {
    state.db.lock()?.create_purchase_order(&data, user_id)
}

#[tauri::command]
pub async fn po_update_status(state: State<'_, AppState>, id: i64, status: String, user_id: i64) -> Result<(), AppError> {
    state.db.lock()?.update_purchase_order_status(id, &status, user_id)
}

#[tauri::command]
pub async fn po_auto_generate(state: State<'_, AppState>, user_id: i64) -> Result<Value, AppError> {
    state.db.lock()?.auto_generate_po(user_id)
}
