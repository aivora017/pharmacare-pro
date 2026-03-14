#![allow(unused_variables, dead_code)]
//! Barcode generation and label printing
//! Barcodes use Code128 format: "MED{medicine_id:05}-{batch_number}"
//! For POS scanning: decode to find batch immediately

use crate::{error::AppError, AppState};
use crate::commands::permission::require_permission;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::State;

fn job_dir() -> Result<PathBuf, AppError> {
    let dir = std::env::current_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .join("print_jobs");
    fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(dir)
}

fn simulated_dispatch_from_value(raw: Option<String>) -> Option<Result<(), AppError>> {
    match raw.as_deref() {
        Some("success") => Some(Ok(())),
        Some("fail") => Some(Err(AppError::Internal(
            "Simulated barcode dispatch failure.".to_string(),
        ))),
        _ => None,
    }
}

fn simulated_dispatch_result() -> Option<Result<(), AppError>> {
    simulated_dispatch_from_value(std::env::var("PHARMACARE_PRINT_SIMULATE").ok())
}

fn apply_dispatch_status(
    db: &crate::db::Database,
    file_name: &str,
    result: Result<(), AppError>,
) -> Result<(), AppError> {
    match result {
        Ok(()) => {
            db.update_print_job_status(file_name, "sent", None, false)?;
            Ok(())
        }
        Err(error) => {
            let err_text = error.to_string();
            db.update_print_job_status(file_name, "failed", Some(&err_text), false)?;
            Err(error)
        }
    }
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

fn normalize_setting_value(raw: Option<String>) -> Option<String> {
    raw.map(|value| value.trim().trim_matches('"').to_string())
        .filter(|value| !value.is_empty())
}

fn resolve_barcode_printer_name(
    db: &crate::db::Database,
    requested_printer_name: &str,
) -> Option<String> {
    let requested = requested_printer_name.trim();
    if !requested.is_empty() && requested != "System Default" {
        return Some(requested.to_string());
    }
    normalize_setting_value(db.get_setting("barcode_printer").ok().flatten())
}

#[cfg(target_os = "windows")]
fn dispatch_zpl_job(path: &PathBuf, printer_name: Option<&str>) -> Result<(), AppError> {
    if let Some(simulated) = simulated_dispatch_result() {
        return simulated;
    }

    let path_str = path.to_string_lossy().replace('\'', "''");
    let status = if let Some(name) = printer_name {
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "$bytes = [System.IO.File]::ReadAllBytes('{}'); [System.Text.Encoding]::ASCII.GetString($bytes) | Out-Printer -Name '{}'",
                    path_str,
                    name.replace('\'', "''")
                ),
            ])
            .status()
    } else {
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "$bytes = [System.IO.File]::ReadAllBytes('{}'); [System.Text.Encoding]::ASCII.GetString($bytes) | Out-Printer",
                    path_str
                ),
            ])
            .status()
    }
    .map_err(|e| AppError::Internal(format!("Could not start barcode print command: {}", e)))?;

    if !status.success() {
        return Err(AppError::Internal(
            "Barcode print command failed. Check printer configuration.".to_string(),
        ));
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn dispatch_zpl_job(path: &PathBuf, printer_name: Option<&str>) -> Result<(), AppError> {
    if let Some(simulated) = simulated_dispatch_result() {
        return simulated;
    }

    let mut cmd = Command::new("lp");
    if let Some(name) = printer_name {
        let clean = name.trim();
        if !clean.is_empty() && clean != "System Default" {
            cmd.arg("-d").arg(clean);
        }
    }

    let status = cmd
        .args(["-o", "raw"])
        .arg(path)
        .status()
        .map_err(|e| AppError::Internal(format!("Could not start barcode print command: {}", e)))?;

    if !status.success() {
        return Err(AppError::Internal(
            "Barcode print command failed. Check printer configuration.".to_string(),
        ));
    }

    Ok(())
}

#[tauri::command]
pub async fn barcode_generate_for_batch(
    state: State<'_, AppState>,
    batch_id: i64,
    actor_user_id: i64,
) -> Result<String, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "barcodes")?;
    db.barcode_generate_for_batch(batch_id)
}
#[tauri::command]
pub async fn barcode_generate_bulk(
    state: State<'_, AppState>,
    batch_ids: Vec<i64>,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "barcodes")?;
    db.barcode_generate_bulk(&batch_ids)
}
#[tauri::command]
pub async fn barcode_print_labels(
    state: State<'_, AppState>,
    labels: serde_json::Value,
    printer_name: String,
    actor_user_id: i64,
) -> Result<(), AppError> {
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
    require_permission(&db, actor_user_id, "barcodes")?;
    let resolved_printer = resolve_barcode_printer_name(&db, &printer_name);
    let zpl_file_name = zpl_path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("barcode_labels.zpl")
        .to_string();
    let zpl_size = fs::metadata(&zpl_path)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .len() as i64;

    db.create_print_job(
        "labels",
        Some("barcode"),
        resolved_printer.as_deref(),
        &zpl_file_name,
        &zpl_path.to_string_lossy(),
        zpl_size,
    )?;

    apply_dispatch_status(&db, &zpl_file_name, dispatch_zpl_job(&zpl_path, resolved_printer.as_deref()))?;

    db.write_audit_log(
        "BARCODE_LABELS_QUEUED",
        "printer",
        "barcode_labels",
        None,
        Some(
            &serde_json::json!({
                "printer_name": printer_name,
                "resolved_printer": resolved_printer,
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

#[cfg(test)]
mod tests {
    use super::{apply_dispatch_status, simulated_dispatch_from_value};
    use crate::db::Database;
    use crate::error::AppError;
    use std::path::PathBuf;

    fn test_db_path(name: &str) -> PathBuf {
        let suffix = chrono::Utc::now()
            .timestamp_nanos_opt()
            .unwrap_or_default();
        std::env::temp_dir().join(format!("pharmacare_barcode_test_{}_{}.db", name, suffix))
    }

    fn print_job_by_name(db: &Database, file_name: &str) -> serde_json::Value {
        let list = db.list_print_jobs(200).expect("list print jobs");
        let items = list
            .get("items")
            .and_then(|v| v.as_array())
            .expect("items array expected");
        items
            .iter()
            .find(|item| item.get("file_name").and_then(|v| v.as_str()) == Some(file_name))
            .cloned()
            .expect("target print job not found")
    }

    #[test]
    fn simulated_dispatch_override_parses_success_and_failure() {
        let success = simulated_dispatch_from_value(Some("success".to_string()));
        assert!(matches!(success, Some(Ok(()))));

        let fail = simulated_dispatch_from_value(Some("fail".to_string()));
        assert!(matches!(fail, Some(Err(AppError::Internal(_)))));

        let none = simulated_dispatch_from_value(Some("other".to_string()));
        assert!(none.is_none());
    }

    #[test]
    fn apply_dispatch_status_updates_sent_and_failed_states() {
        let db_path = test_db_path("dispatch_status");
        let db = Database::init_for_test(db_path.clone()).expect("test db init");

        let sent_file = "barcode_dispatch_sent_test.zpl";
        db.create_print_job(
            "labels",
            Some("barcode"),
            Some("System Default"),
            sent_file,
            "/tmp/barcode_dispatch_sent_test.zpl",
            64,
        )
        .expect("create sent test job");

        apply_dispatch_status(&db, sent_file, Ok(())).expect("sent update");
        let sent = print_job_by_name(&db, sent_file);
        assert_eq!(sent.get("status").and_then(|v| v.as_str()), Some("sent"));

        let failed_file = "barcode_dispatch_failed_test.zpl";
        db.create_print_job(
            "labels",
            Some("barcode"),
            Some("System Default"),
            failed_file,
            "/tmp/barcode_dispatch_failed_test.zpl",
            64,
        )
        .expect("create failed test job");

        let failed = apply_dispatch_status(
            &db,
            failed_file,
            Err(AppError::Internal("forced barcode failure".to_string())),
        );
        assert!(matches!(failed, Err(AppError::Internal(_))));

        let failed_row = print_job_by_name(&db, failed_file);
        assert_eq!(failed_row.get("status").and_then(|v| v.as_str()), Some("failed"));
        let last_error = failed_row
            .get("last_error")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        assert!(last_error.contains("forced barcode failure"));

        let _ = std::fs::remove_file(db_path);
    }
}

