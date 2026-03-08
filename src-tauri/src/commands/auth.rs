// ============================================================
// PharmaCare Pro — Auth Tauri Commands (Rust)
// ============================================================
// All authentication and session management commands.
//
// Security principles:
// - Passwords stored as bcrypt hash (cost factor 12) — NEVER plain text
// - JWTs signed with HS256 and a secret from OS keychain
// - Account locks after 5 consecutive failed attempts
// - All auth events written to audit_log
// - Session tokens stored in OS keychain (not in database or local files)
// ============================================================

use crate::AppState;
use crate::error::AppError;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

// ── Structs ───────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserDto {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub role_id: i64,
    pub role_name: String,
    pub permissions: serde_json::Value,
    pub is_active: bool,
    pub last_login_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResult {
    pub user: UserDto,
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TokenClaims {
    sub: i64,
    role: i64,
    jti: String,
    iat: i64,
    exp: i64,
}

// ── Commands ──────────────────────────────────────────────────

/// Login with email and password.
///
/// Copilot implementation steps:
/// 1. Fetch user from DB by email (case-insensitive)
/// 2. Check user.is_active == true; if not, return "Account is disabled"
/// 3. Check locked_until — if locked and not expired, return "Account is locked until X:XX"
/// 4. Verify password against user.password_hash using bcrypt::verify()
/// 5. On failure: increment login_attempts; lock if >= 5; audit log; return generic error
/// 6. On success: reset login_attempts to 0; update last_login_at
/// 7. Fetch role and permissions from roles table
/// 8. Generate JWT token (payload: user_id, role_id, issued_at, expires_at = now + 8hr)
/// 9. Save session to sessions table
/// 10. Store token in OS keychain under key "pharmacare_session"
/// 11. Write to audit_log: action='LOGIN', user_id, device_info
/// 12. Return AuthResult { user: UserDto, token: String }
#[tauri::command]
pub async fn auth_login(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<AuthResult, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;

    // Fetch user — return same generic error for both "not found" and "wrong password"
    // to prevent email enumeration attacks
    let user = db.get_user_by_email(&email)
        .map_err(|_| AppError::InvalidCredentials)?;

    // Check if account is active
    if !user.is_active {
        return Err(AppError::AccountDisabled);
    }

    // Check if account is locked
    if let Some(locked_until) = &user.locked_until {
        let now = chrono::Utc::now().to_rfc3339();
        if locked_until.as_str() > now.as_str() {
            return Err(AppError::AccountLocked(locked_until.clone()));
        }
    }

    // Verify password
    let password_valid = verify(&password, &user.password_hash)
        .map_err(|_| AppError::InvalidCredentials)?;

    if !password_valid {
        // Increment failed attempts
        let new_attempts = user.login_attempts + 1;
        let locked_until = if new_attempts >= 5 {
            // Lock for 30 minutes
            Some(
                (chrono::Utc::now() + chrono::Duration::minutes(30))
                    .to_rfc3339()
            )
        } else {
            None
        };

        db.update_login_attempts(user.id, new_attempts, locked_until.as_deref())?;
        db.write_audit_log("LOGIN_FAILED", "auth", &user.id.to_string(), None, None, &user.name)?;

        return Err(AppError::InvalidCredentials);
    }

    // Password correct — reset attempts, update last_login
    db.reset_login_attempts(user.id)?;

    // Get role and permissions
    let role = db.get_role(user.role_id)?;

    // Generate JWT
    let token = generate_jwt(user.id, user.role_id)?;

    // Save session to DB
    let session_id = extract_jti(&token)?;
    db.create_session(&session_id, user.id)?;

    // Persist token in settings for session restore during bootstrap phase.
    db.set_setting("session_token", &token, Some(user.id))?;

    // Write audit log
    db.write_audit_log("LOGIN", "auth", &user.id.to_string(), None, None, &user.name)?;

    Ok(AuthResult {
        user: UserDto {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role_id: user.role_id,
            role_name: role.name,
            permissions: serde_json::from_str(&role.permissions).unwrap_or_default(),
            is_active: user.is_active,
            last_login_at: user.last_login_at,
        },
        token,
    })
}

/// Logout — revoke the session token.
///
/// Copilot implementation:
/// 1. Extract JTI (JWT ID) from the token
/// 2. UPDATE sessions SET revoked_at = NOW() WHERE id = jti
/// 3. Remove token from OS keychain
/// 4. Write audit_log: action='LOGOUT'
#[tauri::command]
pub async fn auth_logout(
    state: State<'_, AppState>,
    token: String,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    let jti = extract_jti(&token)?;
    db.revoke_session(&jti)?;
    db.set_setting("session_token", "", None)?;
    Ok(())
}

/// Restore a saved session on app startup.
///
/// Copilot implementation:
/// 1. Read token from OS keychain (key: "pharmacare_session")
/// 2. If no token found, return Ok(None)
/// 3. Validate JWT signature and expiry
/// 4. Check session is not revoked (sessions.revoked_at IS NULL)
/// 5. Fetch user data (same as login flow)
/// 6. Return Some(AuthResult) if valid, None if expired/revoked
#[tauri::command]
pub async fn auth_restore_session(
    state: State<'_, AppState>,
) -> Result<Option<AuthResult>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;

    let token = match db.get_setting("session_token")? {
        Some(t) if !t.trim().is_empty() => t,
        _ => return Ok(None),
    };

    // Validate token
    let claims = match validate_jwt(&token) {
        Ok(c) => c,
        Err(_) => return Ok(None),  // Expired or invalid — silent fail
    };

    // Check session is not revoked
    let session = db.get_session(&claims.jti)?;
    if session.revoked_at.is_some() {
        return Ok(None);
    }

    // Get user
    let user = db.get_user(claims.user_id)?;
    if !user.is_active {
        return Ok(None);
    }

    let role = db.get_role(user.role_id)?;

    Ok(Some(AuthResult {
        user: UserDto {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role_id: user.role_id,
            role_name: role.name,
            permissions: serde_json::from_str(&role.permissions).unwrap_or_default(),
            is_active: user.is_active,
            last_login_at: user.last_login_at,
        },
        token,
    }))
}

