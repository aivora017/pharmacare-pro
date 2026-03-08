#![allow(unused_variables, dead_code)]
//! License Key Validation via LemonSqueezy
//! Machine-locked license: key is valid only on the machine it was activated on.

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn license_validate(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: read license_key from settings, call LemonSqueezy validation API,
    // check machine fingerprint matches, return {valid, tier, expires_at, trial_days_left}
    todo!("license_validate")
}
#[tauri::command]
pub async fn license_activate(state: State<'_, AppState>, license_key: String) -> Result<serde_json::Value, AppError> {
    // TODO: call LemonSqueezy activation API with license_key + machine fingerprint
    // On success: save to settings, return tier + expiry
    todo!("license_activate")
}
#[tauri::command]
pub async fn license_get_status(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: return {status: "trial"|"active"|"expired", tier, trial_days_left}
    todo!("license_get_status")
}

