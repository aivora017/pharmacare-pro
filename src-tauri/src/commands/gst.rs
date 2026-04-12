use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use aes::Aes128;
use aes::cipher::{BlockDecrypt, BlockEncrypt, KeyInit};

// ── AES-128-ECB helpers ──────────────────────────────────────

/// Decrypt base64-encoded ciphertext using a base64-encoded 16-byte key.
fn aes128_ecb_decrypt(key_b64: &str, cipher_b64: &str) -> Result<Vec<u8>, String> {
    let key = B64.decode(key_b64).map_err(|e| format!("Key decode: {e}"))?;
    aes128_ecb_decrypt_raw(&key, cipher_b64)
}

/// Decrypt base64-encoded ciphertext using a raw key slice (16 bytes).
fn aes128_ecb_decrypt_raw(key: &[u8], cipher_b64: &str) -> Result<Vec<u8>, String> {
    if key.len() != 16 { return Err("AES key must be 16 bytes".into()); }
    let mut buf = B64.decode(cipher_b64).map_err(|e| format!("Cipher decode: {e}"))?;
    if buf.is_empty() || buf.len() % 16 != 0 {
        return Err(format!("Ciphertext length {} is not a multiple of 16", buf.len()));
    }
    let cipher = Aes128::new_from_slice(key).map_err(|e| format!("Cipher init: {e}"))?;
    for chunk in buf.chunks_mut(16) {
        let block = aes::cipher::generic_array::GenericArray::from_mut_slice(chunk);
        cipher.decrypt_block(block);
    }
    // Remove PKCS7 padding
    if let Some(&pad) = buf.last() {
        let pad = pad as usize;
        if pad > 0 && pad <= 16 && pad <= buf.len() {
            buf.truncate(buf.len() - pad);
        }
    }
    Ok(buf)
}

/// Encrypt plaintext using a raw 16-byte key. Returns base64-encoded ciphertext.
fn aes128_ecb_encrypt(key: &[u8], plaintext: &[u8]) -> Result<String, String> {
    if key.len() != 16 { return Err("AES key must be 16 bytes".into()); }
    let cipher = Aes128::new_from_slice(key).map_err(|e| format!("Cipher init: {e}"))?;
    // PKCS7 pad to 16-byte boundary
    let pad_len = 16 - (plaintext.len() % 16);
    let mut buf = plaintext.to_vec();
    buf.extend(std::iter::repeat(pad_len as u8).take(pad_len));
    for chunk in buf.chunks_mut(16) {
        let block = aes::cipher::generic_array::GenericArray::from_mut_slice(chunk);
        cipher.encrypt_block(block);
    }
    Ok(B64.encode(&buf))
}

// ── IRP Auth ────────────────────────────────────────────────

struct IrpSession { auth_token: String, session_key: Vec<u8> }

async fn irp_authenticate(
    client: &reqwest::Client,
    base_url: &str,
    username: &str,
    password: &str,
    app_key_b64: &str,
) -> Result<IrpSession, AppError> {
    let body = serde_json::json!({
        "UserName": username,
        "Password": password,
        "AppKey":   app_key_b64,
        "ForceRefreshAccessToken": false
    });

    let resp = client
        .post(format!("{base_url}/eivital/v1.04/Auth"))
        .header("user_name", username)
        .header("password",  password)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("IRP auth request: {e}")))?;

    let json: Value = resp.json().await
        .map_err(|e| AppError::Network(format!("IRP auth response parse: {e}")))?;

    if json["Status"].as_i64().unwrap_or(0) != 1 {
        let err = json["ErrorDetails"].to_string();
        return Err(AppError::External(format!("IRP authentication failed: {err}")));
    }

    let auth_token = json["Info"]["AuthToken"]
        .as_str()
        .ok_or_else(|| AppError::External("IRP: missing AuthToken in response".into()))?
        .to_string();

    let sek_b64 = json["Info"]["Sek"]
        .as_str()
        .ok_or_else(|| AppError::External("IRP: missing Sek in response".into()))?;

    let session_key = aes128_ecb_decrypt(app_key_b64, sek_b64)
        .map_err(|e| AppError::External(format!("IRP Sek decryption: {e}")))?;

    Ok(IrpSession { auth_token, session_key })
}

