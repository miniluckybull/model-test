use reqwest::Client;
use serde_json::json;
use std::time::Duration;
use crate::models::ApiConfig;

fn build_client() -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .read_timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

pub async fn send_test_request(config: &ApiConfig) -> Result<(u64, u64, String), String> {
    let client = build_client()?;
    
    let (url, headers, body) = match config.provider.as_str() {
        "anthropic" => build_anthropic_request(config),
        "openai" | _ => build_openai_request(config),
    };
    
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
    
    let url = format!("{}/v1/chat/completions", config.endpoint.trim_end_matches('/'));
    
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        format!("Bearer {}", config.api_key).parse().unwrap(),
    );
    headers.insert(CONTENT_TYPE, "application/json".parse().unwrap());
    
    let body = json!({
        "model": config.model,
        "messages": [{"role": "user", "content": "Hello"}],
        "max_tokens": 100
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

fn parse_response(json: &serde_json::Value, provider: &str) -> Result<(u64, u64, String), String> {
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
            
            Ok((prompt_tokens, completion_tokens, content))
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
            
            Ok((prompt_tokens, completion_tokens, content))
        }
    }
}
