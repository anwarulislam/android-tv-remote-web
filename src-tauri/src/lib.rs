use tauri::{App, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::image::Image;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build())?;
            }

            println!("Setting up system tray...");
            setup_system_tray(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                println!("Window close requested - hiding window instead");
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                println!("Exit requested");
                app_handle.exit(0);
            }
        });
}

fn setup_system_tray<R: tauri::Runtime>(app: &App<R>) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::tray::TrayIconBuilder;
    use tauri::menu::{Menu, MenuItem};

    // Create menu items
    let open_item = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    let mut tray_builder = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Android TV Remote");

    // Try to load icon from resources
    let icon = load_icon(app);
    if let Some(img) = icon {
        tray_builder = tray_builder.icon(img);
        println!("Icon loaded for tray");
    } else {
        println!("No icon available for tray");
    }

    let _tray = tray_builder
        .on_menu_event(|app, event| {
            let id = event.id().0.as_str();
            match id {
                "open" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    } else {
                        let _ = WebviewWindowBuilder::new(
                            app,
                            "main",
                            WebviewUrl::App("index.html".into()),
                        )
                        .title("Android TV Remote")
                        .inner_size(400.0, 700.0)
                        .center()
                        .build();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    println!("System tray setup complete");
    Ok(())
}

fn load_icon<R: tauri::Runtime>(app: &App<R>) -> Option<Image> {
    use std::io::Read;

    // Try to load icon from bundled resources
    let icon_paths = vec![
        "icons/32x32.png",
        "icons/icon.png",
    ];

    for path in icon_paths {
        if let Ok(resolved_path) = app.path().resolve(path, tauri::path::BaseDirectory::Resource) {
            if resolved_path.exists() {
                println!("Loading icon from: {:?}", resolved_path);

                // Read PNG file
                if let Ok(mut file) = std::fs::File::open(&resolved_path) {
                    let mut buffer = Vec::new();
                    if file.read_to_end(&mut buffer).is_ok() {
                        // Use a simple approach - just use the bytes directly
                        // The tray icon should accept PNG bytes
                        return Some(Image::new_owned(buffer, 32, 32));
                    }
                }
            }
        }
    }

    // Fallback to default window icon
    if let Some(default_icon) = app.default_window_icon() {
        return Some(default_icon.clone());
    }

    None
}
