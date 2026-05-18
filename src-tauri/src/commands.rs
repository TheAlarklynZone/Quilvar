use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use crate::db::{self, DbState, Clip};
use tauri::Manager;

#[tauri::command]
pub async fn check_for_update(app: AppHandle) -> Result<Option<String>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => Ok(Some(update.version.to_string())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_clips(
    app: AppHandle,
    _limit: Option<i64>,
    _search: Option<String>,
) -> Result<Vec<Clip>, String> {
    let state = app.state::<DbState>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_all_clips(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_clip(
    app: AppHandle,
    content: String,
    _content_type: Option<String>,
    _source_app: Option<String>,
) -> Result<Clip, String> {
    let state = app.state::<DbState>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Ignore duplicates
    if db::is_duplicate(&conn, &content).unwrap_or(false) {
        // Return the existing top clip instead
        let clips = db::get_all_clips(&conn).map_err(|e| e.to_string())?;
        if let Some(c) = clips.into_iter().find(|c| c.content == content) {
            return Ok(c);
        }
    }

    let trimmed = content.trim().to_string();
    let clip = Clip {
        id:         uuid::Uuid::new_v4().to_string(),
        content:    trimmed.clone(),
        timestamp:  chrono::Utc::now().timestamp_millis(),
        pinned:     false,
        pin_label:  None,
        quiver_id:  None,
        word_count: trimmed.split_whitespace().count() as i64,
        char_count: trimmed.len() as i64,
    };

    db::insert_clip(&conn, &clip).map_err(|e| e.to_string())?;
    Ok(clip)
}

#[tauri::command]
pub fn delete_clip(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<DbState>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_clip_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_pin(app: AppHandle, id: String) -> Result<bool, String> {
    let state = app.state::<DbState>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Get current pin state then flip it
    let clips = db::get_all_clips(&conn).map_err(|e| e.to_string())?;
    let current = clips.iter().find(|c| c.id == id).map(|c| c.pinned).unwrap_or(false);
    let new_state = !current;
    db::set_pin(&conn, &id, new_state).map_err(|e| e.to_string())?;
    Ok(new_state)
}

#[tauri::command]
pub fn copy_to_clipboard(content: String) -> Result<(), String> {
    use clipboard_rs::{Clipboard, ClipboardContext};
    let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
    ctx.set_text(content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stats(app: AppHandle) -> Result<serde_json::Value, String> {
    let state = app.state::<DbState>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let clips = db::get_all_clips(&conn).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "total": clips.len(),
        "pinned": clips.iter().filter(|c| c.pinned).count(),
    }))
}
