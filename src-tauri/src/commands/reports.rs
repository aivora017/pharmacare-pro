use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command] pub async fn reports_sales(state: State<'_, AppState>, from_date: String, to_date: String) -> Result<serde_json::Value, AppError> { state.db.lock()?.reports_sales(&from_date, &to_date) }
#[tauri::command] pub async fn reports_purchase(state: State<'_, AppState>, from_date: String, to_date: String) -> Result<serde_json::Value, AppError> { state.db.lock()?.reports_purchase(&from_date, &to_date) }
#[tauri::command] pub async fn reports_stock(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.reports_stock() }
#[tauri::command] pub async fn reports_gst(state: State<'_, AppState>, from_date: String, to_date: String) -> Result<serde_json::Value, AppError> { state.db.lock()?.reports_gst(&from_date, &to_date) }
#[tauri::command] pub async fn reports_profit_loss(state: State<'_, AppState>, from_date: String, to_date: String) -> Result<serde_json::Value, AppError> { state.db.lock()?.reports_profit_loss(&from_date, &to_date) }
#[tauri::command] pub async fn reports_ca_package(state: State<'_, AppState>, financial_year: String) -> Result<String, AppError> { state.db.lock()?.reports_ca_package(&financial_year) }
#[tauri::command] pub async fn reports_audit_log(state: State<'_, AppState>, from_date: String, to_date: String) -> Result<serde_json::Value, AppError> { state.db.lock()?.reports_audit_log(&from_date, &to_date) }
#[tauri::command] pub async fn reports_export_csv(state: State<'_, AppState>, report_type: String, from_date: String, to_date: String) -> Result<String, AppError> { state.db.lock()?.reports_export_csv(&report_type, &from_date, &to_date) }
