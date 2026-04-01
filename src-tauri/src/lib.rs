pub mod commands;
pub mod db;
pub mod error;
pub mod server;

use std::sync::Mutex;
use tauri::Manager;

pub struct AppState {
    pub db: Mutex<db::Database>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let db = db::Database::init(app.handle()).expect("DB init failed");
            app.manage(AppState { db: Mutex::new(db) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::auth_login,
            commands::auth::auth_logout,
            commands::auth::auth_restore_session,
            commands::auth::auth_change_password,
            commands::auth::auth_create_user,
            commands::auth::auth_list_users,
            commands::auth::auth_update_user,
            commands::auth::auth_reset_password,
            commands::settings::settings_get,
            commands::settings::settings_set,
            commands::settings::settings_get_all,
            commands::settings::settings_get_roles,
            commands::dashboard::dashboard_summary,
            commands::medicine::medicine_search,
            commands::medicine::medicine_get,
            commands::medicine::medicine_create,
            commands::medicine::medicine_update,
            commands::medicine::medicine_delete,
            commands::medicine::medicine_list_batches,
            commands::medicine::medicine_create_batch,
            commands::medicine::medicine_update_batch,
            commands::medicine::medicine_get_by_barcode,
            commands::medicine::medicine_list_categories,
            commands::billing::billing_create_bill,
            commands::billing::billing_cancel_bill,
            commands::billing::billing_get_bill,
            commands::billing::billing_list_bills,
            commands::billing::billing_hold_bill,
            commands::billing::billing_get_held_bills,
            commands::billing::billing_restore_held_bill,
            commands::billing::billing_get_today_summary,
            commands::billing::billing_create_return,
            commands::billing::billing_list_returns,
            commands::customer::customer_search,
            commands::customer::customer_get,
            commands::customer::customer_create,
            commands::customer::customer_update,
            commands::customer::customer_get_history,
            commands::customer::customer_record_payment,
            commands::customer::doctor_list,
            commands::customer::doctor_create,
            commands::customer::doctor_update,
            commands::purchase::supplier_list,
            commands::purchase::supplier_create,
            commands::purchase::supplier_update,
            commands::purchase::purchase_list_bills,
            commands::purchase::purchase_create_bill,
            commands::purchase::purchase_get_bill,
            commands::purchase::purchase_add_batch_from_bill,
            commands::inventory::inventory_get_expiry_list,
            commands::inventory::inventory_get_low_stock,
            commands::inventory::inventory_adjust_stock,
            commands::inventory::inventory_get_stock,
            commands::inventory::inventory_physical_count,
            commands::printer::printer_print_bill,
            commands::printer::printer_test,
            commands::reports::reports_sales,
            commands::reports::reports_purchase,
            commands::reports::reports_stock,
            commands::reports::reports_gst,
            commands::reports::reports_profit_loss,
            commands::reports::reports_ca_package,
            commands::reports::reports_audit_log,
            commands::reports::reports_export_csv,
            commands::ai::ai_morning_briefing,
            commands::ai::ai_demand_forecast,
            commands::ai::ai_expiry_risks,
            commands::ai::ai_customer_segments,
            commands::ai::ai_abc_xyz,
            commands::ai::ai_po_suggestions,
            commands::ai::ai_anomalies,
            commands::ai::ai_ask_pharmacare,
            commands::ai::ai_compose_whatsapp,
            commands::ai::ai_ca_narration,
            commands::ai::ai_ca_checks,
            commands::barcode::barcode_generate,
            commands::barcode::barcode_generate_bulk,
            commands::backup::backup_create,
            commands::backup::backup_list,
            commands::backup::backup_restore,
            commands::network::network_get_local_ip,
            commands::network::network_start_server,
            commands::network::network_stop_server,
            commands::network::network_get_status,
            commands::network::network_check_interactions,
            commands::network::license_get_status,
            commands::network::license_activate,
            commands::network::sync_get_queue,
            commands::network::sync_push_to_supabase,
            // Sprint 7 — GST Compliance
            commands::gst::gst_get_gstr1,
            commands::gst::gst_export_gstr1_json,
            commands::gst::gst_get_gstr3b,
            commands::gst::gst_get_purchase_bills_for_recon,
            commands::gst::gst_reconcile_gstr2b,
            commands::gst::gst_generate_einvoice,
            commands::gst::gst_generate_ewaybill,
            // Sprint 7 — Compliance Registers
            commands::compliance::compliance_list_narcotic,
            commands::compliance::compliance_create_narcotic,
            commands::compliance::compliance_update_narcotic,
            commands::compliance::compliance_delete_narcotic,
            commands::compliance::compliance_list_prescription,
            commands::compliance::compliance_create_prescription,
            commands::compliance::compliance_update_prescription,
            commands::compliance::compliance_delete_prescription,
            commands::compliance::compliance_get_licence_alerts,
            commands::compliance::compliance_get_licence_settings,
            commands::compliance::compliance_save_licence_settings,
            commands::compliance::compliance_get_interaction_stats,
            commands::compliance::compliance_list_interactions,
            commands::compliance::compliance_create_interaction,
            commands::compliance::compliance_delete_interaction,
        ])
        .run(tauri::generate_context!())
        .expect("PharmaCare Pro failed to start");
}
