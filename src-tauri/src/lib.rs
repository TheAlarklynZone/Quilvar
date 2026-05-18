mod clipboard;
mod commands;
mod db;

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            // Initialize database
            db::init(app.handle())?;

            // Register global shortcut: Shift + Alt + V
            let handle = app.handle().clone();
            app.global_shortcut().on_shortcut(
                Shortcut::new(
                    Some(Modifiers::SHIFT | Modifiers::ALT),
                    Code::KeyV,
                ),
                move |_app, _shortcut, _event| {
                    if let Some(window) = handle.get_webview_window("quickdraw") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                },
            )?;

            // Start clipboard watcher
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                clipboard::watch(app_handle).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_clips,
            commands::add_clip,
            commands::delete_clip,
            commands::toggle_pin,
            commands::copy_to_clipboard,
            commands::get_stats,
            commands::check_for_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Quilvar");
}
