use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::models::ApiConfig;
use crate::storage;

#[derive(Deserialize)]
pub struct CreateConfig {
    pub name: String,
    pub provider: String,
    pub endpoint: String,
    pub model: String,
    pub api_key: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub order: Option<usize>,
}

#[tauri::command]
pub fn add_api_config(config: CreateConfig) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();

    let new_config = ApiConfig {
        id: id.clone(),
        name: config.name,
        provider: config.provider,
        endpoint: config.endpoint,
        model: config.model,
        api_key: config.api_key,
        status: "idle".to_string(),
        last_latency: None,
        last_tokens: None,
        last_tested_at: None,
        error_message: None,
        tags: config.tags,
        order: config.order,
    };

    let mut configs = storage::read_configs()?;
    configs.push(new_config);
    storage::write_configs(&configs)?;

    Ok(id)
}

#[derive(Serialize)]
pub struct ConfigResponse {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub endpoint: String,
    pub model: String,
    pub api_key: String,
    pub status: String,
    pub last_latency: Option<u64>,
    pub last_tokens: Option<u64>,
    pub last_tested_at: Option<String>,
    pub error_message: Option<String>,
    pub tags: Vec<String>,
    pub order: Option<usize>,
}

#[tauri::command]
pub fn get_all_configs() -> Result<Vec<ConfigResponse>, String> {
    let configs = storage::read_configs()?;
    Ok(configs.into_iter().map(|c| ConfigResponse {
        id: c.id,
        name: c.name,
        provider: c.provider,
        endpoint: c.endpoint,
        model: c.model,
        api_key: c.api_key,
        status: c.status,
        last_latency: c.last_latency,
        last_tokens: c.last_tokens,
        last_tested_at: c.last_tested_at,
        error_message: c.error_message,
        tags: c.tags,
        order: c.order,
    }).collect())
}

#[derive(Deserialize)]
pub struct UpdateConfig {
    pub id: String,
    pub name: Option<String>,
    pub provider: Option<String>,
    pub endpoint: Option<String>,
    pub model: Option<String>,
    pub api_key: Option<String>,
    pub status: Option<String>,
    pub last_latency: Option<u64>,
    pub last_tokens: Option<u64>,
    pub last_tested_at: Option<String>,
    pub error_message: Option<String>,
    pub tags: Option<Vec<String>>,
    pub order: Option<usize>,
}

#[tauri::command]
pub fn update_api_config(update: UpdateConfig) -> Result<(), String> {
    let mut configs = storage::read_configs()?;
    
    if let Some(config) = configs.iter_mut().find(|c| c.id == update.id) {
        if let Some(name) = update.name {
            config.name = name;
        }
        if let Some(provider) = update.provider {
            config.provider = provider;
        }
        if let Some(endpoint) = update.endpoint {
            config.endpoint = endpoint;
        }
        if let Some(model) = update.model {
            config.model = model;
        }
        if let Some(api_key) = update.api_key {
            config.api_key = api_key;
        }
        if let Some(status) = update.status {
            config.status = status;
        }
        if let Some(last_latency) = update.last_latency {
            config.last_latency = Some(last_latency);
        }
        if let Some(last_tokens) = update.last_tokens {
            config.last_tokens = Some(last_tokens);
        }
        if let Some(last_tested_at) = update.last_tested_at {
            config.last_tested_at = Some(last_tested_at);
        }
        config.error_message = update.error_message;
        if let Some(tags) = update.tags {
            config.tags = tags;
        }
        if let Some(order) = update.order {
            config.order = Some(order);
        }
    } else {
        return Err(format!("找不到 id 为 '{}' 的配置", update.id));
    }
    
    storage::write_configs(&configs)?;
    Ok(())
}

#[tauri::command]
pub fn delete_api_config(id: String) -> Result<(), String> {
    let mut configs = storage::read_configs()?;
    let initial_len = configs.len();
    configs.retain(|c| c.id != id);
    
    if configs.len() == initial_len {
        return Err(format!("找不到 id 为 '{}' 的配置", id));
    }
    
    storage::write_configs(&configs)?;
    Ok(())
}
