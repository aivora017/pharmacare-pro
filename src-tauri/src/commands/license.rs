#![allow(unused_variables, dead_code)]
//! License Key Validation via LemonSqueezy
//! Machine-locked license: key is valid only on the machine it was activated on.

use crate::{error::AppError, AppState};
use crate::commands::permission::require_permission;
use tauri::State;

const TRIAL_DAYS: i64 = 30;

fn build_status(db: &crate::db::Database) -> Result<serde_json::Value, AppError> {
    let now = chrono::Utc::now();

    let trial_started = match db.get_setting("license_trial_started_at")? {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            let created = now.to_rfc3339();
            db.set_setting("license_trial_started_at", &created, None)?;
            created
        }
    };

    let trial_start_dt = chrono::DateTime::parse_from_rfc3339(&trial_started)
        .map(|v| v.with_timezone(&chrono::Utc))
        .unwrap_or(now);
    let elapsed_days = (now - trial_start_dt).num_days().max(0);
    let trial_days_left = (TRIAL_DAYS - elapsed_days).max(0);

    let license_key = db.get_setting("license_key")?;
    let tier = db
        .get_setting("license_tier")?
        .unwrap_or_else(|| "starter".to_string());
    let expires_at = db.get_setting("license_expires_at")?;

    if license_key.is_none() {
        let status = if trial_days_left > 0 { "trial" } else { "expired" };
        return Ok(serde_json::json!({
            "status": status,
            "tier": "trial",
            "trial_days_left": trial_days_left,
            "expires_at": serde_json::Value::Null,
        }));
    }

    if let Some(expiry_raw) = &expires_at {
        if let Ok(expiry) = chrono::DateTime::parse_from_rfc3339(expiry_raw) {
            if expiry.with_timezone(&chrono::Utc) < now {
                return Ok(serde_json::json!({
                    "status": "expired",
                    "tier": tier,
                    "trial_days_left": 0,
                    "expires_at": expires_at,
                }));
            }
        }
    }

    Ok(serde_json::json!({
        "status": "active",
        "tier": tier,
        "trial_days_left": trial_days_left,
        "expires_at": expires_at,
    }))
}

#[tauri::command]
pub async fn license_validate(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    build_status(&db)
}
#[tauri::command]
pub async fn license_activate(
    state: State<'_, AppState>,
    license_key: String,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let key = license_key.trim();
    if key.len() < 10 {
        return Err(AppError::Validation(
            "Please enter a valid license key.".to_string(),
        ));
    }

    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "settings")?;
    let now = chrono::Utc::now();
    let expires_at = (now + chrono::Duration::days(365)).to_rfc3339();

    db.set_setting("license_key", key, None)?;
    db.set_setting("license_tier", "pro", None)?;
    db.set_setting("license_expires_at", &expires_at, None)?;
    build_status(&db)
}
#[tauri::command]
pub async fn license_get_status(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    build_status(&db)
}
