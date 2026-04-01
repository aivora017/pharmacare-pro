use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn barcode_generate(state: State<'_, AppState>, batch_id: i64) -> Result<String, AppError> {
    state.db.lock()?.barcode_generate(batch_id)
}
#[tauri::command]
pub async fn barcode_generate_bulk(state: State<'_, AppState>, batch_ids: Vec<i64>) -> Result<serde_json::Value, AppError> {
    state.db.lock()?.barcode_generate_bulk(&batch_ids)
}
