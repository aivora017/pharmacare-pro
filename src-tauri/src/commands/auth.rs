use crate::AppState;
use crate::error::AppError;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

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

#[tauri::command]
pub async fn auth_login(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<AuthResult, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;

    let user = db.get_user_by_email(&email)
        .map_err(|_| AppError::InvalidCredentials)?;

    if !user.is_active {
        return Err(AppError::AccountDisabled);
    }

    if let Some(locked_until) = &user.locked_until {
        let now = chrono::Utc::now().to_rfc3339();
        if locked_until.as_str() > now.as_str() {
            return Err(AppError::AccountLocked(locked_until.clone()));
        }
    }

    let password_valid = verify(&password, &user.password_hash)
        .map_err(|_| AppError::InvalidCredentials)?;

    if !password_valid {
        let new_attempts = user.login_attempts + 1;
        let locked_until = if new_attempts >= 5 {
            Some((chrono::Utc::now() + chrono::Duration::minutes(30)).to_rfc3339())
        } else {
            None
        };

        db.update_login_attempts(user.id, new_attempts, locked_until.as_deref())?;
        db.write_audit_log("LOGIN_FAILED", "auth", &user.id.to_string(), None, None, &user.name)?;

        return Err(AppError::InvalidCredentials);
    }

    db.reset_login_attempts(user.id)?;

    let role = db.get_role(user.role_id)?;

    let token = generate_jwt(user.id, user.role_id)?;

    let session_id = extract_jti(&token)?;
    db.create_session(&session_id, user.id)?;

    db.set_setting("session_token", &token, Some(user.id))?;

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

#[tauri::command]
pub async fn auth_restore_session(
    state: State<'_, AppState>,
) -> Result<Option<AuthResult>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;

    let token = match db.get_setting("session_token")? {
        Some(t) if !t.trim().is_empty() => t,
        _ => return Ok(None),
    };

    let claims = match validate_jwt(&token) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    let session = db.get_session(&claims.jti)?;
    if session.revoked_at.is_some() {
        return Ok(None);
    }

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

#[tauri::command]
pub async fn auth_change_password(
    state: State<'_, AppState>,
    user_id: i64,
    current_password: String,
    new_password: String,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;

    let user = db.get_user(user_id)?;

    let valid = verify(&current_password, &user.password_hash)
        .map_err(|_| AppError::InvalidCredentials)?;
    if !valid {
        return Err(AppError::InvalidCredentials);
    }

    validate_password_strength(&new_password)?;

    let new_hash = hash(&new_password, DEFAULT_COST)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    db.update_password(user_id, &new_hash)?;
    db.revoke_all_sessions(user_id)?;
    db.write_audit_log("PASSWORD_CHANGE", "auth", &user_id.to_string(), None, None, &user.name)?;

    Ok(())
}

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
    db.write_audit_log(
        "USER_CREATED",
        "users",
        &user_id.to_string(),
        None,
        Some(&serde_json::json!({ "name": name, "email": email, "role_id": role_id }).to_string()),
        "System",
    )?;

    Ok(user_id)
}

#[tauri::command]
pub async fn auth_list_users(
    state: State<'_, AppState>,
) -> Result<Vec<UserDto>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.list_users()
}

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

fn validate_password_strength(password: &str) -> Result<(), AppError> {
    if password.len() < 8 {
        return Err(AppError::Validation(
            "Password must be at least 8 characters long.".to_string(),
        ));
    }
    let has_letter = password.chars().any(|c| c.is_alphabetic());
    let has_digit = password.chars().any(|c| c.is_numeric());
    if !has_letter || !has_digit {
        return Err(AppError::Validation(
            "Password must contain at least one letter and one number.".to_string(),
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
        role_id: data.claims.role,
        jti: data.claims.jti,
        exp: data.claims.exp,
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
    pub role_id: i64,
    pub jti: String,
    pub exp: i64,
}
