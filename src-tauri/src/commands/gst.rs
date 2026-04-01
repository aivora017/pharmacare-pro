use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn gst_get_gstr1(
    state: State<'_, AppState>,
    month: String,
    year: String,
) -> Result<Value, AppError> {
    state.db.lock()?.build_gstr1(&month, &year)
}

#[tauri::command]
pub async fn gst_export_gstr1_json(
    state: State<'_, AppState>,
    month: String,
    year: String,
) -> Result<Value, AppError> {
    let data = state.db.lock()?.build_gstr1(&month, &year)?;
    let invoices = data["invoices"].as_array().cloned().unwrap_or_default();
    let mut b2c_items: Vec<Value> = vec![];
    for inv in &invoices {
        b2c_items.push(serde_json::json!({
            "inum": inv["bill_number"],
            "idt":  inv["bill_date"],
            "val":  inv["total_amount"],
            "pos":  "27",
            "rchrg": "N",
            "inv_typ": "R",
            "itms": [{
                "num": 1,
                "itm_det": {
                    "txval": inv["taxable_amount"],
                    "rt":    inv["gst_rate"],
                    "camt":  inv["cgst_amount"],
                    "samt":  inv["sgst_amount"],
                    "iamt":  inv["igst_amount"]
                }
            }]
        }));
    }
    let export = serde_json::json!({
        "gstin": "",
        "fp": format!("{}{}", month, year),
        "b2c": b2c_items,
        "version": "GST3.0.4"
    });
    let dir = std::env::current_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .join("exports");
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
    let fname = format!("GSTR1_{}_{}.json", year, month);
    let fpath = dir.join(&fname);
    std::fs::write(&fpath, serde_json::to_string_pretty(&export)
        .map_err(|e| AppError::Internal(e.to_string()))?)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(serde_json::json!({
        "path": fpath.to_string_lossy(),
        "invoice_count": invoices.len(),
        "data": export
    }))
}

#[tauri::command]
pub async fn gst_get_gstr3b(
    state: State<'_, AppState>,
    month: String,
    year: String,
) -> Result<Value, AppError> {
    state.db.lock()?.build_gstr3b(&month, &year)
}

#[tauri::command]
pub async fn gst_get_purchase_bills_for_recon(
    state: State<'_, AppState>,
    month: String,
    year: String,
) -> Result<Value, AppError> {
    state.db.lock()?.get_purchase_bills_for_recon(&month, &year)
}

#[tauri::command]
pub async fn gst_reconcile_gstr2b(
    state: State<'_, AppState>,
    month: String,
    year: String,
    portal_data: Value,
) -> Result<Value, AppError> {
    let our = state.db.lock()?.get_purchase_bills_for_recon(&month, &year)?;
    let our_invoices = our["purchases"].as_array().cloned().unwrap_or_default();
    let portal_invoices = portal_data["invoices"].as_array().cloned().unwrap_or_default();
    let our_nums: std::collections::HashSet<String> = our_invoices.iter()
        .filter_map(|i| i["invoice_number"].as_str().map(|s| s.to_lowercase()))
        .collect();
    let portal_nums: std::collections::HashSet<String> = portal_invoices.iter()
        .filter_map(|i| i["invoice_number"].as_str().map(|s| s.to_lowercase()))
        .collect();
    let matched: Vec<&Value> = our_invoices.iter()
        .filter(|i| i["invoice_number"].as_str().map(|s| portal_nums.contains(&s.to_lowercase())).unwrap_or(false))
        .collect();
    let unmatched_ours: Vec<&Value> = our_invoices.iter()
        .filter(|i| !i["invoice_number"].as_str().map(|s| portal_nums.contains(&s.to_lowercase())).unwrap_or(false))
        .collect();
    let unmatched_portal: Vec<&Value> = portal_invoices.iter()
        .filter(|i| !i["invoice_number"].as_str().map(|s| our_nums.contains(&s.to_lowercase())).unwrap_or(false))
        .collect();
    Ok(serde_json::json!({
        "period": format!("{}/{}", month, year),
        "matched_count": matched.len(),
        "unmatched_ours": unmatched_ours,
        "unmatched_portal": unmatched_portal,
        "matched": matched
    }))
}

#[tauri::command]
pub async fn gst_generate_einvoice(
    state: State<'_, AppState>,
    bill_id: i64,
) -> Result<Value, AppError> {
    let bill = state.db.lock()?.get_bill_for_compliance(bill_id)?;
    Ok(serde_json::json!({
        "status": "pending_irn",
        "message": "E-Invoice generation requires IRP API credentials. Configure in Settings → GST Compliance.",
        "bill_number": bill["bill_number"],
        "net_amount": bill["net_amount"],
        "irn": null,
        "qr_code": null
    }))
}

#[tauri::command]
pub async fn gst_generate_ewaybill(
    state: State<'_, AppState>,
    bill_id: i64,
) -> Result<Value, AppError> {
    let bill = state.db.lock()?.get_bill_for_compliance(bill_id)?;
    Ok(serde_json::json!({
        "status": "pending_ewb",
        "message": "E-Way Bill generation requires NIC API credentials. Configure in Settings → GST Compliance.",
        "bill_number": bill["bill_number"],
        "net_amount": bill["net_amount"],
        "ewb_no": null,
        "ewb_date": null,
        "valid_until": null
    }))
}
