use serde::Deserialize;
use tauri::Emitter;
use std::time::Instant;
use crate::models::TestResult;
use crate::storage;
use crate::services;

#[derive(Deserialize)]
pub struct TestModelRequest {
    pub config_id: String,
}

#[derive(Deserialize)]
pub struct BatchTestRequest {
    pub config_ids: Vec<String>,
    pub max_concurrent: Option<usize>,
}

#[tauri::command]
pub async fn test_model(
    app: tauri::AppHandle,
    config_id: String,
) -> Result<(), String> {
    let config = storage::find_config(&config_id)?
        .ok_or_else(|| format!("找不到 id 为 '{}' 的配置", config_id))?;

    let start = Instant::now();
    let result = services::send_test_request(&config).await;
    let elapsed = start.elapsed();

    let test_result = match result {
        Ok(response) => {
            TestResult {
                config_id: config_id.clone(),
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
                config_id: config_id.clone(),
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

    let _ = app.emit("test-complete", &test_result);

    Ok(())
}

#[tauri::command]
pub async fn batch_test_models(
    app: tauri::AppHandle,
    config_ids: Vec<String>,
    max_concurrent: Option<usize>,
) -> Result<(), String> {
    use futures::stream::{self, StreamExt};

    let concurrent_limit = max_concurrent.unwrap_or(3).min(5); // Max 5 concurrent

    let _ = app.emit("batch-test-started", serde_json::json!({
        "total": config_ids.len(),
        "concurrent": concurrent_limit,
    }));

    stream::iter(config_ids)
        .map(|config_id| {
            let app = app.clone();
            async move {
                let _ = test_model(app, config_id).await;
            }
        })
        .buffer_unordered(concurrent_limit)
        .collect::<Vec<_>>()
        .await;

    let _ = app.emit("batch-test-complete", serde_json::json!({}));

    Ok(())
}
