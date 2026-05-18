use crate::db::DbState;
use clipboard_rs::{Clipboard, ClipboardContext, ClipboardWatcher, ClipboardWatcherContext, ClipboardHandler};
use tauri::{AppHandle, Manager, Emitter};

struct ClipWatchHandler {
    app: AppHandle,
}

impl ClipboardHandler for ClipWatchHandler {
    fn on_clipboard_change(&mut self) {
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

        if let Some(state) = self.app.try_state::<DbState>() {
            if let Ok(conn) = state.0.lock() {
                if crate::db::is_duplicate(&conn, &trimmed).unwrap_or(false) {
                    return;
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
                    let _ = self.app.emit("clip-added", &clip);
                }
            }
        }
    }
}

pub async fn watch(app: AppHandle) {
    let mut watcher = match ClipboardWatcherContext::new() {
        Ok(w) => w,
        Err(_) => return,
    };

    watcher.add_handler(ClipWatchHandler { app });

    let _stop = watcher.start_watch();
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
    }
}
