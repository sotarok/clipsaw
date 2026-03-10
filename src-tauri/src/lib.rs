pub mod commands;
pub mod db;
pub mod ffmpeg;

use commands::AppState;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("./data"));

            std::fs::create_dir_all(&data_dir).ok();

            // Load config
            let config_path = data_dir.join("config.json");
            let config = commands::load_config(&config_path);

            let input_dir = config["inputDir"]
                .as_str()
                .map(PathBuf::from);

            let output_dir = config["outputDir"]
                .as_str()
                .map(PathBuf::from);

            let database = db::Database::new(&data_dir)
                .expect("Failed to initialize database");

            let state = Arc::new(AppState {
                db: database,
                data_dir,
                input_dir,
                output_dir,
            });

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_projects,
            commands::create_project,
            commands::get_project,
            commands::update_project,
            commands::delete_project,
            commands::list_files,
            commands::start_split,
            commands::start_concat,
            commands::generate_waveform,
            commands::open_folder,
            commands::get_app_dirs,
            commands::set_input_dir,
            commands::set_output_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
