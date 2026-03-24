use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;
use std::process;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Emitter, Manager, RunEvent, Runtime, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_shell::ShellExt;

// Server status: 0 = stopped (red), 1 = starting (yellow), 2 = running (green)
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ServerStatus {
    Stopped = 0,
    Starting = 1,
    Running = 2,
}

impl From<u8> for ServerStatus {
    fn from(value: u8) -> Self {
        match value {
            0 => ServerStatus::Stopped,
            1 => ServerStatus::Starting,
            2 => ServerStatus::Running,
            _ => ServerStatus::Stopped,
        }
    }
}

impl ServerStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            ServerStatus::Stopped => "Stopped",
            ServerStatus::Starting => "Starting...",
            ServerStatus::Running => "Running",
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    server_status: Arc<AtomicU8>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            server_status: Arc::new(AtomicU8::new(ServerStatus::Stopped as u8)),
        }
    }

    pub fn get_status(&self) -> ServerStatus {
        self.server_status.load(Ordering::Relaxed).into()
    }

    pub fn set_status(&self, status: ServerStatus) {
        self.server_status.store(status as u8, Ordering::Relaxed);
    }
}

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

            let state = AppState::new();
            app.manage(state.clone());

            // Start the backend server
            start_backend_server(app.handle())?;

            // Setup system tray
            setup_system_tray(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Prevent the window from closing and hide it instead
                api.prevent_close();
                println!("Window close requested - hiding window instead");
                if let Err(e) = window.hide() {
                    log::error!("Failed to hide window: {}", e);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| match event {
            RunEvent::ExitRequested { .. } => {
                // Stop the server when app is exiting
                println!("Exit requested - stopping server");
            }
            RunEvent::Exit => {
                println!("App exiting");
            }
            _ => {}
        });
}

fn start_backend_server<R: Runtime>(app_handle: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let state = app_handle.state::<AppState>();
    state.set_status(ServerStatus::Starting);

    log::info!("Starting backend server...");

    // Start a background task to monitor the server
    tauri::async_runtime::spawn(async move {
        // Give the server a moment to start
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        // Check if we can connect to the server
        let mut attempts = 0;
        while attempts < 5 {
            match tokio::net::TcpStream::connect("127.0.0.1:59999").await {
                Ok(_) => {
                    log::info!("Backend server is running");
                    return;
                }
                Err(_) => {
                    attempts += 1;
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                }
            }
        }

        log::warn!("Backend server may not be responding correctly");
    });

    Ok(())
}

fn setup_system_tray<R: Runtime>(app: &App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<AppState>();

    // Get the status for initial display
    let _status = state.get_status();

    // Create menu items
    let open_item = MenuItem::with_id(app, "open", "Open Remote", true, None::<&str>)?;
    let web_item = MenuItem::with_id(app, "web", "Go to Web", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let about_item = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    // Create status submenu with colored dots
    let status_stopped = MenuItem::with_id(
        app,
        "status_stopped",
        "● Stopped",
        true,
        None::<&str>,
    )?;
    let status_starting = MenuItem::with_id(
        app,
        "status_starting",
        "● Starting...",
        true,
        None::<&str>,
    )?;
    let status_running = MenuItem::with_id(
        app,
        "status_running",
        "● Running",
        true,
        None::<&str>,
    )?;

    // Set initial status item (we use the icon color to indicate status)
    // The menu items are created with the appropriate dot color

    let status_menu = Submenu::with_items(
        app,
        "Status",
        true,
        &[&status_stopped, &status_starting, &status_running],
    )?;

    let menu = Menu::with_items(app, &[&status_menu, &open_item, &web_item, &separator, &about_item, &quit_item])?;

    // Build tray icon
    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            let event_id = event.id().0.clone();
            handle_menu_event(app, event_id.as_str());
        })
        .on_tray_icon_event(|_tray, event| {
            if let TrayIconEvent::Click {
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                println!("Tray icon clicked");
            }
        })
        .build(app)?;

    Ok(())
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event_id: &str) {
    match event_id {
        "open" => {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.set_focus();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            } else {
                // Create the main window if it doesn't exist
                let _ = WebviewWindowBuilder::new(
                    app,
                    "main",
                    WebviewUrl::App("index.html".into()),
                )
                .title("Android TV Remote")
                .inner_size(400.0, 700.0)
                .resizable(true)
                .center()
                .build();
            }
        }
        "web" => {
            let _ = app.shell().open("https://tv.anwar.bd", None);
        }
        "about" => {
            // Show about dialog using emit to frontend
            let _ = app.emit("show-about", "Android TV Remote\n\nA desktop application for controlling Android TVs.\n\nVersion: 0.1.0");
        }
        "quit" => {
            process::exit(0);
        }
        _ => {}
    }
}
