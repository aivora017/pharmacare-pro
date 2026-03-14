#![allow(unused_variables, dead_code)]
//! Backup and Restore

use crate::commands::permission::require_permission;
use crate::{error::AppError, AppState};
use tauri::State;

#[tauri::command]
pub async fn backup_create(
    state: State<'_, AppState>,
    destination: Option<String>,
    user_id: i64,
) -> Result<String, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, user_id, "settings")?;
    db.backup_create(destination.as_deref())
}
#[tauri::command]
pub async fn backup_restore(
    state: State<'_, AppState>,
    backup_path: String,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, user_id, "settings")?;
    db.backup_restore(&backup_path, user_id)
}
#[tauri::command]
pub async fn backup_list(
    state: State<'_, AppState>,
    user_id: i64,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, user_id, "settings")?;
    db.backup_list()
}
