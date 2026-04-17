#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            storage::init(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::add_api_config,
            commands::config::get_all_configs,
            commands::config::update_api_config,
            commands::config::delete_api_config,
            commands::test::test_model,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
