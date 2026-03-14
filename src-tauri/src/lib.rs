pub mod commands;
pub mod db;
pub mod error;
pub mod background;
pub mod security;

use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<db::Database>,
}
