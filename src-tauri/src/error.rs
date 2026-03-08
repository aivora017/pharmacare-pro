// User-friendly error types
// All errors shown to users must be plain English - no technical details
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
pub enum AppError {
    #[error("Email or password is incorrect. Please try again.")]
    InvalidCredentials,
    #[error("Your account has been disabled. Please contact the admin.")]
    AccountDisabled,
    #[error("Account is locked until {0}. Please try again later.")]
    AccountLocked(String),
    #[error("You do not have permission to perform this action.")]
    Forbidden,
    #[error("Not enough stock for {0}. Available: {1}, Requested: {2}")]
    InsufficientStock(String, i64, i64),
    #[error("Could not connect to the database. Please restart the app.")]
    DatabaseLock,
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error("Something went wrong. Please try again. ({0})")]
    Internal(String),
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Database(e.to_string())
    }
}
impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}
