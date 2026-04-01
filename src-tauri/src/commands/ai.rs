use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command] pub async fn ai_morning_briefing(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.ai_morning_briefing() }
#[tauri::command] pub async fn ai_demand_forecast(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.ai_demand_forecast() }
#[tauri::command] pub async fn ai_expiry_risks(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.ai_expiry_risks() }
#[tauri::command] pub async fn ai_customer_segments(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.ai_customer_segments() }
#[tauri::command] pub async fn ai_abc_xyz(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.ai_abc_xyz() }
#[tauri::command] pub async fn ai_po_suggestions(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.ai_po_suggestions() }
#[tauri::command] pub async fn ai_anomalies(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.ai_anomalies() }
#[tauri::command] pub async fn ai_ask_pharmacare(state: State<'_, AppState>, question: String) -> Result<String, AppError> { state.db.lock()?.ai_ask_pharmacare(&question) }

#[tauri::command]
pub async fn ai_compose_whatsapp(state: State<'_, AppState>, customer_name: String, situation: String, language: String, tone: String) -> Result<String, AppError> {
    state.db.lock()?.ai_compose_whatsapp(&customer_name, &situation, &language, &tone)
}
#[tauri::command]
pub async fn ai_ca_narration(state: State<'_, AppState>, financial_year: String) -> Result<String, AppError> {
    state.db.lock()?.ai_ca_narration(&financial_year)
}
#[tauri::command]
pub async fn ai_ca_checks(state: State<'_, AppState>, financial_year: String) -> Result<serde_json::Value, AppError> {
    state.db.lock()?.ai_ca_checks(&financial_year)
}
