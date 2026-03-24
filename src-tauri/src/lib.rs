use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, Runtime, WebviewUrl, WebviewWindowBuilder,
};

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

pub struct AppState {
    server_status: Arc<AtomicU8>,
    server_handle: Arc<tokio::sync::Mutex<Option<tauri_plugin_process::CommandChild>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            server_status: Arc::new(AtomicU8::new(ServerStatus::Stopped as u8)),
            server_handle: Arc::new(tokio::sync::Mutex::new(None)),
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
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Don't close the app when window is closed, just hide it
                println!("Window close requested - hiding window instead");
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| match event {
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

    // Get the path to the backend directory
    let mut backend_path = std::env::current_exe()?;
    backend_path.pop(); // Remove executable name
    backend_path.pop(); // Remove MacOS or similar
    backend_path.push("backend");
    backend_path.push("src");
    backend_path.push("server.js");

    // If running in development, use the backend directory relative to the project root
    let backend_path = if !backend_path.exists() {
        let mut dev_path = std::env::current_dir()?;
        dev_path.push("backend");
        dev_path.push("src");
        dev_path.push("server.js");
        dev_path
    } else {
        backend_path
    };

    log::info!("Starting backend server from: {:?}", backend_path);

    // Start the Node.js server
    let command = tauri_plugin_process::Command::new_sidecar("node")
        .or_else(|_| tauri_plugin_process::Command::new("node"))
        .map_err(|e| format!("Failed to create node command: {}", e))?
        .args(["backend/src/server.js"])
        .spawn()
        .map_err(|e| format!("Failed to start server: {}", e))?;

    // Store the handle and update status
    let handle = state.server_handle.clone();
    let status = state.server_status.clone();

    // Start a background task to monitor the server
    tokio::spawn(async move {
        // Give the server a moment to start
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // Check if we can connect to the server
        let mut attempts = 0;
        while attempts < 5 {
            match tokio::net::TcpStream::connect("127.0.0.1:59999").await {
                Ok(_) => {
                    status.store(ServerStatus::Running as u8, Ordering::Relaxed);
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

    *tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(async {
            handle.lock().await.insert(command);
            Ok::<(), Box<dyn std::error::Error>>(())
        })
    })?;

    Ok(())
}

fn setup_system_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let state = app.state::<AppState>();

    // Get the status for initial display
    let status = state.get_status();

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
        format!("● Stopped"),
        true,
        None::<&str>,
    )?;
    let status_starting = MenuItem::with_id(
        app,
        "status_starting",
        format!("● Starting..."),
        true,
        None::<&str>,
    )?;
    let status_running = MenuItem::with_id(
        app,
        "status_running",
        format!("● Running"),
        true,
        None::<&str>,
    )?;

    // Set initial status item
    match status {
        ServerStatus::Stopped => {
            status_stopped.set_selected(true)?;
        }
        ServerStatus::Starting => {
            status_starting.set_selected(true)?;
        }
        ServerStatus::Running => {
            status_running.set_selected(true)?;
        }
    }

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
        .menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event.id.as_str());
        })
        .on_tray_icon_event(|_tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
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
                    window.set_focus().unwrap();
                } else {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            } else {
                // Create the main window if it doesn't exist
                WebviewWindowBuilder::new(
                    app,
                    "main",
                    WebviewUrl::App("index.html".into()),
                )
                .title("Android TV Remote")
                .inner_size(800.0, 600.0)
                .resizable(true)
                .build()
                .unwrap();
            }
        }
        "web" => {
            if let Err(e) = app
                .plugin(tauri_plugin_shell::init())
                .unwrap()
                .shell()
                .open("https://tv.anwar.bd", None::<&str>)
            {
                log::error!("Failed to open web URL: {}", e);
            }
        }
        "about" => {
            // Show about dialog
            let _ = app.dialog().message(
                "Android TV Remote\n\nA desktop application for controlling Android TVs.\n\nVersion: 0.1.0"
            ).show(Some(app.get_webview_window("main").or_else(|| app.webview_windows().values().next())));
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}
