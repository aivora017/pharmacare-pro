#![allow(unused_variables, dead_code)]
//! Barcode generation and label printing
//! Barcodes use Code128 format: "MED{medicine_id:05}-{batch_number}"
//! For POS scanning: decode to find batch immediately

use crate::{error::AppError, AppState};
use tauri::State;

#[tauri::command]
pub async fn barcode_generate_for_batch(
    state: State<'_, AppState>,
    batch_id: i64,
) -> Result<String, AppError> {
    Err(AppError::Validation(
        "Barcode generation is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn barcode_generate_bulk(
    state: State<'_, AppState>,
    batch_ids: Vec<i64>,
) -> Result<serde_json::Value, AppError> {
    Err(AppError::Validation(
        "Bulk barcode generation is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn barcode_print_labels(
    state: State<'_, AppState>,
    labels: serde_json::Value,
    printer_name: String,
) -> Result<(), AppError> {
    Err(AppError::Validation(
        "Barcode label printing is not implemented yet.".to_string(),
    ))
}
