use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn backup_create(state: State<'_, AppState>, destination: Option<String>) -> Result<String, AppError> {
    state.db.lock()?.backup_create(destination.as_deref())
}
#[tauri::command]
pub async fn backup_list(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    state.db.lock()?.backup_list()
}
#[tauri::command]
pub async fn backup_restore(state: State<'_, AppState>, backup_path: String) -> Result<(), AppError> {
    state.db.lock()?.backup_restore(&backup_path)
}
