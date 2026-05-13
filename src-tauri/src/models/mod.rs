use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub endpoint: String,
    pub model: String,
    pub api_key: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub last_latency: Option<u64>,
    #[serde(default)]
    pub last_tokens: Option<u64>,
    #[serde(default)]
    pub last_tested_at: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub config_id: String,
    pub success: bool,
    pub latency_ms: u64,
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
    pub total_tokens: u64,
    pub error_message: Option<String>,
    pub model_response: Option<String>,
    pub actual_model: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ModelTestResponse {
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
    pub content: String,
    pub actual_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiProvider {
    pub name: String,
    pub base_endpoint: String,
    pub chat_path: String,
    pub auth_header: String,
    pub auth_scheme: String,
    pub request_template: serde_json::Value,
}

impl Default for ApiConfig {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            provider: "openai".to_string(),
            endpoint: String::new(),
            model: String::new(),
            api_key: String::new(),
            status: "idle".to_string(),
            last_latency: None,
            last_tokens: None,
            last_tested_at: None,
            error_message: None,
        }
    }
}
