#![allow(unused_variables, dead_code)]
//! Purchase Bills, Suppliers, Email Import
//! purchase_create_bill steps:
//! 1. Validate supplier exists and is active
//! 2. Generate bill_number: "PUR-" + YYYYMM + "-" + sequence
//! 3. TRANSACTION: INSERT purchase_bills, INSERT purchase_bill_items,
//!    INSERT batches (for each new batch), UPDATE supplier.outstanding_balance, audit
//!
//! Email auto-import flow:
//! 1. IMAP connect using credentials from OS keychain
//! 2. Poll for new emails from known supplier email domains
//! 3. Detect CSV/Excel attachments
//! 4. Parse with column mapper (saved per supplier)
//! 5. Show review screen (frontend) before saving
//! 6. On confirm: call purchase_create_bill with source="email_import"

use crate::{AppState, error::AppError};
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
pub struct PurchaseBillCreateInput {
	pub bill_number: String,
	pub supplier_id: i64,
	pub bill_date: String,
	pub due_date: Option<String>,
	pub total_amount: f64,
	pub amount_paid: Option<f64>,
	pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SupplierInput {
	pub name: String,
	pub contact_person: Option<String>,
	pub phone: Option<String>,
	pub email: Option<String>,
	pub email_domain: Option<String>,
	pub gstin: Option<String>,
	pub drug_licence_no: Option<String>,
	pub drug_licence_expiry: Option<String>,
	pub payment_terms: Option<i64>,
	pub credit_limit: Option<f64>,
	pub reliability_score: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct PurchaseOrderCreateInput {
	pub po_number: String,
	pub supplier_id: i64,
	pub expected_by: Option<String>,
	pub notes: Option<String>,
	pub total_amount: Option<f64>,
}

#[tauri::command]
pub async fn purchase_create_bill(
	state: State<'_, AppState>,
	data: PurchaseBillCreateInput,
	user_id: i64,
) -> Result<i64, AppError> {
	let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
	db.purchase_create_bill(&data, user_id)
}
#[tauri::command]
pub async fn purchase_get_bill(state: State<'_, AppState>, id: i64) -> Result<serde_json::Value, AppError> {
	let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
	db.purchase_get_bill(id)
}
#[tauri::command]
pub async fn purchase_list_bills(
	state: State<'_, AppState>,
	filters: serde_json::Value,
) -> Result<serde_json::Value, AppError> {
	let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
	db.purchase_list_bills(&filters)
}
#[tauri::command]
pub async fn purchase_create_po(
	state: State<'_, AppState>,
	data: PurchaseOrderCreateInput,
	user_id: i64,
) -> Result<i64, AppError> {
	let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
	db.purchase_create_po(&data, user_id)
}
#[tauri::command]
pub async fn purchase_create_supplier(
	state: State<'_, AppState>,
	data: SupplierInput,
	user_id: i64,
) -> Result<i64, AppError> {
	let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
	db.purchase_create_supplier(&data, user_id)
}
#[tauri::command]
pub async fn purchase_list_suppliers(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
	let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
	db.purchase_list_suppliers()
}
#[tauri::command]
pub async fn purchase_update_supplier(
	state: State<'_, AppState>,
	id: i64,
	data: serde_json::Value,
	user_id: i64,
) -> Result<(), AppError> {
	let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
	db.purchase_update_supplier(id, &data, user_id)
}

