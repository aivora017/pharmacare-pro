// PharmaCare Pro - Tauri App Entry Point
// IMPORTANT: Every Tauri command must be listed in invoke_handler!
// Frontend calls: invoke("command_name", { args }) → Rust command → SQLite → result
//
// Copilot: implement each command in its respective file in commands/
// Follow the pattern in commands/auth.rs and commands/billing.rs

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod error;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<db::Database>,
}

fn main() {
    #[cfg(debug_assertions)]
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let db = db::Database::init(app.handle()).expect("Database init failed");
            app.manage(AppState { db: Mutex::new(db) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ── Auth & Users
            commands::auth::auth_login,
            commands::auth::auth_logout,
            commands::auth::auth_restore_session,
            commands::auth::auth_change_password,
            commands::auth::auth_create_user,
            commands::auth::auth_list_users,
            commands::auth::auth_update_user,
            // ── Medicine
            commands::medicine::medicine_search,
            commands::medicine::medicine_get,
            commands::medicine::medicine_create,
            commands::medicine::medicine_update,
            commands::medicine::medicine_delete,
            commands::medicine::medicine_get_batch_by_barcode,
            commands::medicine::medicine_list_batches,
            commands::medicine::medicine_create_batch,
            commands::medicine::medicine_update_batch,
            // ── Billing / POS
            commands::billing::billing_create_bill,
            commands::billing::billing_cancel_bill,
            commands::billing::billing_get_bill,
            commands::billing::billing_list_bills,
            commands::billing::billing_hold_bill,
            commands::billing::billing_get_held_bills,
            commands::billing::billing_restore_held_bill,
            commands::billing::billing_create_return,
            commands::billing::billing_get_today_summary,
            // ── Purchase
            commands::purchase::purchase_create_bill,
            commands::purchase::purchase_get_bill,
            commands::purchase::purchase_list_bills,
            commands::purchase::purchase_create_po,
            commands::purchase::purchase_create_supplier,
            commands::purchase::purchase_list_suppliers,
            commands::purchase::purchase_update_supplier,
            // ── Customers & Doctors
            commands::customer::customer_search,
            commands::customer::customer_get,
            commands::customer::customer_create,
            commands::customer::customer_update,
            commands::customer::customer_get_history,
            commands::customer::doctor_list,
            commands::customer::doctor_create,
            commands::customer::doctor_update,
            // ── Inventory
            commands::inventory::inventory_get_stock,
            commands::inventory::inventory_get_low_stock,
            commands::inventory::inventory_get_expiry_list,
            commands::inventory::inventory_adjust_stock,
            // ── Barcodes
            commands::barcode::barcode_generate_for_batch,
            commands::barcode::barcode_generate_bulk,
            commands::barcode::barcode_print_labels,
            // ── Email Import
            commands::email_import::email_test_connection,
            commands::email_import::email_fetch_invoices,
            commands::email_import::email_import_bill,
            commands::email_import::email_list_imports,
            // ── Printing
            commands::printer::printer_list_printers,
            commands::printer::printer_print_bill,
            commands::printer::printer_print_labels,
            commands::printer::printer_test_print,
            // ── Reports
            commands::reports::reports_sales,
            commands::reports::reports_purchase,
            commands::reports::reports_stock,
            commands::reports::reports_gst,
            commands::reports::reports_profit_loss,
            commands::reports::reports_ca_package,
            commands::reports::reports_audit_log,
            // ── Backup
            commands::backup::backup_create,
            commands::backup::backup_restore,
            commands::backup::backup_list,
            // ── License
            commands::license::license_validate,
            commands::license::license_activate,
            commands::license::license_get_status,
            // ── AI
            commands::ai_commands::ai_get_morning_briefing,
            commands::ai_commands::ai_get_demand_forecast,
            commands::ai_commands::ai_get_expiry_risks,
            commands::ai_commands::ai_get_customer_segments,
            commands::ai_commands::ai_get_anomalies,
            commands::ai_commands::ai_ask_pharmacare,
            commands::ai_commands::ai_compose_message,
            // ── Settings
            commands::settings::settings_get,
            commands::settings::settings_set,
            commands::settings::settings_get_all,
        ])
        .run(tauri::generate_context!())
        .expect("PharmaCare Pro failed to start");
}


