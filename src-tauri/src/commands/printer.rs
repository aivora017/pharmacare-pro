#![allow(unused_variables, dead_code)]
//! Printing - Thermal (ESC/POS), Normal A4/A5, Barcode label (ZPL)

use crate::{AppState, error::AppError};
use std::fs;
use std::path::PathBuf;
use tauri::State;

fn job_dir() -> Result<PathBuf, AppError> {
    let dir = std::env::current_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .join("print_jobs");
    fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(dir)
}

fn json_pretty(value: &serde_json::Value) -> Result<String, AppError> {
    serde_json::to_string_pretty(value).map_err(|e| AppError::Internal(e.to_string()))
}

#[tauri::command]
pub async fn printer_list_printers(_state: State<'_, AppState>) -> Result<Vec<String>, AppError> {
    Ok(vec![
        "System Default".to_string(),
        "Thermal Default".to_string(),
    ])
}
#[tauri::command]
pub async fn printer_print_bill(state: State<'_, AppState>, bill_id: i64, printer_type: String) -> Result<(), AppError> {
    if printer_type != "thermal" && printer_type != "normal" {
        return Err(AppError::Validation("printer_type must be thermal or normal".to_string()));
    }

    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    let bill = db.get_bill_json(bill_id)?;

    let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let (path, output_kind) = if printer_type == "thermal" {
        // ESC/POS-style baseline output: text blocks encoded as bytes.
        let file_name = format!("bill_{}_{}_{}.bin", bill_id, printer_type, stamp);
        let path = job_dir()?.join(file_name);
        let escpos_payload = format!(
            "\x1b@\nPHARMACARE PRO\nBILL #{}\n{}\n\n{}\n\n\x1dV\x00",
            bill_id,
            chrono::Utc::now().to_rfc3339(),
            json_pretty(&bill)?
        );
        fs::write(&path, escpos_payload.as_bytes()).map_err(|e| AppError::Internal(e.to_string()))?;
        (path, "escpos_bin")
    } else {
        let file_name = format!("bill_{}_{}_{}.html", bill_id, printer_type, stamp);
        let path = job_dir()?.join(file_name);
        let html = format!(
            "<!doctype html><html><head><meta charset=\"utf-8\"><title>Bill {}</title></head><body><h1>PharmaCare Pro</h1><p>Bill #{}</p><pre>{}</pre></body></html>",
            bill_id,
            bill_id,
            json_pretty(&bill)?
        );
        fs::write(&path, html).map_err(|e| AppError::Internal(e.to_string()))?;
        (path, "a4_html")
    };

    db.write_audit_log(
        "PRINT_BILL_REQUESTED",
        "printer",
        &bill_id.to_string(),
        None,
        Some(&serde_json::json!({
            "printer_type": printer_type,
            "output_kind": output_kind,
            "job_file": path.to_string_lossy(),
        }).to_string()),
        "System",
    )?;

    Ok(())
}
#[tauri::command]
pub async fn printer_print_labels(state: State<'_, AppState>, label_data: serde_json::Value, printer_name: String) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let file_name = format!("labels_{}_{}.json", printer_name.replace(' ', "_"), stamp);
    let path = job_dir()?.join(file_name);

    fs::write(&path, json_pretty(&label_data)?).map_err(|e| AppError::Internal(e.to_string()))?;

    db.write_audit_log(
        "PRINT_LABELS_REQUESTED",
        "printer",
        "labels",
        None,
        Some(&serde_json::json!({
            "printer_name": printer_name,
            "job_file": path.to_string_lossy(),
        }).to_string()),
        "System",
    )?;

    Ok(())
}
#[tauri::command]
pub async fn printer_test_print(state: State<'_, AppState>, printer_name: String, printer_type: String) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let file_name = format!("test_print_{}_{}.txt", printer_name.replace(' ', "_"), stamp);
    let path = job_dir()?.join(file_name);

    let content = format!(
        "PharmaCare Pro Printer Test\nPrinter: {}\nType: {}\nGenerated At: {}\n",
        printer_name,
        printer_type,
        chrono::Utc::now().to_rfc3339()
    );
    fs::write(&path, content).map_err(|e| AppError::Internal(e.to_string()))?;

    db.write_audit_log(
        "PRINT_TEST_REQUESTED",
        "printer",
        "test",
        None,
        Some(&serde_json::json!({
            "printer_name": printer_name,
            "printer_type": printer_type,
            "job_file": path.to_string_lossy(),
        }).to_string()),
        "System",
    )?;

    Ok(())
}

