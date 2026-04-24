use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeConfig {
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClaudeConfigRequest {
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigComparison {
    pub current_config: ClaudeConfig,
    pub new_config: ClaudeConfigRequest,
    pub config_path: String,
}

fn get_claude_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".claude").join("settings.json"))
}

fn read_claude_config() -> Result<ClaudeConfig, String> {
    let path = get_claude_config_path()?;
    
    if !path.exists() {
        return Ok(ClaudeConfig {
            env: HashMap::new(),
            model: None,
        });
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    
    let config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;
    
    Ok(config)
}

fn write_claude_config(config: &ClaudeConfig) -> Result<String, String> {
    let path = get_claude_config_path()?;
    
    // Create directory if it doesn't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Create backup before writing
    if path.exists() {
        let backup_path = path.with_extension(format!("json.backup.{}", 
            chrono::Utc::now().format("%Y%m%d_%H%M%S")));
        fs::copy(&path, &backup_path)
            .map_err(|e| format!("Failed to create backup: {}", e))?;
    }

    // Write new config
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&path, json)
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_claude_config() -> Result<ConfigComparison, String> {
    let current_config = read_claude_config()?;
    let config_path = get_claude_config_path()?.to_string_lossy().to_string();

    Ok(ConfigComparison {
        current_config,
        new_config: ClaudeConfigRequest {
            api_key: String::new(),
            base_url: None,
            model: None,
        },
        config_path,
    })
}

#[tauri::command]
pub fn preview_claude_config(request: ClaudeConfigRequest) -> Result<ConfigComparison, String> {
    let current_config = read_claude_config()?;
    let config_path = get_claude_config_path()?.to_string_lossy().to_string();

    Ok(ConfigComparison {
        current_config,
        new_config: request,
        config_path,
    })
}

#[tauri::command]
pub fn apply_claude_config(request: ClaudeConfigRequest) -> Result<String, String> {
    let mut config = read_claude_config()?;

    // Update environment variables
    config.env.insert("ANTHROPIC_API_KEY".to_string(), request.api_key);
    
    if let Some(base_url) = request.base_url {
        if !base_url.is_empty() {
            config.env.insert("ANTHROPIC_BASE_URL".to_string(), base_url);
        } else {
            config.env.remove("ANTHROPIC_BASE_URL");
        }
    }

    // Update model
    if let Some(model) = request.model {
        if !model.is_empty() {
            config.model = Some(model);
        } else {
            config.model = None;
        }
    }

    let config_path = write_claude_config(&config)?;

    Ok(config_path)
}

#[tauri::command]
pub fn get_claude_config_path_command() -> Result<String, String> {
    let path = get_claude_config_path()?;
    Ok(path.to_string_lossy().to_string())
}
