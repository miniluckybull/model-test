#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod storage;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, async_runtime};
use tokio::time::sleep;
use std::time::Instant;
use crate::models::TestResult;

static AUTO_TEST_RUNNING: AtomicBool = AtomicBool::new(false);

async fn test_single_config(app_handle: tauri::AppHandle, config: models::ApiConfig) {
    if config.api_key.is_empty() || config.endpoint.is_empty() {
        return;
    }

    let start = Instant::now();
    let result = services::send_test_request(&config).await;
    let elapsed = start.elapsed();

    let test_result = match result {
        Ok(response) => {
            TestResult {
                config_id: config.id.clone(),
                success: true,
                latency_ms: elapsed.as_millis() as u64,
                prompt_tokens: response.prompt_tokens,
                completion_tokens: response.completion_tokens,
                total_tokens: response.prompt_tokens + response.completion_tokens,
                error_message: None,
                model_response: Some(response.content),
                actual_model: response.actual_model,
            }
        }
        Err(error) => {
            TestResult {
                config_id: config.id.clone(),
                success: false,
                latency_ms: elapsed.as_millis() as u64,
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
                error_message: Some(error),
                model_response: None,
                actual_model: None,
            }
        }
    };

    let _ = app_handle.emit("test-complete", &test_result);
}

async fn run_test_all(app_handle: tauri::AppHandle) {
    let configs = storage::read_configs().unwrap_or_default();
    for config in configs {
        test_single_config(app_handle.clone(), config).await;
    }
}

fn start_auto_test_timer(app_handle: tauri::AppHandle) {
    if AUTO_TEST_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }

    async_runtime::spawn(async move {
        // Wait 1 hour between tests
        loop {
            sleep(std::time::Duration::from_secs(3600)).await;
            run_test_all(app_handle.clone()).await;
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            storage::init(app.handle())?;
            start_auto_test_timer(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::add_api_config,
            commands::config::get_all_configs,
            commands::config::update_api_config,
            commands::config::delete_api_config,
            commands::test::test_model,
            commands::test::batch_test_models,
            commands::claude::get_claude_config,
            commands::claude::preview_claude_config,
            commands::claude::apply_claude_config,
            commands::claude::apply_custom_claude_config,
            commands::claude::get_claude_config_path_command,
            commands::claude::export_to_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
