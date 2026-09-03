use reqwest::Client;
use serde_json::json;
use std::time::Duration;
use crate::models::{ApiConfig, ModelTestResponse};

pub mod keyring;

fn build_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

pub async fn send_test_request(config: &ApiConfig) -> Result<ModelTestResponse, String> {
    let client = build_client()?;
    
    let (url, headers, body) = match config.provider.as_str() {
        "anthropic" => build_anthropic_request(config),
        "openai" | _ => build_openai_request(config),
    };
    
    // Debug logging
    eprintln!("[DEBUG] Testing config: id={}, name={}, provider={}", config.id, config.name, config.provider);
    eprintln!("[DEBUG] URL: {}", url);
    eprintln!("[DEBUG] Model: {}", config.model);
    
    let response = client
        .post(&url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        eprintln!("[DEBUG] HTTP Error {}: {}", status.as_u16(), error_text);
        return Err(format!("HTTP {}: {}", status.as_u16(), error_text));
    }
    
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    parse_response(&json, &config.provider)
}

fn build_openai_request(config: &ApiConfig) -> (String, reqwest::header::HeaderMap, serde_json::Value) {
    use reqwest::header::{HeaderMap, AUTHORIZATION, CONTENT_TYPE};
    
    // Remove trailing slash
    let base = config.endpoint.trim_end_matches('/');
    
    // Build URL intelligently based on what the endpoint already contains
    let url = if base.ends_with("/chat/completions") {
        // Endpoint already has the full path
        base.to_string()
    } else if base.ends_with("/v1") {
        // Endpoint ends with /v1, append chat/completions
        format!("{}/chat/completions", base)
    } else if base.contains("/v1") {
        // Endpoint contains /v1 somewhere (e.g., /compatible-mode/v1)
        format!("{}/chat/completions", base)
    } else {
        // Endpoint is just a base URL, append /v1/chat/completions
        format!("{}/v1/chat/completions", base)
    };
    
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        format!("Bearer {}", config.api_key).parse().unwrap(),
    );
    headers.insert(CONTENT_TYPE, "application/json".parse().unwrap());
    
    let body = json!({
        "model": config.model,
        "messages": [{"role": "user", "content": "Hello"}],
        "max_tokens": 100,
        "stream": false
    });
    
    (url, headers, body)
}

fn build_anthropic_request(config: &ApiConfig) -> (String, reqwest::header::HeaderMap, serde_json::Value) {
    use reqwest::header::{HeaderMap, CONTENT_TYPE};
    
    let url = format!("{}/v1/messages", config.endpoint.trim_end_matches('/'));
    
    let mut headers = HeaderMap::new();
    headers.insert(
        "x-api-key",
        config.api_key.parse().unwrap(),
    );
    headers.insert(
        "anthropic-version",
        "2023-06-01".parse().unwrap(),
    );
    headers.insert(CONTENT_TYPE, "application/json".parse().unwrap());
    
    let body = json!({
        "model": config.model,
        "messages": [{"role": "user", "content": "Hello"}],
        "max_tokens": 100
    });
    
    (url, headers, body)
}

fn parse_response(json: &serde_json::Value, provider: &str) -> Result<ModelTestResponse, String> {
    match provider {
        "anthropic" => {
            let usage = json.get("usage")
                .ok_or_else(|| "Missing usage field".to_string())?;
            let prompt_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let completion_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            
            let content = json.get("content")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("text"))
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();
            
            let actual_model = json.get("model").and_then(|m| m.as_str()).map(String::from);

            Ok(ModelTestResponse {
                prompt_tokens,
                completion_tokens,
                content,
                actual_model,
            })
        }
        _ => {
            let usage = json.get("usage")
                .ok_or_else(|| "Missing usage field".to_string())?;
            let prompt_tokens = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            let completion_tokens = usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
            
            let content = json.get("choices")
                .and_then(|c| c.get(0))
                .and_then(|c| c.get("message"))
                .and_then(|m| m.get("content"))
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();
            
            let actual_model = json.get("model").and_then(|m| m.as_str()).map(String::from);

            Ok(ModelTestResponse {
                prompt_tokens,
                completion_tokens,
                content,
                actual_model,
            })
        }
    }
}
