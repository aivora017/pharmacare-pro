use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn supplier_credit_list(state: State<'_, AppState>, supplier_id: Option<i64>) -> Result<Value, AppError> {
    state.db.lock()?.list_supplier_credit_notes(supplier_id)
}

#[tauri::command]
pub async fn supplier_credit_create(state: State<'_, AppState>, data: Value, user_id: i64) -> Result<i64, AppError> {
    state.db.lock()?.create_supplier_credit_note(&data, user_id)
}

#[tauri::command]
pub async fn supplier_credit_apply(state: State<'_, AppState>, id: i64, user_id: i64) -> Result<(), AppError> {
    state.db.lock()?.apply_supplier_credit_note(id, user_id)
}
