use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::process;
use tauri::{App, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::image::Image;

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
    backend_process: Arc<Mutex<Option<process::Child>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            server_status: Arc::new(AtomicU8::new(ServerStatus::Stopped as u8)),
            backend_process: Arc::new(Mutex::new(None)),
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

            println!("Setting up system tray...");
            setup_system_tray(app)?;

            // Start the backend server - don't fail if it doesn't start
            let _ = start_backend_server(app.handle());

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
                println!("Exit requested - stopping server");
                stop_backend_server(app_handle);
            }
        });
}

fn stop_backend_server<R: tauri::Runtime>(app_handle: &AppHandle<R>) {
    let state = app_handle.state::<AppState>();
    let mut process_guard = state.backend_process.lock().unwrap();

    if let Some(mut child) = process_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
        println!("Backend server stopped");
    }
}

fn start_backend_server<R: tauri::Runtime>(app_handle: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let state = app_handle.state::<AppState>();
    state.set_status(ServerStatus::Starting);

    println!("Starting backend server...");

    // Find Node.js executable
    let node_exe = find_node_executable();
    let node_path = match node_exe {
        Some(path) => {
            println!("Found Node.js at: {:?}", path);
            path
        }
        None => {
            println!("Node.js not found. App will run without backend server.");
            println!("Please install Node.js from https://nodejs.org/");
            return Ok(());
        }
    };

    // Determine the backend path based on the build mode
    let backend_path = if cfg!(debug_assertions) {
        // Development mode - use the backend from the project root
        std::path::PathBuf::from("../backend")
    } else {
        // Release mode - use the bundled backend from resources
        let resource_path = app_handle.path().resource_dir()?;
        // Resources are bundled in _up_ directory
        let backend = resource_path.join("_up_").join("backend");

        println!("Resource path: {:?}", resource_path);
        println!("Backend path: {:?}", backend);

        if !backend.exists() {
            println!("Backend not found at: {:?}", backend);
            println!("App will run without backend server");
            return Ok(());
        }

        backend
    };

    println!("Backend path: {:?}", backend_path);

    // Check if backend exists
    if !backend_path.exists() {
        println!("Backend directory not found at: {:?}", backend_path);
        if !cfg!(debug_assertions) {
            println!("App will run without backend server");
            return Ok(());
        }
        return Err("Backend directory not found".into());
    }

    // Spawn the backend server as a sidecar process
    let server_script = backend_path.join("src/server.js");
    println!("Server script: {:?}", server_script);

    let child = process::Command::new(&node_path)
        .arg(&server_script)
        .current_dir(&backend_path)
        .spawn()
        .map_err(|e| {
            println!("Failed to start backend server: {}", e);
            e
        })?;

    // Store the child process for later cleanup
    {
        let mut process_guard = state.backend_process.lock().unwrap();
        *process_guard = Some(child);
    }

    println!("Backend server process spawned");

    // Spawn a separate thread to wait for the server to start
    let state_clone = (*state).clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(1));

        let mut attempts = 0;
        while attempts < 10 {
            match std::net::TcpStream::connect("127.0.0.1:59999") {
                Ok(_) => {
                    println!("Backend server is running on port 59999");
                    state_clone.set_status(ServerStatus::Running);
                    return;
                }
                Err(_) => {
                    attempts += 1;
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
            }
        }

        println!("Backend server may not be responding correctly after {} attempts", attempts);
        state_clone.set_status(ServerStatus::Stopped);
    });

    Ok(())
}

// Find Node.js executable in common locations
fn find_node_executable() -> Option<std::path::PathBuf> {
    use std::env;

    // First try PATH (works in dev mode)
    if let Ok(path_var) = env::var("PATH") {
        for path in env::split_paths(&path_var) {
            let node_path = path.join("node");
            if node_path.exists() {
                return Some(node_path);
            }
        }
    }

    // Common Node.js installation paths on macOS
    let common_paths = vec![
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
        "/home/linuxbrew/.linuxbrew/bin/node",
        "/usr/bin/node",
    ];

    // Check common paths
    for path in common_paths {
        let node_path = std::path::PathBuf::from(path);
        if node_path.exists() {
            return Some(node_path);
        }
    }

    // Check user's .nvm installation
    if let Ok(home) = env::var("HOME") {
        let nvm_versions_dir = std::path::PathBuf::from(home).join(".nvm/versions/node");
        if nvm_versions_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&nvm_versions_dir) {
                for entry in entries.flatten() {
                    let node_path = entry.path().join("bin/node");
                    if node_path.exists() {
                        return Some(node_path);
                    }
                }
            }
        }
    }

    None
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

    let app_handle = app.handle().clone();
    let _tray = tray_builder
        .on_menu_event(move |app, event| {
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
                    // Stop the backend server before exiting
                    stop_backend_server(&app_handle);
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
