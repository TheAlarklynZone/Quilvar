mod clipboard;
mod commands;
mod db;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
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

            // Build tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Quilvar", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Build tray icon
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Quilvar \u2014 Store your clips. Paste with precision.")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Left-click tray icon to toggle window
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.unminimize();
                            }
                        }
                    }
                })
                .build(app)?;

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
        // Hide to tray instead of closing — applies to EVERY window close/minimize
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                // Only intercept the main window; let quickdraw just hide
                if window.label() == "main" || window.label() == "quickdraw" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            WindowEvent::Minimized(_) => {
                if window.label() == "main" {
                    let _ = window.hide();
                }
            }
            _ => {}
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