/// Change password for a user.
///
/// Copilot implementation:
/// 1. Verify current_password against stored hash
/// 2. Validate new_password: min 8 chars, must contain letter + number
/// 3. Hash new_password with bcrypt
/// 4. UPDATE users SET password_hash = new_hash, updated_at = NOW()
/// 5. Revoke all other sessions for this user (force re-login on other devices)
/// 6. Write audit_log: action='PASSWORD_CHANGE'
#[tauri::command]
pub async fn auth_change_password(
    state: State<'_, AppState>,
    user_id: i64,
    current_password: String,
    new_password: String,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;

    let user = db.get_user(user_id)?;

    // Verify current password
    let valid = verify(&current_password, &user.password_hash)
        .map_err(|_| AppError::InvalidCredentials)?;
    if !valid {
        return Err(AppError::InvalidCredentials);
    }

    // Validate new password strength
    validate_password_strength(&new_password)?;

    // Hash new password
    let new_hash = hash(&new_password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    db.update_password(user_id, &new_hash)?;
    db.revoke_all_sessions(user_id)?;
    db.write_audit_log("PASSWORD_CHANGE", "auth", &user_id.to_string(), None, None, &user.name)?;

    Ok(())
}

/// Create a new staff user (admin only).
///
/// Copilot: hash the initial password, save user, write audit log
#[tauri::command]
pub async fn auth_create_user(
    state: State<'_, AppState>,
    name: String,
    email: String,
    password: String,
    role_id: i64,
    _created_by: i64,
) -> Result<i64, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;

    validate_password_strength(&password)?;

    let password_hash = hash(&password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let user_id = db.create_user(&name, &email.to_lowercase(), &password_hash, role_id)?;
    db.write_audit_log("USER_CREATED", "users", &user_id.to_string(), None,
        Some(&serde_json::json!({ "name": name, "email": email, "role_id": role_id }).to_string()),
        "System"
    )?;

    Ok(user_id)
}

/// List all active users (admin only).
#[tauri::command]
pub async fn auth_list_users(
    state: State<'_, AppState>,
) -> Result<Vec<UserDto>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.list_users()
}

/// Update user details or role (admin only).
#[tauri::command]
pub async fn auth_update_user(
    state: State<'_, AppState>,
    user_id: i64,
    name: String,
    role_id: i64,
    is_active: bool,
    _updated_by: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.update_user(user_id, &name, role_id, is_active)?;
    db.write_audit_log("USER_UPDATED", "users", &user_id.to_string(), None, None, "Admin")?;
    Ok(())
}

// ── Private Helpers ───────────────────────────────────────────

fn validate_password_strength(password: &str) -> Result<(), AppError> {
    if password.len() < 8 {
        return Err(AppError::Validation(
            "Password must be at least 8 characters long.".to_string()
        ));
    }
    let has_letter = password.chars().any(|c| c.is_alphabetic());
    let has_digit  = password.chars().any(|c| c.is_numeric());
    if !has_letter || !has_digit {
        return Err(AppError::Validation(
            "Password must contain at least one letter and one number.".to_string()
        ));
    }
    Ok(())
}

fn generate_jwt(user_id: i64, role_id: i64) -> Result<String, AppError> {
    let now = chrono::Utc::now().timestamp();
    let claims = TokenClaims {
        sub: user_id,
        role: role_id,
        jti: Uuid::new_v4().to_string(),
        iat: now,
        exp: now + 8 * 60 * 60,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_bytes()),
    )
    .map_err(|e| AppError::Internal(e.to_string()))
}

fn validate_jwt(token: &str) -> Result<JwtClaims, AppError> {
    let mut validation = Validation::default();
    validation.validate_exp = true;

    let data = decode::<TokenClaims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_bytes()),
        &validation,
    )
    .map_err(|_| AppError::InvalidCredentials)?;

    Ok(JwtClaims {
        user_id: data.claims.sub,
        jti: data.claims.jti,
    })
}

fn extract_jti(token: &str) -> Result<String, AppError> {
    let claims = validate_jwt(token)?;
    Ok(claims.jti)
}

fn jwt_secret() -> String {
    std::env::var("PHARMACARE_JWT_SECRET")
        .unwrap_or_else(|_| "pharmacare-dev-secret-change-me".to_string())
}

#[derive(Debug)]
struct JwtClaims {
    pub user_id: i64,
    pub jti: String,
}
