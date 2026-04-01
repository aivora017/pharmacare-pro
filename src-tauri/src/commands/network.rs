use crate::{AppState, error::AppError};
use tauri::State;

/// Get this machine's LAN IP address
#[tauri::command]
pub async fn network_get_local_ip() -> Result<String, AppError> {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| AppError::Internal(format!("Could not get local IP: {}", e)))
}

/// Start the embedded LAN API server
#[tauri::command]
pub async fn network_start_server(state: State<'_, AppState>) -> Result<String, AppError> {
    let db_path = state.db.lock()?.get_db_path();
    crate::server::start_lan_server(db_path)
        .await
        .map_err(|e| AppError::Internal(e))
}

/// Stop the server (just saves setting — tokio task runs until app exit)
#[tauri::command]
pub async fn network_stop_server(state: State<'_, AppState>) -> Result<(), AppError> {
    state.db.lock()?.set_setting("lan_server_enabled", "\"false\"", None)
}

/// Get network status: IP, server running, connected clients
#[tauri::command]
pub async fn network_get_status(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let ip = local_ip_address::local_ip().map(|ip| ip.to_string()).unwrap_or_else(|_| "Unknown".into());
    let enabled = state.db.lock()?.get_setting("lan_server_enabled")?
        .map(|v| v.trim_matches('"') == "true").unwrap_or(false);
    let server_url = state.db.lock()?.get_setting("lan_server_url")?
        .map(|v| v.trim_matches('"').to_string()).unwrap_or_default();
    let mode = state.db.lock()?.get_setting("network_mode")?
        .map(|v| v.trim_matches('"').to_string()).unwrap_or_else(|| "standalone".into());
    Ok(serde_json::json!({
        "local_ip": ip,
        "lan_port": crate::server::LAN_PORT,
        "server_enabled": enabled,
        "server_url": server_url,
        "network_mode": mode,
        "server_address": format!("{}:{}", ip, crate::server::LAN_PORT),
    }))
}

/// Check drug interactions for a list of medicine names
#[tauri::command]
pub async fn network_check_interactions(state: State<'_, AppState>, medicine_names: Vec<String>) -> Result<serde_json::Value, AppError> {
    state.db.lock()?.check_drug_interactions(&medicine_names)
}

/// Get license status
#[tauri::command]
pub async fn license_get_status(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    state.db.lock()?.license_get_status()
}

/// Activate a license key
#[tauri::command]
pub async fn license_activate(state: State<'_, AppState>, license_key: String) -> Result<serde_json::Value, AppError> {
    state.db.lock()?.license_activate(&license_key)
}

/// Get items waiting to sync to Supabase
#[tauri::command]
pub async fn sync_get_queue(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    state.db.lock()?.sync_get_queue()
}

/// Push pending items to Supabase
#[tauri::command]
pub async fn sync_push_to_supabase(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock()?;
    let url = db.get_setting("supabase_url")?.unwrap_or_default();
    let key = db.get_setting("supabase_anon_key")?.unwrap_or_default();
    let url = url.trim_matches('"');
    let key = key.trim_matches('"');
    if url.is_empty() || key.is_empty() {
        return Err(AppError::Validation("Supabase URL and key not configured. Go to Settings → Cloud Sync.".into()));
    }
    db.sync_push(url, key)
}
