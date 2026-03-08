//! Medicine master and batch management commands

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn medicine_search(
    state: State<'_, AppState>, query: String, in_stock_only: Option<bool>
) -> Result<serde_json::Value, AppError> {
    // TODO: LIKE search on name + generic_name + composition
    // JOIN batches, SUM(quantity_in - quantity_sold - quantity_adjusted) AS total_stock
    // If in_stock_only=true: HAVING total_stock > 0
    // Return top 20 results ordered by name
    todo!("medicine_search")
}

#[tauri::command]
pub async fn medicine_get(
    state: State<'_, AppState>, id: i64
) -> Result<serde_json::Value, AppError> {
    // TODO: SELECT medicine + all active batches with quantity_on_hand
    todo!("medicine_get")
}

#[tauri::command]
pub async fn medicine_get_batch_by_barcode(
    state: State<'_, AppState>, barcode: String
) -> Result<Option<serde_json::Value>, AppError> {
    // TODO: SELECT batches JOIN medicines WHERE barcode=? AND is_active=1 AND expiry_date > date('now')
    todo!("medicine_get_batch_by_barcode")
}

#[tauri::command]
pub async fn medicine_list_batches(
    state: State<'_, AppState>, medicine_id: i64
) -> Result<serde_json::Value, AppError> {
    // TODO: SELECT batches WHERE medicine_id=? AND is_active=1 ORDER BY expiry_date ASC (FEFO order)
    todo!("medicine_list_batches")
}

#[tauri::command]
pub async fn medicine_create(
    state: State<'_, AppState>, data: serde_json::Value, user_id: i64
) -> Result<i64, AppError> {
    // TODO: validate required (name, generic_name, schedule, default_gst_rate), INSERT, audit
    todo!("medicine_create")
}

#[tauri::command]
pub async fn medicine_update(
    state: State<'_, AppState>, id: i64, data: serde_json::Value, user_id: i64
) -> Result<(), AppError> {
    // TODO: SELECT old values for audit, UPDATE medicines, write audit_log
    todo!("medicine_update")
}

#[tauri::command]
pub async fn medicine_delete(
    state: State<'_, AppState>, id: i64, user_id: i64
) -> Result<(), AppError> {
    // TODO: Check no active bills use this medicine
    // Soft delete: UPDATE SET deleted_at=now, is_active=0; write audit_log
    todo!("medicine_delete")
}

#[tauri::command]
pub async fn medicine_create_batch(
    state: State<'_, AppState>, data: serde_json::Value, user_id: i64
) -> Result<i64, AppError> {
    // TODO: validate required fields (medicine_id, batch_number, expiry_date, quantity_in, selling_price)
    // Auto-generate barcode: "MED{medicine_id:05}-{batch_number}"
    // INSERT INTO batches; write audit_log
    todo!("medicine_create_batch")
}

#[tauri::command]
pub async fn medicine_update_batch(
    state: State<'_, AppState>, batch_id: i64, data: serde_json::Value, user_id: i64
) -> Result<(), AppError> {
    // TODO: UPDATE batches; write audit_log
    todo!("medicine_update_batch")
}
