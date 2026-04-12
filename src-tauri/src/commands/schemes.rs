use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn scheme_list(state: State<'_, AppState>, active_only: bool) -> Result<Value, AppError> {
    state.db.lock()?.list_schemes(active_only)
}

#[tauri::command]
pub async fn scheme_create(state: State<'_, AppState>, data: Value, user_id: i64) -> Result<i64, AppError> {
    state.db.lock()?.create_scheme(&data, user_id)
}

#[tauri::command]
pub async fn scheme_update(state: State<'_, AppState>, id: i64, data: Value) -> Result<(), AppError> {
    state.db.lock()?.update_scheme(id, &data)
}

#[tauri::command]
pub async fn scheme_delete(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    state.db.lock()?.delete_scheme(id)
}

#[tauri::command]
pub async fn scheme_get_applicable(state: State<'_, AppState>, bill_total: f64) -> Result<Value, AppError> {
    state.db.lock()?.get_applicable_schemes(bill_total)
}
