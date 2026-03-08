//! Barcode generation and label printing
//! Barcodes use Code128 format: "MED{medicine_id:05}-{batch_number}"
//! For POS scanning: decode to find batch immediately

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn barcode_generate_for_batch(state: State<'_, AppState>, batch_id: i64) -> Result<String, AppError> {
    // TODO: SELECT batch, generate barcode string, UPDATE batches SET barcode=?, return barcode
    todo!("barcode_generate_for_batch")
}
#[tauri::command]
pub async fn barcode_generate_bulk(state: State<'_, AppState>, batch_ids: Vec<i64>) -> Result<serde_json::Value, AppError> {
    // TODO: generate barcodes for all batches in list, return {batch_id, barcode, medicine_name, expiry}[]
    todo!("barcode_generate_bulk")
}
#[tauri::command]
pub async fn barcode_print_labels(state: State<'_, AppState>, labels: serde_json::Value, printer_name: String) -> Result<(), AppError> {
    // TODO: generate ZPL string for Zebra or send to system printer for Dymo/TSC
    todo!("barcode_print_labels")
}
