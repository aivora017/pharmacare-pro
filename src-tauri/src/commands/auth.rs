//! Auth Commands
//! SECURITY: bcrypt hashing, JWT sessions, OS keychain, account lockout (5 attempts → 30 min lock)
//!
//! auth_login steps:
//! 1. SELECT user WHERE LOWER(email)=email AND deleted_at IS NULL
//! 2. If not found → InvalidCredentials (don't reveal which field is wrong)
//! 3. If is_active=0 → AccountDisabled
//! 4. If locked_until is set and in future → AccountLocked(time_remaining)
//! 5. bcrypt::verify(password, password_hash) — if fail: increment login_attempts,
//!    if attempts >= 5: set locked_until = now + 30min; always return InvalidCredentials
//! 6. On success: reset login_attempts=0, update last_login_at
//! 7. Fetch role name + permissions JSON from roles table
//! 8. Create JWT: { sub: user_id, role: role_id, jti: uuid_v4, iat: now, exp: now+8hr }
//!    Sign with HS256 using secret from OS keychain (key: "pharmacare_jwt_secret")
//! 9. INSERT INTO sessions (id=jti, user_id, expires_at=now+8hr, device_info)
//! 10. INSERT INTO audit_log (action="LOGIN", module="auth", user_name=name)
//! 11. Return AuthResult { user: UserDto, token: String }

use crate::{AppState, error::AppError};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserDto {
    pub id: i64, pub name: String, pub email: String,
    pub role_id: i64, pub role_name: String,
    pub permissions: serde_json::Value,
    pub is_active: bool, pub last_login_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResult { pub user: UserDto, pub token: String }

#[tauri::command]
pub async fn auth_login(
    state: State<'_, AppState>, email: String, password: String
) -> Result<AuthResult, AppError> {
    // TODO (Copilot): implement per step-by-step above
    todo!("auth_login")
}

#[tauri::command]
pub async fn auth_logout(state: State<'_, AppState>, token: String) -> Result<(), AppError> {
    // TODO: extract jti from JWT, UPDATE sessions SET revoked_at=now WHERE id=jti
    todo!("auth_logout")
}

#[tauri::command]
pub async fn auth_restore_session(state: State<'_, AppState>) -> Result<Option<AuthResult>, AppError> {
    // TODO: read token from OS keychain, verify JWT not expired/revoked, return user
    todo!("auth_restore_session")
}

#[tauri::command]
pub async fn auth_change_password(
    state: State<'_, AppState>, user_id: i64,
    current_password: String, new_password: String
) -> Result<(), AppError> {
    // TODO: verify current, check new >= 8 chars, bcrypt hash, UPDATE, revoke all sessions, audit
    todo!("auth_change_password")
}

#[tauri::command]
pub async fn auth_create_user(
    state: State<'_, AppState>, name: String, email: String,
    password: String, role_id: i64, created_by: i64
) -> Result<i64, AppError> {
    // TODO: validate email unique, password strength, bcrypt hash cost=12, INSERT, audit
    todo!("auth_create_user")
}

#[tauri::command]
pub async fn auth_list_users(state: State<'_, AppState>) -> Result<Vec<UserDto>, AppError> {
    // TODO: SELECT users JOIN roles WHERE deleted_at IS NULL ORDER BY name
    todo!("auth_list_users")
}

#[tauri::command]
pub async fn auth_update_user(
    state: State<'_, AppState>, user_id: i64, name: String,
    role_id: i64, is_active: bool, updated_by: i64
) -> Result<(), AppError> {
    // TODO: UPDATE users, write audit_log with old+new values
    todo!("auth_update_user")
}
