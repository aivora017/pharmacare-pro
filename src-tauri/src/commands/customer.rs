use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command] pub async fn customer_search(state: State<'_, AppState>, query: String) -> Result<serde_json::Value, AppError> { state.db.lock()?.customer_search(&query) }
#[tauri::command] pub async fn customer_get(state: State<'_, AppState>, id: i64) -> Result<serde_json::Value, AppError> { state.db.lock()?.customer_get(id) }
#[tauri::command] pub async fn customer_create(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { state.db.lock()?.customer_create(&data, user_id) }
#[tauri::command] pub async fn customer_update(state: State<'_, AppState>, id: i64, data: serde_json::Value, user_id: i64) -> Result<(), AppError> { state.db.lock()?.customer_update(id, &data, user_id) }
#[tauri::command] pub async fn customer_get_history(state: State<'_, AppState>, customer_id: i64, limit: Option<i64>) -> Result<serde_json::Value, AppError> { state.db.lock()?.customer_get_history(customer_id, limit.unwrap_or(50)) }
#[tauri::command] pub async fn customer_record_payment(state: State<'_, AppState>, customer_id: i64, amount: f64, user_id: i64) -> Result<(), AppError> { state.db.lock()?.customer_record_payment(customer_id, amount, user_id) }
#[tauri::command] pub async fn doctor_list(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.doctor_list() }
#[tauri::command] pub async fn doctor_create(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { state.db.lock()?.doctor_create(&data, user_id) }
#[tauri::command] pub async fn doctor_update(state: State<'_, AppState>, id: i64, data: serde_json::Value, user_id: i64) -> Result<(), AppError> { state.db.lock()?.doctor_update(id, &data, user_id) }
