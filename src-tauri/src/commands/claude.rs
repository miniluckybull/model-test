use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeConfig {
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeConfigRequest {
    pub api_key: String,
    pub auth_token: String,
    pub base_url: Option<String>,
    pub model: Option<String>,
    pub custom_config_path: Option<String>,
    pub thinking_mode: Option<String>,
    pub thinking_effort: Option<String>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigComparison {
    pub current_config: ClaudeConfig,
    pub new_config_json: String,
    pub config_path: String,
    pub current_config_json: String,
    pub detected_paths: Vec<String>,
}

/// Get all possible Claude config paths in priority order
fn get_all_claude_config_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    
    // Primary: Claude Code official user-level config (recommended)
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join(".claude").join("settings.json"));
    }
    
    // Secondary: Project-level configs
    if let Ok(current_dir) = std::env::current_dir() {
        let project_claude_dir = current_dir.join(".claude");
        if project_claude_dir.exists() {
            paths.push(project_claude_dir.join("settings.json"));
            paths.push(project_claude_dir.join("settings.local.json"));
        }
    }
    
    // Fallback: Alternative user-level paths
    if let Some(home) = dirs::home_dir() {
        // Old format or alternative location
        paths.push(home.join(".claude.json"));
    }
    
    // Platform-specific managed configs
    #[cfg(target_os = "macos")]
    {
        paths.push(PathBuf::from("/Library/Application Support/ClaudeCode/managed-settings.json"));
    }
    
    #[cfg(target_os = "linux")]
    {
        paths.push(PathBuf::from("/etc/claude-code/managed-settings.json"));
    }
    
    #[cfg(target_os = "windows")]
    {
        if let Some(program_files) = std::env::var_os("ProgramFiles") {
            paths.push(PathBuf::from(program_files).join("ClaudeCode").join("managed-settings.json"));
        }
    }
    
    paths
}

/// Find the first existing config file
fn find_existing_config_path() -> Option<PathBuf> {
    get_all_claude_config_paths()
        .into_iter()
        .find(|p| p.exists())
}

/// Get the best config path (existing or default)
fn get_claude_config_path(custom_path: Option<&str>) -> Result<PathBuf, String> {
    if let Some(path) = custom_path {
        if !path.is_empty() {
            return Ok(PathBuf::from(path));
        }
    }
    
    if let Some(existing) = find_existing_config_path() {
        return Ok(existing);
    }
    
    let home = dirs::home_dir().ok_or("找不到主目录")?;
    Ok(home.join(".claude").join("settings.json"))
}

