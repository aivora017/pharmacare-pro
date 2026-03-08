// Database Layer - SQLite initialisation and migrations
// Copilot implementation:
// 1. Resolve DB path: {app_data_dir}/pharmacare_pro.db
// 2. Get/create encryption key from OS keychain (key: "pharmacare_db_key")
// 3. Open connection: Connection::open_with_flags() with SQLCipher key
// 4. Set pragmas: WAL mode, foreign keys ON, synchronous NORMAL
// 5. Run all .sql migration files from src/db/migrations/ in numeric order
//    Track which migrations have run in a schema_migrations table

use crate::error::AppError;
use rusqlite::Connection;
use tauri::AppHandle;

pub struct Database {
    pub conn: Connection,
}

impl Database {
    pub fn init(_app: &AppHandle) -> Result<Self, AppError> {
        // TODO (Copilot): implement database initialisation
        // See the step-by-step instructions in the comment above
        // The 001_initial.sql migration is at src/db/migrations/001_initial.sql
        todo!("Implement Database::init")
    }

    /// Write to the audit log - call after every create/update/delete
    pub fn audit(
        &self, user_id: Option<i64>, user_name: &str,
        action: &str, module: &str, record_id: &str,
        old_value: Option<&str>, new_value: Option<&str>,
    ) -> Result<(), AppError> {
        // TODO (Copilot): INSERT INTO audit_log (...)
        // This is called from nearly every command - implement it properly
        todo!("Implement audit logging")
    }
}
