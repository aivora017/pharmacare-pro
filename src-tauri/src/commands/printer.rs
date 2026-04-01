use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn printer_print_bill(
    state: State<'_, AppState>,
    bill_id: i64,
    printer_name: Option<String>,
) -> Result<String, AppError> {
    let db = state.db.lock()?;
    let bill = db.get_bill(bill_id)?;
    let pharmacy_name = db.get_setting("pharmacy_name")?.unwrap_or_else(|| "PharmaCare Medical Store".to_string());
    let pharmacy_phone = db.get_setting("pharmacy_phone")?.unwrap_or_default();
    let pharmacy_address = db.get_setting("pharmacy_address")?.unwrap_or_default();
    let gstin = db.get_setting("gstin")?.unwrap_or_default();

    // Build ESC/POS byte sequence for 80mm thermal printer
    let mut esc: Vec<u8> = vec![];
    // Init + center align
    esc.extend_from_slice(b"\x1b\x40\x1b\x61\x01");
    // Big pharmacy name
    esc.extend_from_slice(b"\x1b\x21\x30");
    esc.extend_from_slice(pharmacy_name.trim_matches('"').as_bytes());
    esc.extend_from_slice(b"\n");
    esc.extend_from_slice(b"\x1b\x21\x00");
    if !pharmacy_address.trim_matches('"').is_empty() {
        esc.extend_from_slice(pharmacy_address.trim_matches('"').as_bytes());
        esc.extend_from_slice(b"\n");
    }
    if !pharmacy_phone.trim_matches('"').is_empty() {
        esc.extend_from_slice(format!("Ph: {}\n", pharmacy_phone.trim_matches('"')).as_bytes());
    }
    if !gstin.trim_matches('"').is_empty() {
        esc.extend_from_slice(format!("GSTIN: {}\n", gstin.trim_matches('"')).as_bytes());
    }
    esc.extend_from_slice(b"----------------------------------------\n");

    // Left align
    esc.extend_from_slice(b"\x1b\x61\x00");
    let bn = bill["bill_number"].as_str().unwrap_or("UNKNOWN");
    let bd = bill["bill_date"].as_str().unwrap_or("");
    let date_str = if bd.len() >= 10 { &bd[..10] } else { bd };
    esc.extend_from_slice(format!("Bill No: {}\nDate:    {}\n", bn, date_str).as_bytes());
    let cname = bill["customer_name"].as_str().unwrap_or("Walk-in");
    if cname != "Walk-in" {
        esc.extend_from_slice(format!("Patient: {}\n", cname).as_bytes());
    }
    esc.extend_from_slice(b"----------------------------------------\n");

    // Header
    esc.extend_from_slice(b"\x1b\x45\x01");
    esc.extend_from_slice(b"Medicine              Qty   Rate    Total\n");
    esc.extend_from_slice(b"\x1b\x45\x00");
    esc.extend_from_slice(b"----------------------------------------\n");

    // Items
    if let Some(items) = bill["items"].as_array() {
        for item in items {
            let name = item["medicine_name"].as_str().unwrap_or("");
            let qty = item["quantity"].as_i64().unwrap_or(0);
            let rate = item["unit_price"].as_f64().unwrap_or(0.0);
            let total = item["total_amount"].as_f64().unwrap_or(0.0);
            let disc = item["discount_percent"].as_f64().unwrap_or(0.0);
            let short: String = name.chars().take(20).collect();
            let line = format!("{:<20} {:>3}  {:>6.2} {:>7.2}\n", short, qty, rate, total);
            esc.extend_from_slice(line.as_bytes());
            if disc > 0.0 {
                esc.extend_from_slice(format!("  Discount: {:.0}%\n", disc).as_bytes());
            }
        }
    }
    esc.extend_from_slice(b"----------------------------------------\n");

    // Totals
    let net = bill["net_amount"].as_f64().unwrap_or(0.0);
    let cgst = bill["cgst_amount"].as_f64().unwrap_or(0.0);
    let sgst = bill["sgst_amount"].as_f64().unwrap_or(0.0);
    let igst = bill["igst_amount"].as_f64().unwrap_or(0.0);
    let disc = bill["discount_amount"].as_f64().unwrap_or(0.0);
    let round_off = bill["round_off"].as_f64().unwrap_or(0.0);

    if disc > 0.0 { esc.extend_from_slice(format!("Discount:              {:>10.2}\n", disc).as_bytes()); }
    if cgst > 0.0 { esc.extend_from_slice(format!("CGST:                  {:>10.2}\n", cgst).as_bytes()); }
    if sgst > 0.0 { esc.extend_from_slice(format!("SGST:                  {:>10.2}\n", sgst).as_bytes()); }
    if igst > 0.0 { esc.extend_from_slice(format!("IGST:                  {:>10.2}\n", igst).as_bytes()); }
    if round_off != 0.0 { esc.extend_from_slice(format!("Round off:             {:>10.2}\n", round_off).as_bytes()); }
    esc.extend_from_slice(b"----------------------------------------\n");
    esc.extend_from_slice(b"\x1b\x45\x01");
    esc.extend_from_slice(format!("TOTAL:                 {:>10.2}\n", net).as_bytes());
    esc.extend_from_slice(b"\x1b\x45\x00");

    if let Some(pays) = bill["payments"].as_array() {
        for p in pays {
            let mode = p["payment_mode"].as_str().unwrap_or("").to_uppercase();
            let amt = p["amount"].as_f64().unwrap_or(0.0);
            esc.extend_from_slice(format!("Paid ({}): {:>18.2}\n", mode, amt).as_bytes());
        }
    }

    esc.extend_from_slice(b"----------------------------------------\n");
    esc.extend_from_slice(b"\x1b\x61\x01");
    esc.extend_from_slice(b"Thank you! Get well soon.\n");
    esc.extend_from_slice(b"Powered by PharmaCare Pro\n\n\n");
    esc.extend_from_slice(b"\x1d\x56\x41\x00"); // Cut

    // Save to print_jobs dir
    let dir = std::env::current_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .join("print_jobs");
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
    let fname = format!("{}.bin", bn.replace('/', "-"));
    let fpath = dir.join(&fname);
    std::fs::write(&fpath, &esc).map_err(|e| AppError::Internal(e.to_string()))?;

    // Try to send to printer
    let _stored = db.get_setting("thermal_printer")
        .ok().flatten().unwrap_or_default();
    let _stored_clean = _stored.trim_matches('"').to_string();
    let pname: String = match printer_name {
        Some(ref p) if !p.is_empty() => p.clone(),
        _ => _stored_clean,
    };

    if !pname.is_empty() {
        #[cfg(target_os = "windows")]
        { let _ = std::process::Command::new("cmd").args(["/C","print","/D:",&pname,fpath.to_str().unwrap_or("")]).spawn(); }
        #[cfg(target_os = "linux")]
        { let _ = std::process::Command::new("lp").args(["-d",&pname,fpath.to_str().unwrap_or("")]).spawn(); }
    }

    Ok(fpath.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn printer_test(
    _state: State<'_, AppState>,
    printer_name: String,
) -> Result<(), AppError> {
    let mut esc = vec![];
    esc.extend_from_slice(b"\x1b\x40\x1b\x61\x01\x1b\x21\x10");
    esc.extend_from_slice(b"PharmaCare Pro\n");
    esc.extend_from_slice(b"\x1b\x21\x00");
    esc.extend_from_slice(b"Printer test successful!\n");
    esc.extend_from_slice(b"If you read this, printing works.\n\n\n");
    esc.extend_from_slice(b"\x1d\x56\x41\x00");
    let dir = std::env::current_dir().map_err(|e| AppError::Internal(e.to_string()))?.join("print_jobs");
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(e.to_string()))?;
    let fpath = dir.join("test_print.bin");
    std::fs::write(&fpath, &esc).map_err(|e| AppError::Internal(e.to_string()))?;
    #[cfg(target_os = "windows")]
    { let _ = std::process::Command::new("cmd").args(["/C","print","/D:",&printer_name,fpath.to_str().unwrap_or("")]).spawn(); }
    #[cfg(target_os = "linux")]
    { let _ = std::process::Command::new("lp").args(["-d",&printer_name,fpath.to_str().unwrap_or("")]).spawn(); }
    Ok(())
}
