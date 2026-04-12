use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;

/// Verify the technician password. Returns true if correct.
#[tauri::command]
pub async fn tech_auth(
    state: State<'_, AppState>,
    password: String,
) -> Result<bool, AppError> {
    let hash = state.db.lock()?
        .get_setting("tech_password_hash")?
        .unwrap_or_default();
    if hash.is_empty() { return Ok(false); }
    bcrypt::verify(&password, &hash)
        .map_err(|e| AppError::Internal(format!("bcrypt verify: {e}")))
}

/// One-shot technician setup. Saves all pharmacy settings + creates/updates owner account.
#[tauri::command]
pub async fn tech_setup_save(
    state: State<'_, AppState>,
    fields: Value,
) -> Result<Value, AppError> {
    let db = state.db.lock()?;

    let s = |key: &str| fields[key].as_str().unwrap_or("").to_string();

    let gstin       = s("gstin");
    let gst_enabled = (gstin.len() == 15).to_string();

    // Auto-generate IRP App Key if not provided (16 UUID bytes, base64-encoded)
    let irp_app_key = {
        let provided = s("irp_app_key");
        if provided.is_empty() {
            use base64::{Engine, engine::general_purpose::STANDARD as B64};
            B64.encode(uuid::Uuid::new_v4().as_bytes())
        } else {
            provided
        }
    };

    // All settings to persist (key, value) — always overwrite
    let to_save: Vec<(&str, String)> = vec![
        ("pharmacy_name",        s("pharmacy_name")),
        ("pharmacy_address",     s("pharmacy_address")),
        ("pharmacy_phone",       s("pharmacy_phone")),
        ("pin_code",             s("pin_code")),
        ("drug_licence_no",      s("drug_licence_no")),
        ("gstin",                gstin.clone()),
        ("gst_enabled",          gst_enabled.clone()),
        ("irp_username",         s("irp_username")),
        ("irp_password",         s("irp_password")),
        ("irp_app_key",          irp_app_key.clone()),
        ("irp_sandbox_mode",     "true".to_string()),   // always start in sandbox
        ("ewb_username",         s("ewb_username")),
        ("ewb_password",         s("ewb_password")),
        ("ewb_sandbox_mode",     "true".to_string()),
        ("onboarding_complete",  "true".to_string()),
    ];

    for (key, val) in &to_save {
        db.set_setting(key, val, None)?;
    }

    // Create/update owner login
    let owner_name  = s("owner_name");
    let owner_email = s("owner_email");
    let owner_pwd   = s("owner_password");
    if !owner_name.is_empty() && !owner_pwd.is_empty() {
        db.tech_upsert_owner(&owner_name, &owner_email, &owner_pwd)?;
    }

    Ok(serde_json::json!({
        "success":     true,
        "irp_app_key": irp_app_key,
        "gst_enabled": gst_enabled == "true"
    }))
}

/// Fetch current setup values so the tech form can be pre-filled on revisit.
#[tauri::command]
pub async fn tech_get_config(
    state: State<'_, AppState>,
) -> Result<Value, AppError> {
    let db = state.db.lock()?;
    let g = |k: &str| db.get_setting(k).ok().flatten().unwrap_or_default();
    Ok(serde_json::json!({
        "pharmacy_name":    g("pharmacy_name"),
        "pharmacy_address": g("pharmacy_address"),
        "pharmacy_phone":   g("pharmacy_phone"),
        "pin_code":         g("pin_code"),
        "drug_licence_no":  g("drug_licence_no"),
        "gstin":            g("gstin"),
        "irp_username":     g("irp_username"),
        "irp_app_key":      g("irp_app_key"),
        "ewb_username":     g("ewb_username"),
        "onboarding_complete": g("onboarding_complete") == "true"
    }))
}

/// Change the technician access password (requires knowing the current one).
#[tauri::command]
pub async fn tech_change_password(
    state: State<'_, AppState>,
    current_password: String,
    new_password: String,
) -> Result<bool, AppError> {
    if new_password.len() < 8 {
        return Err(AppError::Validation("New password must be at least 8 characters.".into()));
    }
    let db = state.db.lock()?;
    let hash = db.get_setting("tech_password_hash")?.unwrap_or_default();
    let ok = bcrypt::verify(&current_password, &hash)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if !ok { return Ok(false); }
    let new_hash = bcrypt::hash(&new_password, 10)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    db.set_setting("tech_password_hash", &new_hash, None)?;
    Ok(true)
}
