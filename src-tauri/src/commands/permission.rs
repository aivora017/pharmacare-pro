use crate::db::Database;
use crate::error::AppError;

fn has_permission(permissions: &serde_json::Value, key: &str) -> bool {
    permissions
        .get("all")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
        || permissions
            .get(key)
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
}

fn role_fallback_allows(role_name: &str, key: &str) -> bool {
    match role_name.to_ascii_lowercase().as_str() {
        "admin" => true,
        "pharmacist" => matches!(
            key,
            "billing"
                | "medicine"
                | "purchase"
                | "customers"
                | "reports"
                | "settings"
                | "expiry"
                | "barcodes"
                | "doctors"
                | "suppliers"
        ),
        "cashier" => matches!(key, "billing" | "customers"),
        "accountant" => matches!(key, "purchase" | "reports" | "suppliers"),
        "delivery" => key == "customers",
        _ => false,
    }
}

pub fn require_permission(db: &Database, user_id: i64, key: &str) -> Result<(), AppError> {
    let user = db.get_user(user_id)?;
    if !user.is_active {
        return Err(AppError::Forbidden);
    }

    // Keep admin fast-path explicit so permission JSON issues never block admin access.
    if user.role_id == 1 {
        return Ok(());
    }

    let role = db.get_role(user.role_id)?;
    let permissions: serde_json::Value =
        serde_json::from_str(&role.permissions).unwrap_or_else(|_| serde_json::json!({}));

    if has_permission(&permissions, key) || role_fallback_allows(&role.name, key) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

#[cfg(test)]
mod tests {
    use super::require_permission;
    use crate::db::Database;
    use crate::error::AppError;
    use std::path::PathBuf;

    fn test_db_path(name: &str) -> PathBuf {
        let suffix = chrono::Utc::now()
            .timestamp_nanos_opt()
            .unwrap_or_default();
        std::env::temp_dir().join(format!("pharmacare_perm_test_{}_{}.db", name, suffix))
    }

    fn create_user_with_role(db: &Database, role_name: &str, name: &str) -> i64 {
        let role_id = db
            .role_id_by_name(role_name)
            .expect("role must exist in seeded data");
        db.create_user(name, &format!("{}@example.test", name), "hash", role_id)
            .expect("user creation should succeed")
    }

    #[test]
    fn denies_cashier_for_reports_and_settings() {
        let db_path = test_db_path("cashier_denied");
        let db = Database::init_for_test(db_path.clone()).expect("test db init");
        let user_id = create_user_with_role(&db, "cashier", "cashier_denied_user");

        let reports_result = require_permission(&db, user_id, "reports");
        let settings_result = require_permission(&db, user_id, "settings");
        let billing_result = require_permission(&db, user_id, "billing");

        assert!(matches!(reports_result, Err(AppError::Forbidden)));
        assert!(matches!(settings_result, Err(AppError::Forbidden)));
        assert!(billing_result.is_ok());

        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn denies_accountant_for_billing_but_allows_reports() {
        let db_path = test_db_path("accountant_matrix");
        let db = Database::init_for_test(db_path.clone()).expect("test db init");
        let user_id = create_user_with_role(&db, "accountant", "accountant_user");

        let billing_result = require_permission(&db, user_id, "billing");
        let reports_result = require_permission(&db, user_id, "reports");

        assert!(matches!(billing_result, Err(AppError::Forbidden)));
        assert!(reports_result.is_ok());

        let _ = std::fs::remove_file(db_path);
    }

    #[test]
    fn denies_inactive_user_even_with_role_permission() {
        let db_path = test_db_path("inactive_user");
        let db = Database::init_for_test(db_path.clone()).expect("test db init");
        let user_id = create_user_with_role(&db, "pharmacist", "inactive_user");

        let user = db.get_user(user_id).expect("user exists");
        db.update_user(user_id, &user.name, user.role_id, false)
            .expect("deactivate user");

        let result = require_permission(&db, user_id, "medicine");
        assert!(matches!(result, Err(AppError::Forbidden)));

        let _ = std::fs::remove_file(db_path);
    }
}
