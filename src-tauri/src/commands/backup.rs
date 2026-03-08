//! Backup and Restore

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn backup_create(state: State<'_, AppState>, destination: Option<String>) -> Result<String, AppError> {
    // TODO: rusqlite backup API → encrypted .db file in destination folder
    // Filename: pharmacare_backup_YYYY-MM-DD_HHMMSS.db
    todo!("backup_create")
}
#[tauri::command]
pub async fn backup_restore(state: State<'_, AppState>, backup_path: String, user_id: i64) -> Result<(), AppError> {
    // TODO: validate backup file, confirm it decrypts, close current DB, copy, reopen
    todo!("backup_restore")
}
#[tauri::command]
pub async fn backup_list(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    // TODO: list all .db files in the default backup folder with sizes + dates
    todo!("backup_list")
}
