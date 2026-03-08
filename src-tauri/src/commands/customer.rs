//! Customer and Doctor management

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn customer_search(state: State<'_, AppState>, query: String) -> Result<serde_json::Value, AppError> {
    // TODO: LIKE search on name + phone; include outstanding_balance, loyalty_points
    todo!("customer_search")
}
#[tauri::command]
pub async fn customer_get(state: State<'_, AppState>, id: i64) -> Result<serde_json::Value, AppError> { todo!("customer_get") }
#[tauri::command]
pub async fn customer_create(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { todo!("customer_create") }
#[tauri::command]
pub async fn customer_update(state: State<'_, AppState>, id: i64, data: serde_json::Value, user_id: i64) -> Result<(), AppError> { todo!("customer_update") }
#[tauri::command]
pub async fn customer_get_history(state: State<'_, AppState>, customer_id: i64, limit: Option<i64>) -> Result<serde_json::Value, AppError> {
    // TODO: SELECT bills + bill_items WHERE customer_id=? ORDER BY bill_date DESC LIMIT limit
    todo!("customer_get_history")
}
#[tauri::command]
pub async fn doctor_list(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { todo!("doctor_list") }
#[tauri::command]
pub async fn doctor_create(state: State<'_, AppState>, data: serde_json::Value, user_id: i64) -> Result<i64, AppError> { todo!("doctor_create") }
#[tauri::command]
pub async fn doctor_update(state: State<'_, AppState>, id: i64, data: serde_json::Value, user_id: i64) -> Result<(), AppError> { todo!("doctor_update") }
