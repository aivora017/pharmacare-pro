use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize, Clone)]
pub enum AppError {
    #[error("Email or password is incorrect. Please try again.")]
    InvalidCredentials,
    #[error("Your account has been disabled. Contact the admin.")]
    AccountDisabled,
    #[error("Account is locked until {0}. Try again later.")]
    AccountLocked(String),
    #[error("You don't have permission for this action.")]
    Forbidden,
    #[error("Not enough stock for {0}. Available: {1}, requested: {2}.")]
    InsufficientStock(String, i64, i64),
    #[error("Database is busy. Please restart the app.")]
    DatabaseLock,
    #[error("{0}")]
    Validation(String),
    #[error("Database error: {0}")]
    Database(String),
    #[error("{0}")]
    Internal(String),
    #[error("Network error: {0}")]
    Network(String),
    #[error("External API error: {0}")]
    External(String),
}
impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self { AppError::Database(e.to_string()) }
}
impl From<std::sync::PoisonError<std::sync::MutexGuard<'_, crate::db::Database>>> for AppError {
    fn from(_: std::sync::PoisonError<std::sync::MutexGuard<'_, crate::db::Database>>) -> Self {
        AppError::DatabaseLock
    }
}
