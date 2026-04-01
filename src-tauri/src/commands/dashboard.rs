use crate::{AppState, error::AppError};
use tauri::State;
#[tauri::command] pub async fn dashboard_summary(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.dashboard_summary() }
