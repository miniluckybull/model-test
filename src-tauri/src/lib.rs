#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;
mod services;
mod storage;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, async_runtime, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent, MouseButton}, image::Image};
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
        Ok((prompt_tokens, completion_tokens, response)) => {
            TestResult {
                config_id: config.id.clone(),
                success: true,
                latency_ms: elapsed.as_millis() as u64,
                prompt_tokens,
                completion_tokens,
                total_tokens: prompt_tokens + completion_tokens,
                error_message: None,
                model_response: Some(response),
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
        .setup(|app| {
            storage::init(app.handle())?;

            let show_window = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let test_all = MenuItem::with_id(app, "test_all", "测试所有配置", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_window, &test_all, &quit])?;

            let app_handle = app.handle().clone();
            
            // Load tray icon from embedded PNG - decode using image crate
            let icon_bytes = include_bytes!("../icons/32x32.png");
            let img = image::load_from_memory(icon_bytes).expect("Failed to decode tray icon");
            let rgba = img.into_rgba8();
            let (w, h) = rgba.dimensions();
            let icon: Image<'static> = Image::new_owned(rgba.into_raw(), w, h);
            
            // Build tray with icon
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .tooltip("Model Tester")
                .on_menu_event(move |app: &tauri::AppHandle, event: tauri::menu::MenuEvent| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "test_all" => {
                            let handle = app.clone();
                            async_runtime::spawn(async move {
                                run_test_all(handle).await;
                            });
                        }
                        "quit" => {
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _: Result<_, _> = window.show();
                            let _: Result<_, _> = window.set_focus();
                        }
                    }
                })
                .build(&app_handle)?;

            start_auto_test_timer(app_handle);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Prevent close and hide to tray
                api.prevent_close();
                if let Ok(_) = window.hide() {
                    // Successfully hidden to tray
                }
            }
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
