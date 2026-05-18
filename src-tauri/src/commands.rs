use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<String>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(update.version.to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

use crate::db;
use rusqlite::Connection;
use std::sync::Mutex;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Clip {
    pub id: String,
    pub content: String,
    pub content_type: String,
    pub created_at: String,
    pub pinned: bool,
    pub source_app: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[tauri::command]
pub fn get_clips(
    app: AppHandle,
    limit: Option<i64>,
    search: Option<String>,
) -> Result<Vec<Clip>, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    db::get_clips(&conn, limit.unwrap_or(50), search).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_clip(
    app: AppHandle,
    content: String,
    content_type: String,
    source_app: Option<String>,
) -> Result<Clip, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    db::add_clip(&conn, content, content_type, source_app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_clip(app: AppHandle, id: String) -> Result<(), String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    db::delete_clip(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_pin(app: AppHandle, id: String) -> Result<bool, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    db::toggle_pin(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(content: String) -> Result<(), String> {
    use clipboard_rs::{Clipboard, ClipboardContext};
    let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
    ctx.set_text(content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stats(app: AppHandle) -> Result<serde_json::Value, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    db::get_stats(&conn).map_err(|e| e.to_string())
}
