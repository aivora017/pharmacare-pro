#![allow(unused_variables, dead_code)]
//! Printing - Thermal (ESC/POS), Normal A4/A5, Barcode label (ZPL)

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
            "Simulated print dispatch failure.".to_string(),
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
    is_retry: bool,
) -> Result<(), AppError> {
    match result {
        Ok(()) => {
            db.update_print_job_status(file_name, "sent", None, is_retry)?;
            Ok(())
        }
        Err(error) => {
            let err_text = error.to_string();
            db.update_print_job_status(file_name, "failed", Some(&err_text), is_retry)?;
            Err(error)
        }
    }
}

#[tauri::command]
pub async fn printer_list_jobs(
    state: State<'_, AppState>,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "barcodes")?;
    db.list_print_jobs(200)
}

#[tauri::command]
pub async fn printer_requeue_job(
    state: State<'_, AppState>,
    file_name: String,
    printer_name: String,
    actor_user_id: i64,
) -> Result<(), AppError> {
    let clean_file_name = file_name.trim().to_string();
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "barcodes")?;
    let source = match db.get_print_job_path_by_name(&clean_file_name)? {
        Some(path) => PathBuf::from(path),
        None => job_dir()?.join(&clean_file_name),
    };

    if !source.exists() {
        return Err(AppError::Validation("Print job file not found.".to_string()));
    }

    let ext = source
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let printer_type = if ext == "html" { "normal" } else { "thermal" };

    apply_dispatch_status(
        &db,
        &clean_file_name,
        dispatch_print_job(&source, printer_type, Some(printer_name.trim())),
        true,
    )?;

    db.write_audit_log(
        "PRINT_JOB_REQUEUED",
        "printer",
        source.file_name().and_then(|v| v.to_str()).unwrap_or("job"),
        None,
        Some(
            &serde_json::json!({
                "source": source.to_string_lossy(),
                "printer_name": printer_name,
            })
            .to_string(),
        ),
        "System",
    )?;

    Ok(())
}

fn normalize_setting_value(raw: Option<String>) -> Option<String> {
    raw.map(|value| value.trim().trim_matches('"').to_string())
        .filter(|value| !value.is_empty())
}

fn resolve_default_printer_name(db: &crate::db::Database, printer_type: &str) -> Option<String> {
    let key = if printer_type == "thermal" {
        "thermal_printer"
    } else {
        "normal_printer"
    };
    normalize_setting_value(db.get_setting(key).ok().flatten())
}

#[cfg(target_os = "windows")]
fn detect_system_printers() -> Vec<String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-Printer | Select-Object -ExpandProperty Name",
        ])
        .output();

    match output {
        Ok(result) if result.status.success() => String::from_utf8_lossy(&result.stdout)
            .lines()
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect(),
        _ => vec![],
    }
}

#[cfg(not(target_os = "windows"))]
fn detect_system_printers() -> Vec<String> {
    let output = Command::new("lpstat").args(["-a"]).output();

    match output {
        Ok(result) if result.status.success() => String::from_utf8_lossy(&result.stdout)
            .lines()
            .filter_map(|line| line.split_whitespace().next().map(|v| v.trim().to_string()))
            .filter(|name| !name.is_empty())
            .collect(),
        _ => vec![],
    }
}

fn json_pretty(value: &serde_json::Value) -> Result<String, AppError> {
    serde_json::to_string_pretty(value).map_err(|e| AppError::Internal(e.to_string()))
}

fn bill_string(bill: &serde_json::Value, key: &str, fallback: &str) -> String {
    bill.get(key)
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
        .unwrap_or_else(|| fallback.to_string())
}

fn bill_f64(bill: &serde_json::Value, key: &str) -> f64 {
    bill.get(key).and_then(|v| v.as_f64()).unwrap_or(0.0)
}

fn repeat_char(ch: char, count: usize) -> String {
    std::iter::repeat_n(ch, count).collect()
}

fn fit_text(value: &str, width: usize) -> String {
    value.chars().take(width).collect()
}

fn pad_right(value: &str, width: usize) -> String {
    let used = value.chars().count();
    if used >= width {
        return fit_text(value, width);
    }
    format!("{}{}", value, repeat_char(' ', width - used))
}

