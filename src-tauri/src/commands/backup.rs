#![allow(unused_variables, dead_code)]
//! Backup and Restore

use crate::{error::AppError, AppState};
use tauri::State;

#[tauri::command]
pub async fn backup_create(
    state: State<'_, AppState>,
    destination: Option<String>,
) -> Result<String, AppError> {
    Err(AppError::Validation(
        "Backup creation is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn backup_restore(
    state: State<'_, AppState>,
    backup_path: String,
    user_id: i64,
) -> Result<(), AppError> {
    Err(AppError::Validation(
        "Backup restore is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn backup_list(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    Err(AppError::Validation(
        "Backup list is not implemented yet.".to_string(),
    ))
}