// ── EWB Auth ────────────────────────────────────────────────

struct EwbSession { auth_token: String, session_key: Vec<u8> }

async fn ewb_authenticate(
    client: &reqwest::Client,
    base_url: &str,
    username: &str,
    password: &str,
    app_key_b64: &str,
) -> Result<EwbSession, AppError> {
    let body = serde_json::json!({
        "action":   "ACCESSTOKEN",
        "username": username,
        "password": password,
        "appkey":   app_key_b64
    });

    let resp = client
        .post(format!("{base_url}/ewayapi/v3.0/authenticatebyr"))
        .header("username", username)
        .header("password", password)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Network(format!("EWB auth request: {e}")))?;

    let json: Value = resp.json().await
        .map_err(|e| AppError::Network(format!("EWB auth response parse: {e}")))?;

    if json["status"].as_str().unwrap_or("0") != "1" {
        let err = json["error"].as_str().unwrap_or(&json["message"].to_string()).to_string();
        return Err(AppError::External(format!("EWB authentication failed: {err}")));
    }

    let auth_token = json["authtoken"]
        .as_str()
        .ok_or_else(|| AppError::External("EWB: missing authtoken in response".into()))?
        .to_string();

    let sek_b64 = json["sek"]
        .as_str()
        .ok_or_else(|| AppError::External("EWB: missing sek in response".into()))?;

    let session_key = aes128_ecb_decrypt(app_key_b64, sek_b64)
        .map_err(|e| AppError::External(format!("EWB sek decryption: {e}")))?;

    Ok(EwbSession { auth_token, session_key })
}

// ── Date formatter DD/MM/YYYY ────────────────────────────────

fn fmt_date_dmy(iso: &str) -> String {
    let s = if iso.len() >= 10 { &iso[..10] } else { iso };
    let parts: Vec<&str> = s.split('-').collect();
    if parts.len() == 3 {
        format!("{}/{}/{}", parts[2], parts[1], parts[0])
    } else {
        iso.to_string()
    }
}

// ── GST commands (unchanged) ─────────────────────────────────

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

// ── E-Invoice (IRP) ──────────────────────────────────────────

