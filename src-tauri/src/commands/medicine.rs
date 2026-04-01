use crate::{AppState, error::AppError};
use tauri::State;
#[tauri::command] pub async fn medicine_search(state: State<'_, AppState>, query: String, in_stock_only: Option<bool>, category_id: Option<i64>) -> Result<serde_json::Value, AppError> { state.db.lock()?.medicine_search(&query, in_stock_only.unwrap_or(false), category_id) }
#[tauri::command] pub async fn medicine_get(state: State<'_, AppState>, id: i64) -> Result<serde_json::Value, AppError> { state.db.lock()?.medicine_get(id) }
#[tauri::command] pub async fn medicine_create(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { state.db.lock()?.medicine_create(&data, user_id) }
#[tauri::command] pub async fn medicine_update(state: State<'_, AppState>, id: i64, data: serde_json::Value, user_id: i64) -> Result<(), AppError> { state.db.lock()?.medicine_update(id, &data, user_id) }
#[tauri::command] pub async fn medicine_delete(state: State<'_, AppState>, id: i64, user_id: i64) -> Result<(), AppError> { state.db.lock()?.medicine_delete(id, user_id) }
#[tauri::command] pub async fn medicine_list_batches(state: State<'_, AppState>, medicine_id: i64) -> Result<serde_json::Value, AppError> { state.db.lock()?.medicine_list_batches(medicine_id) }
#[tauri::command] pub async fn medicine_create_batch(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { state.db.lock()?.medicine_create_batch(&data, user_id) }
#[tauri::command] pub async fn medicine_update_batch(state: State<'_, AppState>, id: i64, data: serde_json::Value, user_id: i64) -> Result<(), AppError> { state.db.lock()?.medicine_update_batch(id, &data, user_id) }
#[tauri::command] pub async fn medicine_get_by_barcode(state: State<'_, AppState>, barcode: String) -> Result<serde_json::Value, AppError> { state.db.lock()?.medicine_get_by_barcode(&barcode) }
#[tauri::command] pub async fn medicine_list_categories(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.list_categories() }
