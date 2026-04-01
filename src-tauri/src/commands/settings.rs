use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command] pub async fn settings_get(state: State<'_, AppState>, key: String) -> Result<Option<String>, AppError> { state.db.lock()?.get_setting(&key) }
#[tauri::command] pub async fn settings_set(state: State<'_, AppState>, key: String, value: String, user_id: Option<i64>) -> Result<(), AppError> { state.db.lock()?.set_setting(&key, &value, user_id) }
#[tauri::command] pub async fn settings_get_all(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.list_settings() }
#[tauri::command] pub async fn settings_get_roles(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.list_roles() }