#[tauri::command]
pub async fn gst_generate_einvoice(
    state: State<'_, AppState>,
    bill_id: i64,
) -> Result<Value, AppError> {
    // ── Gather everything under the Mutex lock, then drop it ──
    let (bill, compliance, irp_username, irp_password, irp_app_key, sandbox_mode,
         gstin, pharmacy_name, pharmacy_address, pharmacy_phone, state_code, pin_code) = {
        let db = state.db.lock()?;
        let irp_username  = db.get_setting("irp_username")?.unwrap_or_default();
        let irp_password  = db.get_setting("irp_password")?.unwrap_or_default();
        let irp_app_key   = db.get_setting("irp_app_key")?.unwrap_or_default();
        let sandbox_mode  = db.get_setting("irp_sandbox_mode")?.unwrap_or_else(|| "true".into()) == "true";
        let gstin         = db.get_setting("gstin")?.unwrap_or_default();
        let pharmacy_name = db.get_setting("pharmacy_name")?.unwrap_or_default();
        let pharmacy_address = db.get_setting("pharmacy_address")?.unwrap_or_default();
        let pharmacy_phone   = db.get_setting("pharmacy_phone")?.unwrap_or_default();
        let state_code    = db.get_setting("state_code")?.unwrap_or_else(|| "27".into());
        let pin_code      = db.get_setting("pin_code")?.unwrap_or_else(|| "400001".into());
        let bill          = db.get_bill(bill_id)?;
        let compliance    = db.get_bill_for_compliance(bill_id)?;
        (bill, compliance, irp_username, irp_password, irp_app_key, sandbox_mode,
         gstin, pharmacy_name, pharmacy_address, pharmacy_phone, state_code, pin_code)
    };

    // ── Credential check ──
    if irp_username.is_empty() || irp_password.is_empty() || irp_app_key.is_empty() {
        return Ok(serde_json::json!({
            "status": "not_configured",
            "message": "IRP credentials not set. Go to Settings → GST Compliance and fill in IRP Username, Password and App Key."
        }));
    }
    if gstin.is_empty() {
        return Ok(serde_json::json!({
            "status": "not_configured",
            "message": "GSTIN not configured. Go to Settings → Business Profile."
        }));
    }

    // ── Build IRN item list ──
    let items = bill["items"].as_array().cloned().unwrap_or_default();
    let item_list: Vec<Value> = items.iter().enumerate().map(|(i, item)| {
        let qty        = item["quantity"].as_f64().unwrap_or(1.0);
        let unit_price = item["unit_price"].as_f64().unwrap_or(0.0);
        let disc_amt   = item["discount_amount"].as_f64().unwrap_or(0.0);
        let ass_amt    = (qty * unit_price - disc_amt).max(0.0);
        let gst_rate   = item["gst_rate"].as_f64().unwrap_or(0.0);
        let cgst       = item["cgst_amount"].as_f64().unwrap_or(0.0);
        let sgst       = item["sgst_amount"].as_f64().unwrap_or(0.0);
        let igst       = item["igst_amount"].as_f64().unwrap_or(0.0);
        let tot_val    = item["total_amount"].as_f64().unwrap_or(0.0);
        serde_json::json!({
            "SlNo":      (i + 1).to_string(),
            "PrdDesc":   item["medicine_name"].as_str().unwrap_or("Medicine"),
            "IsServc":   "N",
            "Qty":       qty,
            "Unit":      "NOS",
            "UnitPrice": unit_price,
            "TotAmt":    qty * unit_price,
            "Discount":  disc_amt,
            "AssAmt":    ass_amt,
            "GstRt":     gst_rate,
            "IgstAmt":   igst,
            "CgstAmt":   cgst,
            "SgstAmt":   sgst,
            "TotItemVal":tot_val
        })
    }).collect();

    let bill_date    = bill["bill_date"].as_str().unwrap_or("");
    let cust_gstin   = compliance["customer_gstin"].as_str().unwrap_or("");
    let cust_gstin   = if cust_gstin.is_empty() { "URP" } else { cust_gstin };
    let sup_type     = if cust_gstin == "URP" { "B2C" } else { "B2B" };
    let pin_num: u64 = pin_code.parse().unwrap_or(400001);

    let irn_payload = serde_json::json!({
        "Version": "1.1",
        "TranDtls": {
            "TaxSch":     "GST",
            "SupTyp":     sup_type,
            "RegRev":     "N",
            "IgstOnIntra":"N"
        },
        "DocDtls": {
            "Typ": "INV",
            "No":  bill["bill_number"].as_str().unwrap_or(""),
            "Dt":  fmt_date_dmy(bill_date)
        },
        "SellerDtls": {
            "Gstin": gstin,
            "LglNm": pharmacy_name,
            "Addr1": pharmacy_address,
            "Loc":   pharmacy_address,
            "Pin":   pin_num,
            "Stcd":  state_code,
            "Ph":    pharmacy_phone,
            "Em":    ""
        },
        "BuyerDtls": {
            "Gstin": cust_gstin,
            "LglNm": compliance["customer_name"].as_str().unwrap_or("Walk-in"),
            "Pos":   state_code,
            "Addr1": compliance["customer_address"].as_str().unwrap_or(""),
            "Loc":   "NA",
            "Pin":   999999_u64,
            "Stcd":  state_code,
            "Ph":    compliance["customer_phone"].as_str().unwrap_or("")
        },
        "ItemList": item_list,
        "ValDtls": {
            "AssVal":    bill["taxable_amount"].as_f64().unwrap_or(0.0),
            "CgstVal":   bill["cgst_amount"].as_f64().unwrap_or(0.0),
            "SgstVal":   bill["sgst_amount"].as_f64().unwrap_or(0.0),
            "IgstVal":   bill["igst_amount"].as_f64().unwrap_or(0.0),
            "TotInvVal": bill["net_amount"].as_f64().unwrap_or(0.0)
        }
    });

    // ── HTTP client ──
    let base_url = if sandbox_mode {
        "https://api.sandbox.einvoice1.gst.gov.in"
    } else {
        "https://api.einvoice1.gst.gov.in"
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Network(e.to_string()))?;

    // ── Authenticate ──
    let session = irp_authenticate(&client, base_url, &irp_username, &irp_password, &irp_app_key).await?;

    // ── Encrypt payload ──
    let payload_str = serde_json::to_string(&irn_payload)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let encrypted_data = aes128_ecb_encrypt(&session.session_key, payload_str.as_bytes())
        .map_err(|e| AppError::External(format!("Payload encryption: {e}")))?;

    // ── Call IRN endpoint ──
    let irn_resp = client
        .post(format!("{base_url}/eicore/v1.03/Invoice"))
        .header("user_name",  &irp_username)
        .header("AuthToken",  &session.auth_token)
        .header("Gstin",      &gstin)
        .json(&serde_json::json!({ "Data": encrypted_data }))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("IRN generate request: {e}")))?;

    let irn_json: Value = irn_resp.json().await
        .map_err(|e| AppError::Network(format!("IRN generate response parse: {e}")))?;

    if irn_json["Status"].as_i64().unwrap_or(0) != 1 {
        let err = irn_json["ErrorDetails"].to_string();
        return Err(AppError::External(format!("IRN generation failed: {err}")));
    }

    // ── Decrypt response ──
    let enc_info = irn_json["Info"]
        .as_str()
        .ok_or_else(|| AppError::External("IRN: missing Info in response".into()))?;
    let decrypted = aes128_ecb_decrypt_raw(&session.session_key, enc_info)
        .map_err(|e| AppError::External(format!("IRN response decryption: {e}")))?;
    let result: Value = serde_json::from_slice(&decrypted)
        .map_err(|e| AppError::Internal(format!("IRN result parse: {e}")))?;

    let irn            = result["Irn"].as_str().unwrap_or("").to_string();
    let ack_no         = result["AckNo"].as_str().unwrap_or("").to_string();
    let ack_date       = result["AckDt"].as_str().unwrap_or("").to_string();
    let qr_code        = result["SignedQRCode"].as_str().unwrap_or("").to_string();
    let signed_invoice = result["SignedInvoice"].as_str().unwrap_or("").to_string();

    // ── Persist ──
    state.db.lock()?.save_irn(bill_id, &irn, &qr_code, &ack_no, &ack_date, &signed_invoice)?;

    Ok(serde_json::json!({
        "status":         "success",
        "bill_number":    bill["bill_number"],
        "irn":            irn,
        "ack_no":         ack_no,
        "ack_date":       ack_date,
        "qr_code":        qr_code,
        "signed_invoice": signed_invoice,
        "sandbox":        sandbox_mode
    }))
}

