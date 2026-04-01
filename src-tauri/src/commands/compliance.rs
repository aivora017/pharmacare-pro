use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;

// ── NARCOTIC REGISTER ────────────────────────────────────────

#[tauri::command]
pub async fn compliance_list_narcotic(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> Result<Value, AppError> {
    state.db.lock()?.list_narcotic_register(&from, &to)
}

#[tauri::command]
pub async fn compliance_create_narcotic(
    state: State<'_, AppState>,
    entry: Value,
    user_id: i64,
) -> Result<i64, AppError> {
    state.db.lock()?.create_narcotic_entry(&entry, user_id)
}

#[tauri::command]
pub async fn compliance_update_narcotic(
    state: State<'_, AppState>,
    id: i64,
    entry: Value,
) -> Result<(), AppError> {
    state.db.lock()?.update_narcotic_entry(id, &entry)
}

#[tauri::command]
pub async fn compliance_delete_narcotic(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), AppError> {
    state.db.lock()?.delete_narcotic_entry(id)
}

// ── PRESCRIPTION REGISTER ────────────────────────────────────

#[tauri::command]
pub async fn compliance_list_prescription(
    state: State<'_, AppState>,
    from: String,
    to: String,
) -> Result<Value, AppError> {
    state.db.lock()?.list_prescription_register(&from, &to)
}

#[tauri::command]
pub async fn compliance_create_prescription(
    state: State<'_, AppState>,
    entry: Value,
    user_id: i64,
) -> Result<i64, AppError> {
    state.db.lock()?.create_prescription_entry(&entry, user_id)
}

#[tauri::command]
pub async fn compliance_update_prescription(
    state: State<'_, AppState>,
    id: i64,
    entry: Value,
) -> Result<(), AppError> {
    state.db.lock()?.update_prescription_entry(id, &entry)
}

#[tauri::command]
pub async fn compliance_delete_prescription(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), AppError> {
    state.db.lock()?.delete_prescription_entry(id)
}

// ── LICENCE ALERTS ───────────────────────────────────────────

#[tauri::command]
pub async fn compliance_get_licence_alerts(state: State<'_, AppState>) -> Result<Value, AppError> {
    state.db.lock()?.get_licence_alerts()
}

#[tauri::command]
pub async fn compliance_get_licence_settings(state: State<'_, AppState>) -> Result<Value, AppError> {
    let db = state.db.lock()?;
    let keys = vec![
        "drug_licence_no",
        "drug_licence_expiry",
        "fssai_licence_no",
        "fssai_licence_expiry",
        "schedule_x_licence_no",
        "schedule_x_licence_expiry",
        "pharmacy_state_code",
        "pharmacy_city",
        "pharmacy_pincode",
        "irp_username",
        "irp_sandbox_mode",
        "ewb_username",
        "ewb_sandbox_mode",
    ];
    let mut out = serde_json::Map::new();
    for k in keys {
        let v = db.get_setting(k)?.unwrap_or_else(|| "\"\"".to_string());
        let parsed: Value = serde_json::from_str(&v)
            .unwrap_or(Value::String(v.trim_matches('"').to_string()));
        out.insert(k.to_string(), parsed);
    }
    Ok(Value::Object(out))
}

#[tauri::command]
pub async fn compliance_save_licence_settings(
    state: State<'_, AppState>,
    settings: Value,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock()?;
    if let Some(obj) = settings.as_object() {
        for (k, v) in obj {
            let val_str = match v {
                Value::String(s) => format!("\"{}\"", s),
                other => other.to_string(),
            };
            db.set_setting(k, &val_str, Some(user_id))?;
        }
    }
    Ok(())
}

// ── DRUG INTERACTIONS ────────────────────────────────────────

#[tauri::command]
pub async fn compliance_get_interaction_stats(state: State<'_, AppState>) -> Result<Value, AppError> {
    state.db.lock()?.get_drug_interaction_stats()
}

#[tauri::command]
pub async fn compliance_list_interactions(
    state: State<'_, AppState>,
    search: String,
    severity: Option<String>,
) -> Result<Value, AppError> {
    state.db.lock()?.list_drug_interactions(&search, severity.as_deref())
}

#[tauri::command]
pub async fn compliance_create_interaction(
    state: State<'_, AppState>,
    entry: Value,
) -> Result<i64, AppError> {
    state.db.lock()?.create_drug_interaction(&entry)
}

#[tauri::command]
pub async fn compliance_delete_interaction(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), AppError> {
    state.db.lock()?.delete_drug_interaction(id)
}
