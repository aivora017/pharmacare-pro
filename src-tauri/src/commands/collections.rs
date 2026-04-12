use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn collection_list_outstanding(state: State<'_, AppState>) -> Result<Value, AppError> {
    state.db.lock()?.list_outstanding_customers()
}

#[tauri::command]
pub async fn collection_record(
    state: State<'_, AppState>,
    customer_id: i64,
    amount: f64,
    payment_mode: String,
    reference_no: String,
    notes: String,
    user_id: i64,
) -> Result<i64, AppError> {
    state.db.lock()?.record_collection(customer_id, amount, &payment_mode, &reference_no, &notes, user_id)
}

#[tauri::command]
pub async fn collection_history(state: State<'_, AppState>, customer_id: i64) -> Result<Value, AppError> {
    state.db.lock()?.get_collection_history(customer_id)
}

#[tauri::command]
pub async fn dashboard_extended(state: State<'_, AppState>) -> Result<Value, AppError> {
    state.db.lock()?.dashboard_extended()
}
