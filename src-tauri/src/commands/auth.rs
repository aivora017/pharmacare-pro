use crate::{AppState, error::AppError};
use tauri::State;

#[tauri::command] pub async fn auth_login(state: State<'_, AppState>, email: String, password: String) -> Result<serde_json::Value, AppError> { state.db.lock()?.auth_login(&email, &password) }
#[tauri::command] pub async fn auth_logout(state: State<'_, AppState>, token: String) -> Result<(), AppError> { state.db.lock()?.auth_logout(&token) }
#[tauri::command] pub async fn auth_restore_session(state: State<'_, AppState>) -> Result<Option<serde_json::Value>, AppError> { state.db.lock()?.auth_restore() }
#[tauri::command] pub async fn auth_change_password(state: State<'_, AppState>, user_id: i64, current_password: String, new_password: String) -> Result<(), AppError> { state.db.lock()?.auth_change_password(user_id, &current_password, &new_password) }
#[tauri::command] pub async fn auth_create_user(state: State<'_, AppState>, name: String, email: String, password: String, role_id: i64) -> Result<i64, AppError> { state.db.lock()?.create_user(&name, &email, &password, role_id) }
#[tauri::command] pub async fn auth_list_users(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> { state.db.lock()?.list_users() }
#[tauri::command] pub async fn auth_update_user(state: State<'_, AppState>, user_id: i64, name: String, role_id: i64, is_active: bool) -> Result<(), AppError> { state.db.lock()?.update_user(user_id, &name, role_id, is_active) }
#[tauri::command] pub async fn auth_reset_password(state: State<'_, AppState>, user_id: i64, new_password: String, admin_id: i64) -> Result<(), AppError> { state.db.lock()?.admin_reset_password(user_id, &new_password, admin_id) }
