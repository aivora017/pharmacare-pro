use tauri::State;
use crate::{AppState, error::AppError};
use serde_json::Value;

#[tauri::command]
pub async fn sms_send(
    state: State<'_, AppState>,
    phone: String,
    message: String,
) -> Result<Value, AppError> {
    let (api_key, enabled) = {
        let db = state.db.lock()?;
        let s = db.get_sms_settings()?;
        (
            s["sms_api_key"].as_str().unwrap_or("").to_string(),
            s["sms_enabled"].as_bool().unwrap_or(false),
        )
    };

    if !enabled { return Err(AppError::Internal("SMS not enabled. Add API key in Settings → SMS.".into())); }
    if api_key.is_empty() { return Err(AppError::Internal("SMS API key not configured.".into())); }

    let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
    let mobile = if digits.len() > 10 { digits[digits.len()-10..].to_string() } else { digits };
    if mobile.len() != 10 { return Err(AppError::Internal("Invalid phone number — must be 10 digits.".into())); }

    let client = reqwest::Client::new();
    let res = client
        .post("https://www.fast2sms.com/dev/bulkV2")
        .header("authorization", &api_key)
        .json(&serde_json::json!({
            "route": "q",
            "message": message,
            "language": "english",
            "flash": 0,
            "numbers": mobile,
        }))
        .send()
        .await
        .map_err(|e| AppError::Network(e.to_string()))?;

    let body: Value = res.json().await.map_err(|e| AppError::Internal(e.to_string()))?;

    if body["return"].as_bool().unwrap_or(false) {
        Ok(serde_json::json!({ "success": true, "message": "SMS sent." }))
    } else {
        let msg = body["message"].as_array()
            .and_then(|a| a.first()).and_then(|v| v.as_str())
            .unwrap_or("SMS failed. Check API key and balance.");
        Err(AppError::Internal(msg.to_string()))
    }
}

#[tauri::command]
pub async fn sms_settings_save(
    state: State<'_, AppState>,
    api_key: String,
    sender_id: String,
    enabled: bool,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock()?;
    db.save_sms_settings(api_key, sender_id, enabled, user_id)
}
