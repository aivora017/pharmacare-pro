#![allow(unused_variables, dead_code)]
//! Customer and Doctor management

use crate::{error::AppError, AppState};
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct CustomerCreateInput {
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DoctorCreateInput {
    pub name: String,
    pub registration_no: Option<String>,
    pub specialisation: Option<String>,
    pub qualification: Option<String>,
    pub clinic_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn customer_search(
    state: State<'_, AppState>,
    query: String,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.customer_search(&query)
}
#[tauri::command]
pub async fn customer_get(
    state: State<'_, AppState>,
    id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.customer_get(id)
}
#[tauri::command]
pub async fn customer_create(
    state: State<'_, AppState>,
    data: CustomerCreateInput,
    user_id: i64,
) -> Result<i64, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.customer_create(
        &data.name,
        data.phone.as_deref(),
        data.email.as_deref(),
        user_id,
    )
}
#[tauri::command]
pub async fn customer_update(
    state: State<'_, AppState>,
    id: i64,
    data: serde_json::Value,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.customer_update(id, &data, user_id)
}
#[tauri::command]
pub async fn customer_get_history(
    state: State<'_, AppState>,
    customer_id: i64,
    limit: Option<i64>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.customer_get_history(customer_id, limit.unwrap_or(50))
}
#[tauri::command]
pub async fn customer_record_credit_payment(
    state: State<'_, AppState>,
    customer_id: i64,
    amount: f64,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.customer_record_credit_payment(customer_id, amount, user_id)
}
#[tauri::command]
pub async fn doctor_list(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.doctor_list()
}
#[tauri::command]
pub async fn doctor_create(
    state: State<'_, AppState>,
    data: DoctorCreateInput,
    user_id: i64,
) -> Result<i64, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.doctor_create(&data, user_id)
}
#[tauri::command]
pub async fn doctor_update(
    state: State<'_, AppState>,
    id: i64,
    data: serde_json::Value,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.doctor_update(id, &data, user_id)
}
