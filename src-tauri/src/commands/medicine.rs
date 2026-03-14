use crate::commands::permission::require_permission;
use crate::{error::AppError, AppState};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize)]
pub struct MedicineDto {
    pub id: i64,
    pub name: String,
    pub generic_name: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub schedule: String,
    pub default_gst_rate: f64,
    pub reorder_level: i64,
    pub total_stock: i64,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct MedicineDetailDto {
    pub id: i64,
    pub name: String,
    pub generic_name: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub schedule: String,
    pub default_gst_rate: f64,
    pub reorder_level: i64,
    pub reorder_quantity: i64,
    pub total_stock: i64,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct BatchDto {
    pub id: i64,
    pub medicine_id: i64,
    pub batch_number: String,
    pub barcode: Option<String>,
    pub expiry_date: String,
    pub purchase_price: f64,
    pub selling_price: f64,
    pub quantity_in: i64,
    pub quantity_sold: i64,
    pub quantity_adjusted: i64,
    pub quantity_on_hand: i64,
    pub rack_location: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct CategoryDto {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct MedicineCreateInput {
    pub name: String,
    pub generic_name: String,
    pub category_id: Option<i64>,
    pub schedule: String,
    pub default_gst_rate: f64,
    pub reorder_level: i64,
    pub reorder_quantity: i64,
    pub created_by: i64,
}

#[derive(Debug, Deserialize)]
pub struct MedicineUpdateInput {
    pub name: String,
    pub generic_name: String,
    pub category_id: Option<i64>,
    pub schedule: String,
    pub default_gst_rate: f64,
    pub reorder_level: i64,
    pub reorder_quantity: i64,
    pub updated_by: i64,
}

#[derive(Debug, Deserialize)]
pub struct MedicineBatchCreateInput {
    pub medicine_id: i64,
    pub batch_number: String,
    pub expiry_date: String,
    pub purchase_price: f64,
    pub selling_price: f64,
    pub quantity_in: i64,
    pub rack_location: Option<String>,
    pub created_by: i64,
}

#[derive(Debug, Deserialize)]
pub struct MedicineBatchUpdateInput {
    pub expiry_date: String,
    pub purchase_price: f64,
    pub selling_price: f64,
    pub rack_location: Option<String>,
    pub updated_by: i64,
}

#[tauri::command]
pub async fn medicine_search(
    state: State<'_, AppState>,
    query: Option<String>,
    category_id: Option<i64>,
    in_stock_only: Option<bool>,
    sort: Option<String>,
) -> Result<Vec<MedicineDto>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.search_medicines(
        query.as_deref(),
        category_id,
        in_stock_only.unwrap_or(false),
        sort.as_deref(),
    )
}

#[tauri::command]
pub async fn medicine_list_categories(
    state: State<'_, AppState>,
) -> Result<Vec<CategoryDto>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.list_medicine_categories()
}

#[tauri::command]
pub async fn medicine_create(
    state: State<'_, AppState>,
    input: MedicineCreateInput,
) -> Result<i64, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, input.created_by, "medicine")?;

    if input.name.trim().is_empty() || input.generic_name.trim().is_empty() {
        return Err(AppError::Validation(
            "Medicine name and generic name are required.".to_string(),
        ));
    }

    let allowed = ["OTC", "H", "H1", "X", "Narcotic"];
    if !allowed.contains(&input.schedule.as_str()) {
        return Err(AppError::Validation("Invalid schedule type.".to_string()));
    }

    if !(0.0..=28.0).contains(&input.default_gst_rate) {
        return Err(AppError::Validation(
            "GST rate must be between 0 and 28.".to_string(),
        ));
    }

    if input.reorder_level < 0 || input.reorder_quantity < 1 {
        return Err(AppError::Validation(
            "Reorder level must be >= 0 and reorder quantity must be >= 1.".to_string(),
        ));
    }

    let medicine_id = db.create_medicine(
        &input.name,
        &input.generic_name,
        input.category_id,
        &input.schedule,
        input.default_gst_rate,
        input.reorder_level,
        input.reorder_quantity,
        input.created_by,
    )?;

