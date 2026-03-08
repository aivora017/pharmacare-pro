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

use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command]
pub async fn ai_get_morning_briefing(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: run 5-6 SQL queries; return {actions: [{priority, icon, message, link}]}
    // Include: expiry alerts, low stock count, pending payments, yesterday's summary
    todo!("ai_get_morning_briefing")
}
#[tauri::command]
pub async fn ai_get_demand_forecast(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: for each active medicine: avg 30-day sales, seasonal trend, safety stock
    // Return top 50 medicines needing reorder
    todo!("ai_get_demand_forecast")
}
#[tauri::command]
pub async fn ai_get_expiry_risks(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: score each batch: risk = qty_on_hand / (daily_sales_rate * days_to_expiry)
    // Insert/update ai_expiry_risk table; return HIGH + CRITICAL risk batches
    todo!("ai_get_expiry_risks")
}
#[tauri::command]
pub async fn ai_get_customer_segments(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: RFM (Recency/Frequency/Monetary) scoring; segment → update ai_customer_segments
    todo!("ai_get_customer_segments")
}
#[tauri::command]
pub async fn ai_get_anomalies(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // TODO: check for: discount > 30%, selling below cost, stock going negative, duplicate bills
    // Insert into ai_anomalies; return unreviewed ones
    todo!("ai_get_anomalies")
}
#[tauri::command]
pub async fn ai_ask_pharmacare(state: State<'_, AppState>, question: String) -> Result<String, AppError> {
    // TODO:
    // 1. Fetch Claude API key from OS keychain
    // 2. Run relevant SQL queries based on question keywords to get context data
    // 3. Build system prompt with pharmacy name + aggregated context (no PII)
    // 4. Call https://api.anthropic.com/v1/messages with claude-sonnet-4-20250514
    // 5. Return text answer
    todo!("ai_ask_pharmacare")
}
#[tauri::command]
pub async fn ai_compose_message(
    state: State<'_, AppState>, situation: String,
    customer_name: String, details: serde_json::Value
) -> Result<String, AppError> {
    // TODO: Call Claude API to draft WhatsApp/SMS message
    // situation: "refill_reminder"|"credit_due"|"birthday"|"bulk_promotion"
    todo!("ai_compose_message")
}

