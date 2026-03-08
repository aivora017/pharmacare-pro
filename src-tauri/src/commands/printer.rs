#![allow(unused_variables, dead_code)]
//! Printing - Thermal (ESC/POS), Normal A4/A5, Barcode label (ZPL)

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn printer_list_printers(_state: State<'_, AppState>) -> Result<Vec<String>, AppError> {
    // TODO: use OS print API to list available printers
    todo!("printer_list_printers")
}
#[tauri::command]
pub async fn printer_print_bill(state: State<'_, AppState>, bill_id: i64, printer_type: String) -> Result<(), AppError> {
    // TODO: if thermal: generate ESC/POS byte sequence and send to printer
    //       if normal:  generate PDF with jspdf (via shell command) and print
    todo!("printer_print_bill")
}
#[tauri::command]
pub async fn printer_print_labels(state: State<'_, AppState>, label_data: serde_json::Value, printer_name: String) -> Result<(), AppError> {
    // TODO: generate ZPL for Zebra; use OS print for Dymo
    todo!("printer_print_labels")
}
#[tauri::command]
pub async fn printer_test_print(state: State<'_, AppState>, printer_name: String, printer_type: String) -> Result<(), AppError> {
    // TODO: send a test page to the specified printer
    todo!("printer_test_print")
}