// ── E-Way Bill (NIC) ─────────────────────────────────────────

#[tauri::command]
pub async fn gst_generate_ewaybill(
    state: State<'_, AppState>,
    bill_id: i64,
) -> Result<Value, AppError> {
    // ── Gather under lock ──
    let (bill, compliance, ewb_username, ewb_password, irp_app_key, sandbox_mode,
         gstin, pharmacy_name, pharmacy_address, state_code, pin_code) = {
        let db = state.db.lock()?;
        let ewb_username = db.get_setting("ewb_username")?.unwrap_or_default();
        let ewb_password = db.get_setting("ewb_password")?.unwrap_or_default();
        // Reuse irp_app_key as EWB app key (same user-generated 16-byte AES key)
        let irp_app_key  = db.get_setting("irp_app_key")?.unwrap_or_default();
        let sandbox_mode = db.get_setting("ewb_sandbox_mode")?.unwrap_or_else(|| "true".into()) == "true";
        let gstin        = db.get_setting("gstin")?.unwrap_or_default();
        let pharmacy_name    = db.get_setting("pharmacy_name")?.unwrap_or_default();
        let pharmacy_address = db.get_setting("pharmacy_address")?.unwrap_or_default();
        let state_code   = db.get_setting("state_code")?.unwrap_or_else(|| "27".into());
        let pin_code     = db.get_setting("pin_code")?.unwrap_or_else(|| "400001".into());
        let bill         = db.get_bill(bill_id)?;
        let compliance   = db.get_bill_for_compliance(bill_id)?;
        (bill, compliance, ewb_username, ewb_password, irp_app_key, sandbox_mode,
         gstin, pharmacy_name, pharmacy_address, state_code, pin_code)
    };

    // ── Credential check ──
    if ewb_username.is_empty() || ewb_password.is_empty() {
        return Ok(serde_json::json!({
            "status": "not_configured",
            "message": "E-Way Bill credentials not set. Go to Settings → GST Compliance."
        }));
    }

    // ── EWB threshold: mandatory only for bills ≥ ₹50,000 ──
    let net_amount = bill["net_amount"].as_f64().unwrap_or(0.0);
    if net_amount < 50_000.0 {
        return Ok(serde_json::json!({
            "status": "below_threshold",
            "message": format!("E-Way Bill not required for bills under ₹50,000 (this bill: ₹{:.2})", net_amount),
            "bill_number": bill["bill_number"]
        }));
    }

    // ── Build EWB item list ──
    let items = bill["items"].as_array().cloned().unwrap_or_default();
    let ewb_item_list: Vec<Value> = items.iter().map(|item| {
        let qty      = item["quantity"].as_f64().unwrap_or(1.0);
        let taxable  = item["unit_price"].as_f64().unwrap_or(0.0) * qty
                       - item["discount_amount"].as_f64().unwrap_or(0.0);
        let gst_rate = item["gst_rate"].as_f64().unwrap_or(0.0);
        let cgst     = item["cgst_amount"].as_f64().unwrap_or(0.0);
        let sgst     = item["sgst_amount"].as_f64().unwrap_or(0.0);
        let igst     = item["igst_amount"].as_f64().unwrap_or(0.0);
        serde_json::json!({
            "productName": item["medicine_name"].as_str().unwrap_or("Medicine"),
            "hsnCode":     "3004",   // HSN for medicaments
            "productDesc": item["medicine_name"].as_str().unwrap_or("Medicine"),
            "quantity":    qty,
            "qtyUnit":     "NOS",
            "taxableAmount": taxable,
            "sgstRate":    gst_rate / 2.0,
            "cgstRate":    gst_rate / 2.0,
            "igstRate":    0.0,
            "cessRate":    0.0,
            "cessNonAdvolAmt": 0.0,
            "sgstValue":   sgst,
            "cgstValue":   cgst,
            "igstValue":   igst
        })
    }).collect();

    let pin_num: u32    = pin_code.parse().unwrap_or(400001);
    let state_num: u32  = state_code.parse().unwrap_or(27);
    let cust_gstin      = compliance["customer_gstin"].as_str().unwrap_or("");
    let cust_gstin      = if cust_gstin.is_empty() { "URP" } else { cust_gstin };

    let ewb_payload = serde_json::json!({
        "supplyType":      "O",   // Outward
        "subSupplyType":   "1",   // Supply
        "docType":         "INV",
        "docNo":           bill["bill_number"].as_str().unwrap_or(""),
        "docDate":         fmt_date_dmy(bill["bill_date"].as_str().unwrap_or("")),
        "fromGstin":       gstin,
        "fromTrdName":     pharmacy_name,
        "fromAddr1":       pharmacy_address,
        "fromPlace":       pharmacy_address,
        "fromPincode":     pin_num,
        "fromStateCode":   state_num,
        "toGstin":         cust_gstin,
        "toTrdName":       compliance["customer_name"].as_str().unwrap_or("Walk-in"),
        "toAddr1":         compliance["customer_address"].as_str().unwrap_or(""),
        "toPlace":         "",
        "toPincode":       999999_u32,
        "toStateCode":     state_num,
        "totInvVal":       net_amount,
        "transMode":       "1",   // Road
        "transDistance":   "0",
        "itemList":        ewb_item_list
    });

    // ── HTTP client ──
    let base_url = if sandbox_mode {
        "https://api.sandbox.ewaybillgst.gov.in"
    } else {
        "https://api.ewaybillgst.gov.in"
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Network(e.to_string()))?;

    // ── Authenticate ──
    let session = ewb_authenticate(&client, base_url, &ewb_username, &ewb_password, &irp_app_key).await?;

    // ── Encrypt payload ──
    let payload_str = serde_json::to_string(&ewb_payload)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let encrypted_data = aes128_ecb_encrypt(&session.session_key, payload_str.as_bytes())
        .map_err(|e| AppError::External(format!("EWB payload encryption: {e}")))?;

    // ── Call EWB generation endpoint ──
    let ewb_resp = client
        .post(format!("{base_url}/ewayapi/v3.0/GenerateEWB"))
        .header("username",  &ewb_username)
        .header("authtoken", &session.auth_token)
        .header("Gstin",     &gstin)
        .json(&serde_json::json!({ "action": "GENEWAYBILL", "Data": encrypted_data }))
        .send()
        .await
        .map_err(|e| AppError::Network(format!("EWB generate request: {e}")))?;

    let ewb_json: Value = ewb_resp.json().await
        .map_err(|e| AppError::Network(format!("EWB generate response parse: {e}")))?;

    if ewb_json["status"].as_str().unwrap_or("0") != "1" {
        let err = ewb_json["error"].as_str()
            .unwrap_or(ewb_json["message"].as_str().unwrap_or("Unknown error"));
        return Err(AppError::External(format!("EWB generation failed: {err}")));
    }

    // ── Decrypt response ──
    let enc_info = ewb_json["data"]
        .as_str()
        .ok_or_else(|| AppError::External("EWB: missing data in response".into()))?;
    let decrypted = aes128_ecb_decrypt_raw(&session.session_key, enc_info)
        .map_err(|e| AppError::External(format!("EWB response decryption: {e}")))?;
    let result: Value = serde_json::from_slice(&decrypted)
        .map_err(|e| AppError::Internal(format!("EWB result parse: {e}")))?;

    let ewb_no        = result["ewayBillNo"].as_str()
        .or_else(|| result["EwbNo"].as_str()).unwrap_or("").to_string();
    let ewb_date      = result["ewayBillDate"].as_str()
        .or_else(|| result["EwbDt"].as_str()).unwrap_or("").to_string();
    let ewb_valid     = result["validUpto"].as_str()
        .or_else(|| result["ValidUpto"].as_str()).unwrap_or("").to_string();

    // ── Persist ──
    state.db.lock()?.save_ewb(bill_id, &ewb_no, &ewb_date, &ewb_valid)?;

    Ok(serde_json::json!({
        "status":       "success",
        "bill_number":  bill["bill_number"],
        "ewb_no":       ewb_no,
        "ewb_date":     ewb_date,
        "valid_until":  ewb_valid,
        "sandbox":      sandbox_mode
    }))
}

// ── Bill compliance status (IRN + EWB lookup) ────────────────

#[tauri::command]
pub async fn gst_bill_compliance(
    state: State<'_, AppState>,
    bill_id: i64,
) -> Result<Value, AppError> {
    state.db.lock()?.get_bill_compliance(bill_id)
}
