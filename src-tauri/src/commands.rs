use crate::db::{self, Clip, DbState};
use tauri::State;
uuid::uuid;

fn word_count(s: &str) -> i64 {
    s.split_whitespace().count() as i64
}

#[tauri::command]
pub fn get_clips(state: State<DbState>) -> Result<Vec<Clip>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::get_all_clips(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_clip(content: String, state: State<DbState>) -> Result<Clip, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // Duplicate check — ignore if already exists
    if db::is_duplicate(&conn, &content).map_err(|e| e.to_string())? {
        return Err("duplicate".to_string());
    }

    let clip = Clip {
        id:         uuid::Uuid::new_v4().to_string(),
        content:    content.clone(),
        timestamp:  chrono::Utc::now().timestamp_millis(),
        pinned:     false,
        pin_label:  None,
        quiver_id:  None,
        word_count: word_count(&content),
        char_count: content.len() as i64,
    };

    db::insert_clip(&conn, &clip).map_err(|e| e.to_string())?;
    Ok(clip)
}

#[tauri::command]
pub fn delete_clip(id: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::delete_clip_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_pin(id: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    // Get current pin status
    let clips = db::get_all_clips(&conn).map_err(|e| e.to_string())?;
    let current = clips.iter().find(|c| c.id == id)
        .ok_or("clip not found")?;
    db::set_pin(&conn, &id, !current.pinned).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(content: String) -> Result<(), String> {
    use clipboard_rs::{Clipboard, ClipboardContext};
    let ctx = ClipboardContext::new().map_err(|e| e.to_string())?;
    ctx.set_text(content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stats(state: State<DbState>) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let clips = db::get_all_clips(&conn).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "total": clips.len(),
        "pinned": clips.iter().filter(|c| c.pinned).count(),
    }))
}
