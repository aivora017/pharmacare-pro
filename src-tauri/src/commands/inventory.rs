#![allow(unused_variables, dead_code)]
//! Inventory queries and stock adjustments

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn inventory_get_stock(state: State<'_, AppState>, filters: Option<serde_json::Value>) -> Result<serde_json::Value, AppError> {
    // TODO: SELECT medicines + SUM(batch stock) per medicine; supports filters: category, low_stock, search
    todo!("inventory_get_stock")
}
#[tauri::command]
pub async fn inventory_get_low_stock(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: SELECT medicines WHERE total_stock <= reorder_level AND is_active=1
    todo!("inventory_get_low_stock")
}
#[tauri::command]
pub async fn inventory_get_expiry_list(state: State<'_, AppState>, within_days: Option<i64>) -> Result<serde_json::Value, AppError> {
    // TODO: SELECT batches WHERE expiry_date <= date('now', '+N days') AND quantity_on_hand > 0
    todo!("inventory_get_expiry_list")
}
#[tauri::command]
pub async fn inventory_adjust_stock(
    state: State<'_, AppState>, batch_id: i64, quantity: i64,
    adjustment_type: String, reason: String, user_id: i64
) -> Result<(), AppError> {
    // TODO: UPDATE batches.quantity_adjusted; INSERT stock_adjustments; audit
    todo!("inventory_adjust_stock")
}

