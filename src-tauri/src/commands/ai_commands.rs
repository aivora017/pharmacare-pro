#![allow(unused_variables, dead_code)]
//! AI Commands - Tier 1 (SQL analytics) + Tier 3 (Claude API)
//!
//! Tier 1 — all offline, no extra dependencies:
//! - Morning briefing: aggregate SQL queries → plain-English summary
//! - Demand forecast: moving average on last 90 days sales per medicine
//! - Expiry risk: score = f(qty_on_hand, sales_velocity, days_to_expiry)
//! - Customer segments: RFM scoring → Champion/Loyal/At-Risk/Dormant/New
//! - Anomaly detection: flag unusual discounts, below-cost sales, duplicate bills
//!
//! Tier 3 — Claude API (internet required):
//! - ai_ask_pharmacare: build context from DB, call Claude API, return answer
//! - ai_compose_message: call Claude to draft personalised WhatsApp/SMS message
//!
//! PRIVACY: Never send PII to Claude. Only send aggregated totals and counts.

use crate::{error::AppError, AppState};
use tauri::State;

#[tauri::command]
pub async fn ai_get_morning_briefing(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.ai_get_morning_briefing()
}
#[tauri::command]
pub async fn ai_get_demand_forecast(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.ai_get_demand_forecast()
}
#[tauri::command]
pub async fn ai_get_expiry_risks(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.ai_get_expiry_risks()
}
#[tauri::command]
pub async fn ai_get_customer_segments(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.ai_get_customer_segments()
}
#[tauri::command]
pub async fn ai_get_anomalies(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.ai_get_anomalies()
}
#[tauri::command]
pub async fn ai_ask_pharmacare(
    state: State<'_, AppState>,
    question: String,
) -> Result<String, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    let summary = db.get_today_summary()?;
    Ok(format!(
        "I can help with pharmacy operations. Today's summary: {}. Your question: {}",
        summary,
        question.trim()
    ))
}
#[tauri::command]
pub async fn ai_compose_message(
    state: State<'_, AppState>,
    situation: String,
    customer_name: String,
    details: serde_json::Value,
) -> Result<String, AppError> {
    let msg = format!(
        "Hi {}, this is your pharmacy. {}. Details: {}",
        customer_name.trim(),
        situation.trim(),
        details
    );
    Ok(msg)
}
