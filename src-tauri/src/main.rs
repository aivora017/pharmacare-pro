// ============================================================
// PharmaCare Pro — Tauri Application Entry Point (Rust)
// ============================================================
// This is the Rust backend. It handles:
// 1. App lifecycle (startup, shutdown)
// 2. Database initialisation and migrations
// 3. All Tauri commands (called from the React frontend via invoke())
// 4. Background tasks (AI night processing, email polling)
// 5. OS-level features (keychain, printer access, file system)
//
// Architecture:
// Frontend (React/TypeScript) → invoke('command_name') → Tauri Command (Rust)
// The Rust commands access SQLite and return data to the frontend.
// ============================================================

// Prevents a console window from appearing on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod security;
mod background;
mod error;

use commands::{auth, medicine, billing, purchase, customer, supplier, inventory, barcode, email, printer, reports, backup, license, ai_commands};
use db::Database;
use std::sync::Mutex;

/// Global application state — shared across all Tauri commands
pub struct AppState {
    pub db: Mutex<Database>,
}

fn main() {
    // Initialise logger (debug builds only)
    #[cfg(debug_assertions)]
    env_logger::init();

    tauri::Builder::default()
        // ── Tauri Plugins ────────────────────────────────────────
        .plugin(tauri_plugin_keyring::init())       // OS keychain for secrets
        .plugin(tauri_plugin_shell::init())         // Shell access
        .plugin(tauri_plugin_updater::Builder::new().build()) // Auto-updates
        .plugin(tauri_plugin_dialog::init())        // File open/save dialogs
        .plugin(tauri_plugin_fs::init())            // File system access
        .plugin(tauri_plugin_notification::init())  // Desktop notifications

        // ── App Setup ────────────────────────────────────────────
        .setup(|app| {
            // Initialise database (creates file, runs migrations)
            let db = Database::init(app.handle()).expect("Failed to initialise database");

            // Register global app state
            app.manage(AppState { db: Mutex::new(db) });

            // Start background tasks (AI nightly, email polling)
            background::start_background_tasks(app.handle().clone());

            Ok(())
        })

        // ── Register All Tauri Commands ───────────────────────────
        // These are callable from the frontend via: invoke('command_name', { args })
        .invoke_handler(tauri::generate_handler![
            // Auth & Security
            auth::auth_login,
            auth::auth_logout,
            auth::auth_restore_session,
            auth::auth_change_password,
            auth::auth_create_user,
            auth::auth_list_users,
            auth::auth_update_user,

            // Medicine Master
            medicine::medicine_search,
            medicine::medicine_get,
            medicine::medicine_create,
            medicine::medicine_update,
            medicine::medicine_delete,
            medicine::medicine_get_batch_by_barcode,
            medicine::medicine_list_batches,
            medicine::medicine_create_batch,
            medicine::medicine_update_batch,

            // Billing / POS
            billing::billing_create_bill,
            billing::billing_cancel_bill,
            billing::billing_get_bill,
            billing::billing_list_bills,
            billing::billing_hold_bill,
            billing::billing_get_held_bills,
            billing::billing_restore_held_bill,
            billing::billing_create_return,
            billing::billing_get_today_summary,

            // Purchase & Suppliers
            purchase::purchase_create_bill,
            purchase::purchase_get_bill,
            purchase::purchase_list_bills,
            purchase::purchase_create_po,
            purchase::purchase_list_suppliers,
            purchase::purchase_create_supplier,
            purchase::purchase_update_supplier,

            // Customers & Doctors
            customer::customer_search,
            customer::customer_get,
            customer::customer_create,
            customer::customer_update,
            customer::customer_get_history,
            customer::doctor_list,
            customer::doctor_create,
            customer::doctor_update,

            // Inventory
            inventory::inventory_get_stock,
            inventory::inventory_adjust_stock,
            inventory::inventory_get_low_stock,
            inventory::inventory_get_expiry_list,

            // Barcodes
            barcode::barcode_generate_for_batch,
            barcode::barcode_generate_bulk,
            barcode::barcode_print_labels,

            // Email Import
            email::email_test_connection,
            email::email_fetch_invoices,
            email::email_parse_attachment,
            email::email_import_bill,
            email::email_list_imports,

            // Printing
            printer::printer_list_printers,
            printer::printer_print_bill,
            printer::printer_print_barcode_labels,
            printer::printer_test_print,

            // Reports
            reports::reports_sales,
            reports::reports_purchase,
            reports::reports_stock,
            reports::reports_gst,
            reports::reports_profit_loss,
            reports::reports_ca_package,
            reports::reports_audit_log,

            // Backup
            backup::backup_create,
            backup::backup_restore,
            backup::backup_list,

            // License
            license::license_validate,
            license::license_activate,
            license::license_get_status,

            // AI Commands
            ai_commands::ai_get_morning_briefing,
            ai_commands::ai_get_demand_forecast,
            ai_commands::ai_get_expiry_risks,
            ai_commands::ai_get_customer_segments,
            ai_commands::ai_get_anomalies,
            ai_commands::ai_ask_pharmacare,
            ai_commands::ai_compose_message,
        ])
        .run(tauri::generate_context!())
        .expect("Error starting PharmaCare Pro");
}
