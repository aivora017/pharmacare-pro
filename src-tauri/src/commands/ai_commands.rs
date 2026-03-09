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
    Err(AppError::Validation(
        "AI morning briefing is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn ai_get_demand_forecast(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    Err(AppError::Validation(
        "AI demand forecast is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn ai_get_expiry_risks(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    Err(AppError::Validation(
        "AI expiry risk scoring is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn ai_get_customer_segments(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    Err(AppError::Validation(
        "AI customer segmentation is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn ai_get_anomalies(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    Err(AppError::Validation(
        "AI anomaly detection is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn ai_ask_pharmacare(
    state: State<'_, AppState>,
    question: String,
) -> Result<String, AppError> {
    Err(AppError::Validation(
        "AI assistant is not implemented yet.".to_string(),
    ))
}
#[tauri::command]
pub async fn ai_compose_message(
    state: State<'_, AppState>,
    situation: String,
    customer_name: String,
    details: serde_json::Value,
) -> Result<String, AppError> {
    Err(AppError::Validation(
        "AI message composer is not implemented yet.".to_string(),
    ))
}
