#![allow(unused_variables, dead_code)]
//! Customer and Doctor management

use crate::{AppState, error::AppError};
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct CustomerCreateInput {
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[tauri::command]
pub async fn customer_search(state: State<'_, AppState>, query: String) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.customer_search(&query)
}
#[tauri::command]
pub async fn customer_get(state: State<'_, AppState>, id: i64) -> Result<serde_json::Value, AppError> { todo!("customer_get") }
#[tauri::command]
pub async fn customer_create(state: State<'_, AppState>, data: CustomerCreateInput, user_id: i64) -> Result<i64, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.customer_create(&data.name, data.phone.as_deref(), data.email.as_deref(), user_id)
}
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

