#![allow(unused_variables, dead_code)]
//! Barcode generation and label printing
//! Barcodes use Code128 format: "MED{medicine_id:05}-{batch_number}"
//! For POS scanning: decode to find batch immediately

use crate::{error::AppError, AppState};
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

fn build_zpl_labels(labels: &[serde_json::Value]) -> String {
    let mut out = String::new();

    for label in labels {
        let medicine = label
            .get("medicine_name")
            .and_then(|v| v.as_str())
            .unwrap_or("MEDICINE");
        let barcode = label
            .get("barcode")
            .and_then(|v| v.as_str())
            .unwrap_or("N/A");
        let batch = label
            .get("batch_number")
            .and_then(|v| v.as_str())
            .unwrap_or("-");
        let expiry = label
            .get("expiry_date")
            .and_then(|v| v.as_str())
            .unwrap_or("-");
        let rack = label
            .get("rack_location")
            .and_then(|v| v.as_str())
            .unwrap_or("-");
        let price = label
            .get("selling_price")
            .map(|v| {
                if let Some(s) = v.as_str() {
                    s.to_string()
                } else {
                    v.to_string()
                }
            })
            .unwrap_or_else(|| "-".to_string());

        out.push_str("^XA\n");
        out.push_str("^PW800\n");
        out.push_str("^CF0,28\n");
        out.push_str(&format!("^FO30,30^FD{}^FS\n", medicine));
        out.push_str(&format!("^FO30,70^FDBatch: {}  Exp: {}^FS\n", batch, expiry));
        out.push_str(&format!("^FO30,110^FDRack: {}  MRP: {}^FS\n", rack, price));
        out.push_str(&format!("^BY2,2,70^FO30,150^BCN,70,Y,N,N^FD{}^FS\n", barcode));
        out.push_str("^XZ\n");
    }

    out
}

#[tauri::command]
pub async fn barcode_generate_for_batch(state: State<'_, AppState>, batch_id: i64) -> Result<String, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.barcode_generate_for_batch(batch_id)
}
#[tauri::command]
pub async fn barcode_generate_bulk(state: State<'_, AppState>, batch_ids: Vec<i64>) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.barcode_generate_bulk(&batch_ids)
}
#[tauri::command]
pub async fn barcode_print_labels(state: State<'_, AppState>, labels: serde_json::Value, printer_name: String) -> Result<(), AppError> {
    let items = labels
        .as_array()
        .ok_or_else(|| AppError::Validation("labels must be an array".to_string()))?;

    if items.is_empty() {
        return Err(AppError::Validation(
            "At least one label is required.".to_string(),
        ));
    }

    let zpl_payload = build_zpl_labels(items);
    let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let safe_printer = printer_name.replace(' ', "_");
    let zpl_file = format!("barcode_labels_{}_{}.zpl", safe_printer, stamp);
    let json_file = format!("barcode_labels_{}_{}.json", safe_printer, stamp);
    let zpl_path = job_dir()?.join(zpl_file);
    let json_path = job_dir()?.join(json_file);

    fs::write(&zpl_path, zpl_payload).map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(
        &json_path,
        serde_json::to_string_pretty(&labels).map_err(|e| AppError::Internal(e.to_string()))?,
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.write_audit_log(
        "BARCODE_LABELS_QUEUED",
        "printer",
        "barcode_labels",
        None,
        Some(
            &serde_json::json!({
                "printer_name": printer_name,
                "total_labels": items.len(),
                "zpl_job_file": zpl_path.to_string_lossy(),
                "json_job_file": json_path.to_string_lossy(),
            })
            .to_string(),
        ),
        "System",
    )?;

    Ok(())
}