    db.write_audit_log(
        "MEDICINE_CREATED",
        "medicine",
        &medicine_id.to_string(),
        None,
        Some(
            &serde_json::json!({
                "name": input.name,
                "generic_name": input.generic_name,
                "category_id": input.category_id,
                "schedule": input.schedule,
                "default_gst_rate": input.default_gst_rate,
                "reorder_level": input.reorder_level,
                "reorder_quantity": input.reorder_quantity,
            })
            .to_string(),
        ),
        "System",
    )?;

    Ok(medicine_id)
}

#[tauri::command]
pub async fn medicine_get(
    state: State<'_, AppState>,
    id: i64,
) -> Result<MedicineDetailDto, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.get_medicine(id)
}

#[tauri::command]
pub async fn medicine_update(
    state: State<'_, AppState>,
    id: i64,
    input: MedicineUpdateInput,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, input.updated_by, "medicine")?;

    if input.name.trim().is_empty() || input.generic_name.trim().is_empty() {
        return Err(AppError::Validation(
            "Medicine name and generic name are required.".to_string(),
        ));
    }

    let allowed = ["OTC", "H", "H1", "X", "Narcotic"];
    if !allowed.contains(&input.schedule.as_str()) {
        return Err(AppError::Validation("Invalid schedule type.".to_string()));
    }

    if !(0.0..=28.0).contains(&input.default_gst_rate) {
        return Err(AppError::Validation(
            "GST rate must be between 0 and 28.".to_string(),
        ));
    }

    if input.reorder_level < 0 || input.reorder_quantity < 1 {
        return Err(AppError::Validation(
            "Reorder level must be >= 0 and reorder quantity must be >= 1.".to_string(),
        ));
    }

    let before = db.get_medicine(id)?;
    db.update_medicine(
        id,
        &input.name,
        &input.generic_name,
        input.category_id,
        &input.schedule,
        input.default_gst_rate,
        input.reorder_level,
        input.reorder_quantity,
    )?;

    db.write_audit_log(
        "MEDICINE_UPDATED",
        "medicine",
        &id.to_string(),
        Some(
            &serde_json::json!({
                "name": before.name,
                "generic_name": before.generic_name,
                "category_id": before.category_id,
                "schedule": before.schedule,
                "default_gst_rate": before.default_gst_rate,
                "reorder_level": before.reorder_level,
                "reorder_quantity": before.reorder_quantity,
            })
            .to_string(),
        ),
        Some(
            &serde_json::json!({
                "name": input.name,
                "generic_name": input.generic_name,
                "category_id": input.category_id,
                "schedule": input.schedule,
                "default_gst_rate": input.default_gst_rate,
                "reorder_level": input.reorder_level,
                "reorder_quantity": input.reorder_quantity,
            })
            .to_string(),
        ),
        &format!("user:{}", input.updated_by),
    )?;

    Ok(())
}

#[tauri::command]
pub async fn medicine_list_batches(
    state: State<'_, AppState>,
    medicine_id: i64,
) -> Result<Vec<BatchDto>, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    db.list_medicine_batches(medicine_id)
}

