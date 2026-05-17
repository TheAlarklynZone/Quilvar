use crate::db::{DbState};
use clipboard_rs::{Clipboard, ClipboardContext, ClipboardWatcher, ClipboardWatcherContext};
use tauri::{AppHandle, Manager, Emitter};

pub async fn watch(app: AppHandle) {
    let app_for_cb = app.clone();

    let mut watcher = ClipboardWatcherContext::new().unwrap();

    watcher.add_handler(clipboard_rs::CallbackFn(Box::new(move || {
        let ctx = match ClipboardContext::new() {
            Ok(c) => c,
            Err(_) => return,
        };

        let text = match ctx.get_text() {
            Ok(t) => t,
            Err(_) => return,
        };

        let trimmed = text.trim().to_string();
        if trimmed.is_empty() { return; }

        // Check for duplicate before saving
        if let Some(state) = app_for_cb.try_state::<DbState>() {
            if let Ok(conn) = state.0.lock() {
                if crate::db::is_duplicate(&conn, &trimmed).unwrap_or(false) {
                    return; // Ignore duplicates silently
                }

                let clip = crate::db::Clip {
                    id:         uuid::Uuid::new_v4().to_string(),
                    content:    trimmed.clone(),
                    timestamp:  chrono::Utc::now().timestamp_millis(),
                    pinned:     false,
                    pin_label:  None,
                    quiver_id:  None,
                    word_count: trimmed.split_whitespace().count() as i64,
                    char_count: trimmed.len() as i64,
                };

                if crate::db::insert_clip(&conn, &clip).is_ok() {
                    // Notify the frontend that a new clip was added
                    let _ = app_for_cb.emit("clip-added", &clip);
                }
            }
        }
    })));

    let _stop = watcher.start_watch();
    // Keep watcher alive indefinitely
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
    }
}
