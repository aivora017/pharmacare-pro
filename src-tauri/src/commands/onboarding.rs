use tauri::State;
use crate::{AppState, db::Database};
use crate::error::AppError;
use serde_json::Value;

#[tauri::command]
pub async fn onboarding_status(state: State<'_, AppState>) -> Result<Value, AppError> {
    let db = state.db.lock()?;
    db.get_onboarding_status()
}

#[tauri::command]
pub async fn onboarding_save(
    state: State<'_, AppState>,
    pharmacy_name: String,
    pharmacy_address: String,
    pharmacy_phone: String,
    pin_code: String,
    drug_licence_no: String,
    gstin: String,
    legal_name: String,
    trade_name: String,
    state_code: String,
    state_name: String,
    reg_type: String,
    gst_enabled: bool,
) -> Result<(), AppError> {
    let db = state.db.lock()?;
    db.save_onboarding(
        pharmacy_name, pharmacy_address, pharmacy_phone, pin_code, drug_licence_no,
        gstin, legal_name, trade_name, state_code, state_name, reg_type, gst_enabled,
    )
}

#[tauri::command]
pub async fn business_profile_get(state: State<'_, AppState>) -> Result<Value, AppError> {
    let db = state.db.lock()?;
    db.get_business_profile()
}

#[tauri::command]
pub async fn business_profile_save(
    state: State<'_, AppState>,
    pharmacy_name: String,
    pharmacy_address: String,
    pharmacy_phone: String,
    pin_code: String,
    drug_licence_no: String,
    gstin: String,
    legal_name: String,
    trade_name: String,
    state_code: String,
    state_name: String,
    reg_type: String,
    gst_enabled: bool,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock()?;
    db.save_business_profile(
        pharmacy_name, pharmacy_address, pharmacy_phone, pin_code, drug_licence_no,
        gstin, legal_name, trade_name, state_code, state_name, reg_type, gst_enabled, user_id,
    )
}

#[tauri::command]
pub async fn gstin_verify(gstin: String) -> Result<Value, AppError> {
    Ok(Database::verify_gstin_format(&gstin))
}