#[tauri::command]
pub async fn medicine_create_batch(
    state: State<'_, AppState>,
    input: MedicineBatchCreateInput,
) -> Result<i64, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, input.created_by, "medicine")?;

    if input.batch_number.trim().is_empty() || input.expiry_date.trim().is_empty() {
        return Err(AppError::Validation(
            "Batch number and expiry date are required.".to_string(),
        ));
    }

    if input.purchase_price < 0.0 || input.selling_price < 0.0 {
        return Err(AppError::Validation(
            "Purchase price and selling price must be non-negative.".to_string(),
        ));
    }

    if input.quantity_in < 1 {
        return Err(AppError::Validation(
            "Batch quantity must be at least 1.".to_string(),
        ));
    }

    if let Some(rack_location) = input.rack_location.as_deref() {
        let trimmed = rack_location.trim();
        if !trimmed.is_empty() && !is_valid_rack_location(trimmed) {
            return Err(AppError::Validation(
                "Rack location must be in A-1-1 format.".to_string(),
            ));
        }
    }

    let batch_id = db.create_medicine_batch(
        input.medicine_id,
        &input.batch_number,
        &input.expiry_date,
        input.purchase_price,
        input.selling_price,
        input.quantity_in,
        input.rack_location.as_deref(),
    )?;

    db.write_audit_log(
        "BATCH_CREATED",
        "medicine_batch",
        &batch_id.to_string(),
        None,
        Some(
            &serde_json::json!({
                "medicine_id": input.medicine_id,
                "batch_number": input.batch_number,
                "expiry_date": input.expiry_date,
                "purchase_price": input.purchase_price,
                "selling_price": input.selling_price,
                "quantity_in": input.quantity_in,
                "rack_location": input.rack_location,
            })
            .to_string(),
        ),
        &format!("user:{}", input.created_by),
    )?;

    Ok(batch_id)
}

#[tauri::command]
pub async fn medicine_delete(
    state: State<'_, AppState>,
    id: i64,
    user_id: i64,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, user_id, "medicine")?;
    db.delete_medicine(id)?;
    db.write_audit_log(
        "MEDICINE_DELETED",
        "medicine",
        &id.to_string(),
        None,
        None,
        &format!("user:{}", user_id),
    )?;
    Ok(())
}

#[tauri::command]
pub async fn medicine_get_batch_by_barcode(
    state: State<'_, AppState>,
    barcode: String,
) -> Result<BatchDto, AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    if barcode.trim().is_empty() {
        return Err(AppError::Validation("Barcode is required.".to_string()));
    }
    db.get_batch_by_barcode(&barcode)
}

#[tauri::command]
pub async fn medicine_update_batch(
    state: State<'_, AppState>,
    batch_id: i64,
    input: MedicineBatchUpdateInput,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|_| AppError::DatabaseLock)?;
    require_permission(&db, input.updated_by, "medicine")?;

    if input.expiry_date.trim().is_empty() {
        return Err(AppError::Validation("Expiry date is required.".to_string()));
    }

    if input.purchase_price < 0.0 || input.selling_price < 0.0 {
        return Err(AppError::Validation(
            "Purchase price and selling price must be non-negative.".to_string(),
        ));
    }

    if let Some(rack_location) = input.rack_location.as_deref() {
        let trimmed = rack_location.trim();
        if !trimmed.is_empty() && !is_valid_rack_location(trimmed) {
            return Err(AppError::Validation(
                "Rack location must be in A-1-1 format.".to_string(),
            ));
        }
    }

    db.update_medicine_batch(
        batch_id,
        &input.expiry_date,
        input.purchase_price,
        input.selling_price,
        input.rack_location.as_deref(),
    )?;

    db.write_audit_log(
        "BATCH_UPDATED",
        "medicine_batch",
        &batch_id.to_string(),
        None,
        Some(
            &serde_json::json!({
                "expiry_date": input.expiry_date,
                "purchase_price": input.purchase_price,
                "selling_price": input.selling_price,
                "rack_location": input.rack_location,
            })
            .to_string(),
        ),
        &format!("user:{}", input.updated_by),
    )?;

    Ok(())
}

fn is_valid_rack_location(value: &str) -> bool {
    let mut parts = value.split('-');
    let section = match parts.next() {
        Some(v) if v.len() == 1 && v.chars().all(|c| c.is_ascii_alphabetic()) => v,
        _ => return false,
    };

    if section.is_empty() {
        return false;
    }

    let row = parts.next();
    let column = parts.next();

    if parts.next().is_some() {
        return false;
    }

    let row_ok = row
        .map(|v| !v.is_empty() && v.chars().all(|c| c.is_ascii_digit()))
        .unwrap_or(false);
    let col_ok = column
        .map(|v| !v.is_empty() && v.chars().all(|c| c.is_ascii_digit()))
        .unwrap_or(false);

    row_ok && col_ok
}