fn two_col_line(left: &str, right: &str, width: usize) -> String {
    let right_len = right.chars().count();
    let min_gap = 1;
    if right_len + min_gap >= width {
        return format!("{} {}", fit_text(left, width / 2), fit_text(right, width / 2));
    }
    let left_width = width - right_len - min_gap;
    format!("{}{}{}", fit_text(left, left_width), repeat_char(' ', min_gap), right)
}

fn thermal_line_width_chars(db: &crate::db::Database) -> usize {
    let width_setting = normalize_setting_value(db.get_setting("thermal_width").ok().flatten())
        .unwrap_or_else(|| "80".to_string());
    if width_setting == "58" {
        32
    } else {
        42
    }
}

fn render_thermal_bill_text(bill: &serde_json::Value, bill_id: i64, width: usize) -> String {
    let bill_number = bill_string(bill, "bill_number", &format!("BILL-{}", bill_id));
    let bill_date = bill_string(bill, "bill_date", "-");
    let subtotal = bill_f64(bill, "subtotal");
    let discount = bill_f64(bill, "discount_amount");
    let gst_total = bill_f64(bill, "cgst_amount") + bill_f64(bill, "sgst_amount") + bill_f64(bill, "igst_amount");
    let net = bill_f64(bill, "net_amount");

    let mut lines = Vec::new();
    let divider = repeat_char('-', width);

    lines.push("PHARMACARE PRO".to_string());
    lines.push(divider.clone());
    lines.push(fit_text(&format!("Bill No: {}", bill_number), width));
    lines.push(fit_text(&format!("Bill Date: {}", bill_date), width));
    lines.push(divider.clone());

    if let Some(items) = bill.get("items").and_then(|v| v.as_array()) {
        for item in items {
            let medicine = item
                .get("medicine_name")
                .and_then(|v| v.as_str())
                .unwrap_or("Medicine");
            let qty = item.get("quantity").and_then(|v| v.as_i64()).unwrap_or(0);
            let rate = item.get("unit_price").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let total = item.get("total_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);

            lines.push(fit_text(medicine, width));
            lines.push(two_col_line(
                &format!("{} x {:.2}", qty, rate),
                &format!("{:.2}", total),
                width,
            ));
        }
    }

    lines.push(divider.clone());
    lines.push(two_col_line("Subtotal", &format!("{:.2}", subtotal), width));
    lines.push(two_col_line("Discount", &format!("{:.2}", discount), width));
    lines.push(two_col_line("GST", &format!("{:.2}", gst_total), width));
    lines.push(two_col_line("Net Total", &format!("{:.2}", net), width));

    if let Some(payments) = bill.get("payments").and_then(|v| v.as_array()) {
        lines.push(divider.clone());
        lines.push("Payments".to_string());
        for payment in payments {
            let mode = payment
                .get("payment_mode")
                .and_then(|v| v.as_str())
                .unwrap_or("mode")
                .to_ascii_uppercase();
            let amount = payment.get("amount").and_then(|v| v.as_f64()).unwrap_or(0.0);
            lines.push(two_col_line(&mode, &format!("{:.2}", amount), width));
        }
    }

    lines.push(divider);
    lines.push("Thank you for your purchase.".to_string());
    lines.push("".to_string());

    lines.join("\n")
}

fn render_thermal_bill_escpos(bill: &serde_json::Value, bill_id: i64, width: usize) -> Vec<u8> {
    let text = render_thermal_bill_text(bill, bill_id, width);
    let mut out = Vec::with_capacity(text.len() + 64);

    // ESC @ (initialize)
    out.extend_from_slice(&[0x1B, 0x40]);

    for (index, line) in text.lines().enumerate() {
        if index == 0 {
            // Center + emphasized title for receipt header.
            out.extend_from_slice(&[0x1B, 0x61, 0x01]);
            out.extend_from_slice(&[0x1B, 0x45, 0x01]);
            out.extend_from_slice(line.as_bytes());
            out.push(b'\n');
            out.extend_from_slice(&[0x1B, 0x45, 0x00]);
            out.extend_from_slice(&[0x1B, 0x61, 0x00]);
            continue;
        }

        out.extend_from_slice(line.as_bytes());
        out.push(b'\n');
    }

    // Feed and partial cut to finish the receipt.
    out.extend_from_slice(&[0x1B, 0x64, 0x03]);
    out.extend_from_slice(&[0x1D, 0x56, 0x42, 0x00]);
    out
}

fn render_a4_bill_html(bill: &serde_json::Value, bill_id: i64) -> String {
    let bill_number = bill_string(bill, "bill_number", &format!("BILL-{}", bill_id));
    let bill_date = bill_string(bill, "bill_date", "-");
    let subtotal = bill_f64(bill, "subtotal");
    let discount = bill_f64(bill, "discount_amount");
    let taxable = bill_f64(bill, "taxable_amount");
    let cgst = bill_f64(bill, "cgst_amount");
    let sgst = bill_f64(bill, "sgst_amount");
    let igst = bill_f64(bill, "igst_amount");
    let net = bill_f64(bill, "net_amount");

    let mut rows = String::new();
    if let Some(items) = bill.get("items").and_then(|v| v.as_array()) {
        for item in items {
            let medicine = item
                .get("medicine_name")
                .and_then(|v| v.as_str())
                .unwrap_or("Medicine");
            let batch = item.get("batch_number").and_then(|v| v.as_str()).unwrap_or("-");
            let qty = item.get("quantity").and_then(|v| v.as_i64()).unwrap_or(0);
            let rate = item.get("unit_price").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let total = item.get("total_amount").and_then(|v| v.as_f64()).unwrap_or(0.0);

            rows.push_str(&format!(
                "<tr><td>{}</td><td>{}</td><td style=\"text-align:right\">{}</td><td style=\"text-align:right\">{:.2}</td><td style=\"text-align:right\">{:.2}</td></tr>",
                medicine, batch, qty, rate, total
            ));
        }
    }

    format!(
        "<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>Bill {bill_number}</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 16px; color: #0f172a; }}
    .header {{ display: flex; justify-content: space-between; margin-bottom: 16px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
    th, td {{ border: 1px solid #cbd5e1; padding: 6px; font-size: 12px; }}
    th {{ background: #f8fafc; text-align: left; }}
    .totals {{ margin-top: 16px; width: 320px; margin-left: auto; }}
    .totals td {{ border: 1px solid #cbd5e1; }}
  </style>
</head>
<body>
  <div class=\"header\">
    <div>
      <h2 style=\"margin:0\">PharmaCare Pro</h2>
      <p style=\"margin:4px 0 0 0\">Retail Invoice</p>
    </div>
    <div>
      <p style=\"margin:0\"><strong>Bill No:</strong> {bill_number}</p>
      <p style=\"margin:4px 0 0 0\"><strong>Date:</strong> {bill_date}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
    </thead>
    <tbody>
      {rows}
    </tbody>
  </table>

  <table class=\"totals\">
    <tbody>
      <tr><td>Subtotal</td><td style=\"text-align:right\">{subtotal:.2}</td></tr>
      <tr><td>Discount</td><td style=\"text-align:right\">{discount:.2}</td></tr>
      <tr><td>Taxable</td><td style=\"text-align:right\">{taxable:.2}</td></tr>
      <tr><td>CGST</td><td style=\"text-align:right\">{cgst:.2}</td></tr>
      <tr><td>SGST</td><td style=\"text-align:right\">{sgst:.2}</td></tr>
      <tr><td>IGST</td><td style=\"text-align:right\">{igst:.2}</td></tr>
      <tr><td><strong>Net Total</strong></td><td style=\"text-align:right\"><strong>{net:.2}</strong></td></tr>
    </tbody>
  </table>
</body>
</html>"
    )
}

#[cfg(target_os = "windows")]
fn escape_ps_single_quoted(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(target_os = "windows")]
fn dispatch_windows_thermal_raw(path: &PathBuf, printer_name: Option<&str>) -> Result<(), AppError> {
    let path_escaped = escape_ps_single_quoted(&path.to_string_lossy());
    let printer_escaped = escape_ps_single_quoted(printer_name.unwrap_or(""));

    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
$path = '{path_escaped}'
$printerName = '{printer_escaped}'
if ([string]::IsNullOrWhiteSpace($printerName)) {{
  $defaultPrinter = Get-CimInstance Win32_Printer | Where-Object Default -eq $true | Select-Object -First 1
  if ($null -eq $defaultPrinter -or [string]::IsNullOrWhiteSpace($defaultPrinter.Name)) {{
    throw 'No default printer configured.'
  }}
  $printerName = $defaultPrinter.Name
}}

$rawPrinterHelper = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{{
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    public class DOCINFO
    {{
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }}

    [DllImport("winspool.Drv", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true, CharSet=CharSet.Unicode)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, [In] DOCINFO pDocInfo);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static bool SendBytesToPrinter(string printerName, byte[] bytes)
    {{
        IntPtr hPrinter = IntPtr.Zero;
        IntPtr pUnmanagedBytes = IntPtr.Zero;
        int written = 0;

        try
        {{
            if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            {{
                return false;
            }}

            var docInfo = new DOCINFO {{ pDocName = "PharmaCare Thermal Receipt", pDataType = "RAW" }};
            if (!StartDocPrinter(hPrinter, 1, docInfo))
            {{
                return false;
            }}

            if (!StartPagePrinter(hPrinter))
            {{
                EndDocPrinter(hPrinter);
                return false;
            }}

            pUnmanagedBytes = Marshal.AllocHGlobal(bytes.Length);
            Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
            bool ok = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            return ok && written == bytes.Length;
        }}
        finally
        {{
            if (pUnmanagedBytes != IntPtr.Zero)
            {{
                Marshal.FreeHGlobal(pUnmanagedBytes);
            }}

            if (hPrinter != IntPtr.Zero)
            {{
                ClosePrinter(hPrinter);
            }}
        }}
    }}
}}
"@

if (-not ([System.Management.Automation.PSTypeName]'RawPrinterHelper').Type) {{
  Add-Type -TypeDefinition $rawPrinterHelper | Out-Null
}}

$bytes = [System.IO.File]::ReadAllBytes($path)
if ($bytes.Length -le 0) {{
  throw 'Thermal payload is empty.'
}}

if (-not [RawPrinterHelper]::SendBytesToPrinter($printerName, $bytes)) {{
  throw "RAW spool failed for printer: $printerName"
}}
"#,
    );

    let status = Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .status()
        .map_err(|e| AppError::Internal(format!("Could not start RAW thermal print command: {}", e)))?;

    if status.success() {
        Ok(())
    } else {
        Err(AppError::Internal(
            "RAW thermal print command failed.".to_string(),
        ))
    }
}

#[cfg(target_os = "windows")]
fn dispatch_print_job(
    path: &PathBuf,
    printer_type: &str,
    printer_name: Option<&str>,
) -> Result<(), AppError> {
    if let Some(simulated) = simulated_dispatch_result() {
        return simulated;
    }

    let path_str = path.to_string_lossy().to_string();
    let preferred = printer_name
        .map(|v| v.trim())
        .filter(|v| !v.is_empty() && *v != "System Default" && *v != "Thermal Default" && *v != "Normal Default");

    let status = if printer_type == "thermal" {
        // Try true RAW bytes first for ESC/POS-capable printers, fallback to notepad if unavailable.
        if dispatch_windows_thermal_raw(path, preferred).is_ok() {
            return Ok(());
        }

        if let Some(name) = preferred {
            Command::new("cmd")
                .args(["/C", &format!("notepad /pt \"{}\" \"{}\"", path_str, name.replace('"', ""))])
                .status()
        } else {
            Command::new("cmd")
                .args(["/C", &format!("notepad /p \"{}\"", path_str)])
                .status()
        }
    } else {
        if let Some(name) = preferred {
            Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!(
                        "Start-Process -FilePath '{}' -Verb PrintTo -ArgumentList '\"{}\"'",
                        path.to_string_lossy().replace('\'', "''"),
                        name.replace('"', "")
                    ),
                ])
                .status()
        } else {
            Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!("Start-Process -FilePath '{}' -Verb Print", path.to_string_lossy().replace('\'', "''")),
                ])
                .status()
        }
    }
    .map_err(|e| AppError::Internal(format!("Could not start print command: {}", e)))?;

    if !status.success() {
        return Err(AppError::Internal(
            "Print command failed. Please check printer status and retry.".to_string(),
        ));
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn dispatch_print_job(path: &PathBuf, printer_type: &str, printer_name: Option<&str>) -> Result<(), AppError> {
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
    if printer_type == "thermal" {
        cmd.args(["-o", "raw"]);
    }
    let status = cmd
        .arg(path)
        .status()
        .map_err(|e| AppError::Internal(format!("Could not start lp command: {}", e)))?;

    if !status.success() {
        return Err(AppError::Internal(
            "Print command failed. Please check printer status and retry.".to_string(),
        ));
    }

    Ok(())
}

#[tauri::command]
pub async fn printer_list_printers(
    state: State<'_, AppState>,
    actor_user_id: i64,
) -> Result<Vec<String>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "barcodes")?;
    let mut out = vec!["System Default".to_string()];

    for printer in detect_system_printers() {
        if !out.iter().any(|existing| existing == &printer) {
            out.push(printer);
        }
    }

    for key in ["thermal_printer", "normal_printer", "barcode_printer"] {
        if let Some(value) = normalize_setting_value(db.get_setting(key)?) {
            if !out.iter().any(|existing| existing == &value) {
                out.push(value);
            }
        }
    }

    if !out.iter().any(|value| value == "Thermal Default") {
        out.push("Thermal Default".to_string());
    }
    if !out.iter().any(|value| value == "Normal Default") {
        out.push("Normal Default".to_string());
    }

    Ok(out)
}
#[tauri::command]
pub async fn printer_print_bill(
    state: State<'_, AppState>,
    bill_id: i64,
    printer_type: String,
    printer_name: Option<String>,
    actor_user_id: i64,
) -> Result<(), AppError> {
    if printer_type != "thermal" && printer_type != "normal" {
        return Err(AppError::Validation(
            "printer_type must be thermal or normal".to_string(),
        ));
    }

    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "billing")?;
    let bill = db.get_bill_json(bill_id)?;
    let chosen_printer_name = printer_name
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
        .or_else(|| resolve_default_printer_name(&db, &printer_type));

    let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let (path, output_kind, file_name) = if printer_type == "thermal" {
        let file_name = format!("bill_{}_{}_{}.bin", bill_id, printer_type, stamp);
        let path = job_dir()?.join(file_name);
        let width = thermal_line_width_chars(&db);
        let bytes = render_thermal_bill_escpos(&bill, bill_id, width);
        fs::write(&path, bytes)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let fname = path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("bill.bin")
            .to_string();
        (path, "thermal_escpos", fname)
    } else {
        let file_name = format!("bill_{}_{}_{}.html", bill_id, printer_type, stamp);
        let path = job_dir()?.join(file_name);
        let html = render_a4_bill_html(&bill, bill_id);
        fs::write(&path, html).map_err(|e| AppError::Internal(e.to_string()))?;
        let fname = path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("bill.html")
            .to_string();
        (path, "a4_html", fname)
    };

    let size_bytes = fs::metadata(&path)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .len() as i64;

    db.create_print_job(
        "bill",
        Some(&printer_type),
        chosen_printer_name.as_deref(),
        &file_name,
        &path.to_string_lossy(),
        size_bytes,
    )?;

    apply_dispatch_status(
        &db,
        &file_name,
        dispatch_print_job(&path, &printer_type, chosen_printer_name.as_deref()),
        false,
    )?;

    db.write_audit_log(
        "PRINT_BILL_REQUESTED",
        "printer",
        &bill_id.to_string(),
        None,
        Some(
            &serde_json::json!({
                "printer_type": printer_type,
                "printer_name": chosen_printer_name,
                "output_kind": output_kind,
                "job_file": path.to_string_lossy(),
            })
            .to_string(),
        ),
        "System",
    )?;

    Ok(())
}
#[tauri::command]
pub async fn printer_print_labels(
    state: State<'_, AppState>,
    label_data: serde_json::Value,
    printer_name: String,
    actor_user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "barcodes")?;
    let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let file_name = format!("labels_{}_{}.json", printer_name.replace(' ', "_"), stamp);
    let path = job_dir()?.join(file_name);

    fs::write(&path, json_pretty(&label_data)?).map_err(|e| AppError::Internal(e.to_string()))?;

    let created_file_name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("labels.json")
        .to_string();
    let size_bytes = fs::metadata(&path)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .len() as i64;

    db.create_print_job(
        "labels",
        Some("barcode"),
        Some(printer_name.trim()),
        &created_file_name,
        &path.to_string_lossy(),
        size_bytes,
    )?;

    db.write_audit_log(
        "PRINT_LABELS_REQUESTED",
        "printer",
        "labels",
        None,
        Some(
            &serde_json::json!({
                "printer_name": printer_name,
                "job_file": path.to_string_lossy(),
            })
            .to_string(),
        ),
        "System",
    )?;

    Ok(())
}
#[tauri::command]
pub async fn printer_test_print(
    state: State<'_, AppState>,
    printer_name: String,
    printer_type: String,
    actor_user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "barcodes")?;
    let stamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let extension = if printer_type == "thermal" { "bin" } else { "txt" };
    let file_name = format!(
        "test_print_{}_{}.{}",
        printer_name.replace(' ', "_"),
        stamp,
        extension
    );
    let path = job_dir()?.join(file_name);

    let content = format!(
        "PharmaCare Pro Printer Test\nPrinter: {}\nType: {}\nGenerated At: {}\n",
        printer_name,
        printer_type,
        chrono::Utc::now().to_rfc3339()
    );
    if printer_type == "thermal" {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&[0x1B, 0x40]);
        bytes.extend_from_slice(&[0x1B, 0x61, 0x01]);
        bytes.extend_from_slice(b"PHARMACARE PRO\n");
        bytes.extend_from_slice(&[0x1B, 0x61, 0x00]);
        bytes.extend_from_slice(content.as_bytes());
        bytes.extend_from_slice(&[0x1B, 0x64, 0x03]);
        bytes.extend_from_slice(&[0x1D, 0x56, 0x42, 0x00]);
        fs::write(&path, bytes).map_err(|e| AppError::Internal(e.to_string()))?;
    } else {
        fs::write(&path, content).map_err(|e| AppError::Internal(e.to_string()))?;
    }

    let created_file_name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or("test_print.txt")
        .to_string();
    let size_bytes = fs::metadata(&path)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .len() as i64;

    db.create_print_job(
        "test",
        Some(&printer_type),
        Some(printer_name.trim()),
        &created_file_name,
        &path.to_string_lossy(),
        size_bytes,
    )?;

    apply_dispatch_status(
        &db,
        &created_file_name,
        dispatch_print_job(&path, &printer_type, Some(printer_name.trim())),
        false,
    )?;

    db.write_audit_log(
        "PRINT_TEST_REQUESTED",
        "printer",
        "test",
        None,
        Some(
            &serde_json::json!({
                "printer_name": printer_name,
                "printer_type": printer_type,
                "job_file": path.to_string_lossy(),
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
        std::env::temp_dir().join(format!("pharmacare_printer_test_{}_{}.db", name, suffix))
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
    fn apply_dispatch_status_updates_sent_failed_and_retry_count() {
        let db_path = test_db_path("dispatch_status");
        let db = Database::init_for_test(db_path.clone()).expect("test db init");

        let sent_file = "dispatch_sent_test.bin";
        db.create_print_job(
            "test",
            Some("thermal"),
            Some("System Default"),
            sent_file,
            "/tmp/dispatch_sent_test.bin",
            128,
        )
        .expect("create sent test job");

        apply_dispatch_status(&db, sent_file, Ok(()), false).expect("sent update");
        let sent = print_job_by_name(&db, sent_file);
        assert_eq!(sent.get("status").and_then(|v| v.as_str()), Some("sent"));
        assert_eq!(sent.get("retry_count").and_then(|v| v.as_i64()), Some(0));

        let failed_file = "dispatch_failed_test.bin";
        db.create_print_job(
            "test",
            Some("thermal"),
            Some("System Default"),
            failed_file,
            "/tmp/dispatch_failed_test.bin",
            128,
        )
        .expect("create failed test job");

        let failed = apply_dispatch_status(
            &db,
            failed_file,
            Err(AppError::Internal("forced failure".to_string())),
            true,
        );
        assert!(matches!(failed, Err(AppError::Internal(_))));

        let failed_row = print_job_by_name(&db, failed_file);
        assert_eq!(failed_row.get("status").and_then(|v| v.as_str()), Some("failed"));
        assert_eq!(failed_row.get("retry_count").and_then(|v| v.as_i64()), Some(1));
        let last_error = failed_row
            .get("last_error")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        assert!(last_error.contains("forced failure"));

        let _ = std::fs::remove_file(db_path);
    }
}
