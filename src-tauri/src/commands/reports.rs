#![allow(unused_variables, dead_code)]
//! Reports and CA Package Generation
//! generateCAPackage creates a ZIP with all annual reports for the chartered accountant.
//! This is an exclusive feature - no Indian pharmacy software bundles CA reports.

use crate::{error::AppError, AppState};
use crate::commands::permission::require_permission;
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct ReportFilter {
    pub from_date: String,
    pub to_date: String,
    pub supplier_id: Option<i64>,
    pub customer_id: Option<i64>,
    pub user_id: Option<i64>,
    pub module: Option<String>,
    pub action: Option<String>,
}

#[tauri::command]
pub async fn reports_sales(
    state: State<'_, AppState>,
    filter: ReportFilter,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_sales(&filter.from_date, &filter.to_date)
}
#[tauri::command]
pub async fn reports_purchase(
    state: State<'_, AppState>,
    filter: ReportFilter,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_purchase(&filter.from_date, &filter.to_date, filter.supplier_id)
}
#[tauri::command]
pub async fn reports_stock(
    state: State<'_, AppState>,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_stock()
}
#[tauri::command]
pub async fn reports_gst(
    state: State<'_, AppState>,
    filter: ReportFilter,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_gst(&filter.from_date, &filter.to_date)
}
#[tauri::command]
pub async fn reports_profit_loss(
    state: State<'_, AppState>,
    filter: ReportFilter,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_profit_loss(&filter.from_date, &filter.to_date)
}
#[tauri::command]
pub async fn reports_expiry_writeoff(
    state: State<'_, AppState>,
    filter: ReportFilter,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_expiry_writeoff(&filter.from_date, &filter.to_date)
}
#[tauri::command]
pub async fn reports_customer_outstanding(
    state: State<'_, AppState>,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_customer_outstanding()
}
#[tauri::command]
pub async fn reports_supplier_outstanding(
    state: State<'_, AppState>,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_supplier_outstanding()
}
#[tauri::command]
pub async fn reports_ca_package(
    state: State<'_, AppState>,
    financial_year: String,
    actor_user_id: i64,
) -> Result<String, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_ca_package(&financial_year)
}
#[tauri::command]
pub async fn reports_audit_log(
    state: State<'_, AppState>,
    filter: ReportFilter,
    actor_user_id: i64,
) -> Result<serde_json::Value, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, actor_user_id, "reports")?;
    db.reports_audit_log(
        &filter.from_date,
        &filter.to_date,
        filter.user_id,
        filter.module.as_deref(),
        filter.action.as_deref(),
    )
}
