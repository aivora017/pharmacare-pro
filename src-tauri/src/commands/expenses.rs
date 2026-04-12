use crate::{AppState, error::AppError};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn expense_list(state: State<'_, AppState>, from: String, to: String, category: Option<String>) -> Result<Value, AppError> {
    state.db.lock()?.list_expenses(&from, &to, category.as_deref())
}

#[tauri::command]
pub async fn expense_create(state: State<'_, AppState>, data: Value, user_id: i64) -> Result<i64, AppError> {
    state.db.lock()?.create_expense(&data, user_id)
}

#[tauri::command]
pub async fn expense_update(state: State<'_, AppState>, id: i64, data: Value) -> Result<(), AppError> {
    state.db.lock()?.update_expense(id, &data)
}

#[tauri::command]
pub async fn expense_delete(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    state.db.lock()?.delete_expense(id)
}

#[tauri::command]
pub async fn expense_cash_book(state: State<'_, AppState>, from: String, to: String) -> Result<Value, AppError> {
    state.db.lock()?.get_cash_book(&from, &to)
}

#[tauri::command]
pub async fn expense_summary(state: State<'_, AppState>, from: String, to: String) -> Result<Value, AppError> {
    state.db.lock()?.get_expense_summary(&from, &to)
}