fn read_claude_config(custom_path: Option<&str>) -> Result<ClaudeConfig, String> {
    let path = get_claude_config_path(custom_path)?;
    
    if !path.exists() {
        return Ok(ClaudeConfig {
            env: HashMap::new(),
            model: None,
        });
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    
    let config: ClaudeConfig = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置 JSON 失败: {}", e))?;
    
    Ok(config)
}

fn write_claude_config(config: &ClaudeConfig, custom_path: Option<&str>) -> Result<String, String> {
    let path = get_claude_config_path(custom_path)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;

    fs::write(&path, json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_claude_config(custom_config_path: Option<String>) -> Result<ConfigComparison, String> {
    let path_ref = custom_config_path.as_deref().filter(|s| !s.is_empty());
    let current_config = read_claude_config(path_ref)?;
    let config_path = get_claude_config_path(path_ref)?.to_string_lossy().to_string();
    
    let current_config_json = serde_json::to_string_pretty(&current_config)
        .unwrap_or_default();
    
    let detected_paths: Vec<String> = get_all_claude_config_paths()
        .into_iter()
        .map(|p| {
            let path_str = p.to_string_lossy().to_string();
            if p.exists() {
                format!("{} (exists)", path_str)
            } else {
                path_str
            }
        })
        .collect();

    Ok(ConfigComparison {
        current_config,
        new_config_json: serde_json::json!({
            "ANTHROPIC_API_KEY": "",
            "ANTHROPIC_AUTH_TOKEN": "",
        }).to_string(),
        config_path,
        current_config_json,
        detected_paths,
    })
}

#[tauri::command]
pub fn preview_claude_config(request: ClaudeConfigRequest) -> Result<ConfigComparison, String> {
    let path_ref = request.custom_config_path.as_deref().filter(|s| !s.is_empty());
    let current_config = read_claude_config(path_ref)?;
    let config_path = get_claude_config_path(path_ref)?.to_string_lossy().to_string();
    
    let current_config_json = serde_json::to_string_pretty(&current_config)
        .unwrap_or_default();
    
    let detected_paths: Vec<String> = get_all_claude_config_paths()
        .into_iter()
        .map(|p| {
            let path_str = p.to_string_lossy().to_string();
            if p.exists() {
                format!("{} (exists)", path_str)
            } else {
                path_str
            }
        })
        .collect();

    // Build the new config in the same structure as settings.json
    let mut env = serde_json::Map::new();

    // Always set API key
    env.insert("ANTHROPIC_API_KEY".to_string(), serde_json::Value::String(request.api_key.clone()));

    // Only set auth_token if NOT using a custom base_url (third-party proxy)
    let is_using_proxy = request.base_url.as_ref().map_or(false, |url| {
        !url.is_empty() && !url.contains("api.anthropic.com")
    });

    if !is_using_proxy {
        env.insert("ANTHROPIC_AUTH_TOKEN".to_string(), serde_json::Value::String(request.auth_token.clone()));
    }

    if let Some(base_url) = &request.base_url {
        if !base_url.is_empty() {
            env.insert("ANTHROPIC_BASE_URL".to_string(), serde_json::Value::String(base_url.clone()));
        }
    }

    if let Some(model) = &request.model {
        if !model.is_empty() {
            env.insert("ANTHROPIC_MODEL".to_string(), serde_json::Value::String(model.clone()));
        }
    }

    if let Some(thinking_mode) = &request.thinking_mode {
        if !thinking_mode.is_empty() {
            env.insert("ANTHROPIC_THINKING_MODE".to_string(), serde_json::Value::String(thinking_mode.clone()));
        }
    }

    if let Some(thinking_effort) = &request.thinking_effort {
        if !thinking_effort.is_empty() {
            env.insert("ANTHROPIC_THINKING_EFFORT".to_string(), serde_json::Value::String(thinking_effort.clone()));
        }
    }

    if let Some(max_tokens) = request.max_tokens {
        if max_tokens > 0 {
            env.insert("ANTHROPIC_MAX_TOKENS".to_string(), serde_json::Value::String(max_tokens.to_string()));
        }
    }

    let mut new_config = serde_json::Map::new();
    new_config.insert("env".to_string(), serde_json::Value::Object(env));
    
    if let Some(model) = &request.model {
        if !model.is_empty() {
            new_config.insert("model".to_string(), serde_json::Value::String(model.clone()));
        }
    }

    let new_config_json = serde_json::to_string_pretty(&new_config)
        .unwrap_or_default();

    Ok(ConfigComparison {
        current_config,
        new_config_json,
        config_path,
        current_config_json,
        detected_paths,
    })
}

#[tauri::command]
pub fn apply_claude_config(request: ClaudeConfigRequest) -> Result<String, String> {
    let path_ref = request.custom_config_path.as_deref().filter(|s| !s.is_empty());
    let mut config = read_claude_config(path_ref)?;

    // Always set API key
    config.env.insert("ANTHROPIC_API_KEY".to_string(), request.api_key.clone());

    // Only set auth_token if NOT using a custom base_url (third-party proxy)
    let is_using_proxy = request.base_url.as_ref().map_or(false, |url| {
        !url.is_empty() && !url.contains("api.anthropic.com")
    });

    if !is_using_proxy {
        config.env.insert("ANTHROPIC_AUTH_TOKEN".to_string(), request.auth_token);
    } else {
        // Remove auth_token if switching to proxy mode
        config.env.remove("ANTHROPIC_AUTH_TOKEN");
    }

    if let Some(base_url) = request.base_url {
        if !base_url.is_empty() {
            config.env.insert("ANTHROPIC_BASE_URL".to_string(), base_url);
        } else {
            config.env.remove("ANTHROPIC_BASE_URL");
        }
    }

    if let Some(model) = request.model {
        if !model.is_empty() {
            // Set both env.ANTHROPIC_MODEL and model for Claude Code compatibility
            config.env.insert("ANTHROPIC_MODEL".to_string(), model.clone());
            config.model = Some(model);
        } else {
            config.env.remove("ANTHROPIC_MODEL");
            config.model = None;
        }
    }

    if let Some(thinking_mode) = request.thinking_mode {
        if !thinking_mode.is_empty() {
            config.env.insert("ANTHROPIC_THINKING_MODE".to_string(), thinking_mode);
        } else {
            config.env.remove("ANTHROPIC_THINKING_MODE");
        }
    }

    if let Some(thinking_effort) = request.thinking_effort {
        if !thinking_effort.is_empty() {
            config.env.insert("ANTHROPIC_THINKING_EFFORT".to_string(), thinking_effort);
        } else {
            config.env.remove("ANTHROPIC_THINKING_EFFORT");
        }
    }

    if let Some(max_tokens) = request.max_tokens {
        if max_tokens > 0 {
            config.env.insert("ANTHROPIC_MAX_TOKENS".to_string(), max_tokens.to_string());
        } else {
            config.env.remove("ANTHROPIC_MAX_TOKENS");
        }
    }

    let config_path = write_claude_config(&config, path_ref)?;

    Ok(config_path)
}

#[tauri::command]
pub fn get_claude_config_path_command(custom_config_path: Option<String>) -> Result<String, String> {
    let path_ref = custom_config_path.as_deref().filter(|s| !s.is_empty());
    let path = get_claude_config_path(path_ref)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn apply_custom_claude_config(config_json: String, custom_config_path: Option<String>) -> Result<String, String> {
    let path_ref = custom_config_path.as_deref().filter(|s| !s.is_empty());
    let mut config = read_claude_config(path_ref)?;

    let custom_config: serde_json::Value = serde_json::from_str(&config_json)
        .map_err(|e| format!("解析配置 JSON 失败: {}", e))?;

    if let Some(env) = custom_config.get("env").and_then(|v| v.as_object()) {
        for (key, value) in env {
            if let Some(val_str) = value.as_str() {
                config.env.insert(key.clone(), val_str.to_string());
            }
        }
    }

    if let Some(obj) = custom_config.as_object() {
        for (key, value) in obj {
            if key != "env" && key != "model" {
                if let Some(val_str) = value.as_str() {
                    config.env.insert(key.clone(), val_str.to_string());
                }
            }
        }
    }

    if let Some(model) = custom_config.get("model").and_then(|v| v.as_str()) {
        config.model = Some(model.to_string());
    }

    let config_path = write_claude_config(&config, path_ref)?;

    Ok(config_path)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportToProjectResult {
    pub config_path: String,
    pub created_directory: bool,
}

/// Export configuration to a specific project directory
#[tauri::command]
pub fn export_to_project(
    request: ClaudeConfigRequest,
    project_path: String,
) -> Result<ExportToProjectResult, String> {
    // Validate project path
    let project_dir = PathBuf::from(&project_path);
    if !project_dir.exists() {
        return Err(format!("项目目录不存在: {}", project_path));
    }

    if !project_dir.is_dir() {
        return Err(format!("路径不是目录: {}", project_path));
    }

    // Create .claude directory if it doesn't exist
    let claude_dir = project_dir.join(".claude");
    let created_directory = !claude_dir.exists();

    if created_directory {
        fs::create_dir_all(&claude_dir)
            .map_err(|e| format!("创建 .claude 目录失败: {}", e))?;
    }

    // Build config
    let mut config = ClaudeConfig {
        env: HashMap::new(),
        model: None,
    };

    // Set API key
    config.env.insert("ANTHROPIC_API_KEY".to_string(), request.api_key.clone());

    // Handle auth_token based on proxy usage
    let is_using_proxy = request.base_url.as_ref().map_or(false, |url| {
        !url.is_empty() && !url.contains("api.anthropic.com")
    });

    if !is_using_proxy {
        config.env.insert("ANTHROPIC_AUTH_TOKEN".to_string(), request.auth_token.clone());
    }

    if let Some(base_url) = &request.base_url {
        if !base_url.is_empty() {
            config.env.insert("ANTHROPIC_BASE_URL".to_string(), base_url.clone());
        }
    }

    if let Some(model) = &request.model {
        if !model.is_empty() {
            config.env.insert("ANTHROPIC_MODEL".to_string(), model.clone());
            config.model = Some(model.clone());
        }
    }

    if let Some(thinking_mode) = &request.thinking_mode {
        if !thinking_mode.is_empty() {
            config.env.insert("ANTHROPIC_THINKING_MODE".to_string(), thinking_mode.clone());
        }
    }

    if let Some(thinking_effort) = &request.thinking_effort {
        if !thinking_effort.is_empty() {
            config.env.insert("ANTHROPIC_THINKING_EFFORT".to_string(), thinking_effort.clone());
        }
    }

    if let Some(max_tokens) = request.max_tokens {
        if max_tokens > 0 {
            config.env.insert("ANTHROPIC_MAX_TOKENS".to_string(), max_tokens.to_string());
        }
    }

    // Write to project's .claude/settings.json
    let config_path = claude_dir.join("settings.json");
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;

    fs::write(&config_path, json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    Ok(ExportToProjectResult {
        config_path: config_path.to_string_lossy().to_string(),
        created_directory,
    })
}
