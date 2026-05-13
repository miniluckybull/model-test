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

#[tauri::command]
pub async fn test_model(
    app: tauri::AppHandle,
    config_id: String,
) -> Result<(), String> {
    let config = storage::find_config(&config_id)?
        .ok_or_else(|| format!("Config with id '{}' not found", config_id))?;
    
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
