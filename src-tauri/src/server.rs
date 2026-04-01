//! Embedded Axum HTTP server for Multi-PC LAN mode.
//! When enabled, other PCs on the LAN can connect to this instance
//! and use its database without running their own DB.

use axum::{
    extract::{Json, State},
    http::Method,
    response::IntoResponse,
    routing::post,
    Router,
};
use tower_http::cors::{Any, CorsLayer};

pub const LAN_PORT: u16 = 4200;

#[derive(Clone)]
pub struct ServerState {
    pub db_path: String,
}

/// Start the LAN API server. Spawns a background tokio task.
/// Returns the bound address string.
pub async fn start_lan_server(db_path: String) -> Result<String, String> {
    let addr = format!("0.0.0.0:{}", LAN_PORT);
    let state = ServerState { db_path };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::POST, Method::GET, Method::OPTIONS])
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/health",                  axum::routing::get(health_handler))
        .route("/api/medicine/search",         post(medicine_search))
        .route("/api/medicine/get",            post(medicine_get))
        .route("/api/medicine/batches",        post(medicine_batches))
        .route("/api/medicine/barcode",        post(medicine_barcode))
        .route("/api/billing/create",          post(billing_create))
        .route("/api/billing/list",            post(billing_list))
        .route("/api/billing/get",             post(billing_get))
        .route("/api/billing/hold",            post(billing_hold))
        .route("/api/billing/held",            post(billing_held))
        .route("/api/billing/today",           post(billing_today))
        .route("/api/customer/search",         post(customer_search))
        .route("/api/dashboard/summary",       post(dashboard_summary))
        .with_state(state)
        .layer(cors);

    let listener = tokio::net::TcpListener::bind(&addr).await
        .map_err(|e| format!("Could not bind to port {}: {}", LAN_PORT, e))?;
    let local_addr = listener.local_addr().map_err(|e| e.to_string())?;

    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    Ok(local_addr.to_string())
}

async fn health_handler() -> impl IntoResponse {
    axum::Json(serde_json::json!({ "status": "ok", "app": "PharmaCare Pro" }))
}

fn open_db(db_path: &str) -> Result<crate::db::Database, String> {
    crate::db::Database::open_at(db_path).map_err(|e| e.to_string())
}

async fn medicine_search(State(s): State<ServerState>, Json(b): Json<serde_json::Value>) -> impl IntoResponse {
    let q = b["query"].as_str().unwrap_or("").to_string();
    let in_stock = b["in_stock_only"].as_bool().unwrap_or(false);
    let cat = b["category_id"].as_i64();
    match open_db(&s.db_path).and_then(|db| db.medicine_search(&q, in_stock, cat).map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn medicine_get(State(s): State<ServerState>, Json(b): Json<serde_json::Value>) -> impl IntoResponse {
    let id = b["id"].as_i64().unwrap_or(0);
    match open_db(&s.db_path).and_then(|db| db.medicine_get(id).map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn medicine_batches(State(s): State<ServerState>, Json(b): Json<serde_json::Value>) -> impl IntoResponse {
    let id = b["medicine_id"].as_i64().unwrap_or(0);
    match open_db(&s.db_path).and_then(|db| db.medicine_list_batches(id).map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn medicine_barcode(State(s): State<ServerState>, Json(b): Json<serde_json::Value>) -> impl IntoResponse {
    let bc = b["barcode"].as_str().unwrap_or("").to_string();
    match open_db(&s.db_path).and_then(|db| db.medicine_get_by_barcode(&bc).map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn billing_create(State(s): State<ServerState>, Json(b): Json<serde_json::Value>) -> impl IntoResponse {
    match open_db(&s.db_path).and_then(|db| db.create_bill(&b).map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn billing_list(State(s): State<ServerState>, Json(b): Json<serde_json::Value>) -> impl IntoResponse {
    match open_db(&s.db_path).and_then(|db| db.list_bills(&b).map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn billing_get(State(s): State<ServerState>, Json(b): Json<serde_json::Value>) -> impl IntoResponse {
    let id = b["bill_id"].as_i64().unwrap_or(0);
    match open_db(&s.db_path).and_then(|db| db.get_bill(id).map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn billing_hold(State(s): State<ServerState>, Json(b): Json<serde_json::Value>) -> impl IntoResponse {
    match open_db(&s.db_path).and_then(|db| db.hold_bill(&b).map_err(|e| e.to_string())) {
        Ok(_)  => axum::Json(serde_json::json!({"ok":true})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn billing_held(State(s): State<ServerState>, Json(_b): Json<serde_json::Value>) -> impl IntoResponse {
    match open_db(&s.db_path).and_then(|db| db.get_held_bills().map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn billing_today(State(s): State<ServerState>, Json(_b): Json<serde_json::Value>) -> impl IntoResponse {
    match open_db(&s.db_path).and_then(|db| db.today_summary().map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn customer_search(State(s): State<ServerState>, Json(b): Json<serde_json::Value>) -> impl IntoResponse {
    let q = b["query"].as_str().unwrap_or("").to_string();
    match open_db(&s.db_path).and_then(|db| db.customer_search(&q).map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
async fn dashboard_summary(State(s): State<ServerState>, Json(_b): Json<serde_json::Value>) -> impl IntoResponse {
    match open_db(&s.db_path).and_then(|db| db.dashboard_summary().map_err(|e| e.to_string())) {
        Ok(r)  => axum::Json(serde_json::json!({"ok":true,"data":r})),
        Err(e) => axum::Json(serde_json::json!({"ok":false,"error":e})),
    }
}
