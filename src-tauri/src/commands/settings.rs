//! Settings - key-value store for app configuration

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn settings_get(state: State<'_, AppState>, key: String) -> Result<Option<String>, AppError> {
    // TODO: SELECT value FROM settings WHERE key=?
    todo!("settings_get")
}
#[tauri::command]
pub async fn settings_set(
    state: State<'_, AppState>, key: String, value: String, user_id: i64
) -> Result<(), AppError> {
    // TODO: INSERT OR REPLACE INTO settings; audit for sensitive keys
    // For API keys: store in OS keychain instead of DB
    todo!("settings_set")
}
#[tauri::command]
pub async fn settings_get_all(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: SELECT all settings as {key: value} map; exclude sensitive keys like api_key
    todo!("settings_get_all")
}
