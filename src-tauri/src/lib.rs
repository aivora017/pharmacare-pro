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
            commands::gst::gst_bill_compliance,
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
            // Sprint 8 — Purchase Orders
            commands::purchase_orders::po_list,
            commands::purchase_orders::po_get,
            commands::purchase_orders::po_create,
            commands::purchase_orders::po_update_status,
            commands::purchase_orders::po_auto_generate,
            // Sprint 8 — Expenses
            commands::expenses::expense_list,
            commands::expenses::expense_create,
            commands::expenses::expense_update,
            commands::expenses::expense_delete,
            commands::expenses::expense_cash_book,
            commands::expenses::expense_summary,
            // Sprint 8 — Supplier Credit Notes
            commands::supplier_credit::supplier_credit_list,
            commands::supplier_credit::supplier_credit_create,
            commands::supplier_credit::supplier_credit_apply,
            // Sprint 8 — Reports + Bill Amendment
            commands::reports_sprint8::reports_dead_stock,
            commands::reports_sprint8::billing_create_amendment,
            commands::reports_sprint8::billing_get_amendments,
            // Sprint 9 — Schemes
            commands::schemes::scheme_list,
            commands::schemes::scheme_create,
            commands::schemes::scheme_update,
            commands::schemes::scheme_delete,
            commands::schemes::scheme_get_applicable,
            // Sprint 9 — Collections + Extended Dashboard
            commands::collections::collection_list_outstanding,
            commands::collections::collection_record,
            commands::collections::collection_history,
            commands::collections::dashboard_extended,
            // Sprint 10 — Onboarding + Business Profile
            commands::onboarding::onboarding_status,
            commands::onboarding::onboarding_save,
            commands::onboarding::business_profile_get,
            commands::onboarding::business_profile_save,
            commands::onboarding::gstin_verify,
            // Sprint 11 — P&L, Audit Log, Reorder, Prescription History, SMS
            commands::reports_sprint11::pl_report,
            commands::reports_sprint11::audit_log_list,
            commands::reports_sprint11::reorder_alerts,
            commands::reports_sprint11::prescription_history,
            commands::reports_sprint11::sms_settings_get,
            commands::sms::sms_send,
            commands::sms::sms_settings_save,
            // Tech Setup
            commands::tech::tech_auth,
            commands::tech::tech_setup_save,
            commands::tech::tech_get_config,
            commands::tech::tech_change_password,
        ])
        .run(tauri::generate_context!())
        .expect("PharmaCare Pro failed to start");
}
