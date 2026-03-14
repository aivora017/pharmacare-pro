use crate::commands::permission::require_permission;
use crate::{error::AppError, AppState};
use tauri::State;

#[tauri::command]
pub async fn settings_get(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<String>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.get_setting(&key)
}

#[tauri::command]
pub async fn settings_set(
    state: State<'_, AppState>,
    key: String,
    value: String,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, user_id, "settings")?;
    db.set_setting(&key, &value, Some(user_id))
}

#[tauri::command]
pub async fn settings_get_all(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.list_settings()
}
