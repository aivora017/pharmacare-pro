use crate::AppState;
use std::time::Duration;
use tauri::Manager;
use tokio::time::sleep;

pub fn start_background_tasks(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            if let Some(state) = app.try_state::<AppState>() {
                if let Ok(db) = state.db.lock() {
                    let _ = db.email_fetch_invoices();
                }
            }

            sleep(Duration::from_secs(20 * 60)).await;
        }
    });
}
