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
pub struct ModelTiersRequest {
    pub opus: Option<String>,
    pub sonnet: Option<String>,
    pub haiku: Option<String>,
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
    /// Claude Code tier mapping: ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL
    #[serde(default)]
    pub tiers: Option<ModelTiersRequest>,
}

/// Env keys this app manages; absent from build_env output means "remove"
const MANAGED_ENV_KEYS: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_MODEL",
    "ANTHROPIC_THINKING_MODE",
    "ANTHROPIC_THINKING_EFFORT",
    "ANTHROPIC_MAX_TOKENS",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
];

/// Build the env entries managed by this app. Empty/None values are omitted;
/// callers that merge into an existing config remove the omitted keys.
fn put_env(env: &mut serde_json::Map<String, serde_json::Value>, key: &str, value: &str) {
    if !value.is_empty() {
        env.insert(key.to_string(), serde_json::Value::String(value.to_string()));
    }
}

fn build_env(request: &ClaudeConfigRequest) -> serde_json::Map<String, serde_json::Value> {
    let mut env = serde_json::Map::new();

    put_env(&mut env, "ANTHROPIC_API_KEY", &request.api_key);

    // Only set auth_token when NOT using a custom base_url (third-party proxy)
    let is_using_proxy = request.base_url.as_ref().map_or(false, |url| {
        !url.is_empty() && !url.contains("api.anthropic.com")
    });
    if !is_using_proxy {
        put_env(&mut env, "ANTHROPIC_AUTH_TOKEN", &request.auth_token);
    }

    if let Some(v) = &request.base_url {
        put_env(&mut env, "ANTHROPIC_BASE_URL", v);
    }
    if let Some(v) = &request.model {
        put_env(&mut env, "ANTHROPIC_MODEL", v);
    }
    if let Some(v) = &request.thinking_mode {
        put_env(&mut env, "ANTHROPIC_THINKING_MODE", v);
    }
    if let Some(v) = &request.thinking_effort {
        put_env(&mut env, "ANTHROPIC_THINKING_EFFORT", v);
    }
    if let Some(t) = request.max_tokens {
        if t > 0 {
            env.insert(
                "ANTHROPIC_MAX_TOKENS".to_string(),
                serde_json::Value::String(t.to_string()),
            );
        }
    }

    if let Some(tiers) = &request.tiers {
        if let Some(v) = &tiers.opus {
            put_env(&mut env, "ANTHROPIC_DEFAULT_OPUS_MODEL", v);
        }
        if let Some(v) = &tiers.sonnet {
            put_env(&mut env, "ANTHROPIC_DEFAULT_SONNET_MODEL", v);
        }
        if let Some(v) = &tiers.haiku {
            put_env(&mut env, "ANTHROPIC_DEFAULT_HAIKU_MODEL", v);
        }
    }

    env
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
    let env = build_env(&request);

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

    let env = build_env(&request);
    for key in MANAGED_ENV_KEYS {
        match env.get(*key).and_then(|v| v.as_str()) {
            Some(value) => {
                config.env.insert(key.to_string(), value.to_string());
            }
            None => {
                config.env.remove(*key);
            }
        }
    }

    // Set both env.ANTHROPIC_MODEL and model for Claude Code compatibility
    config.model = request.model.clone().filter(|m| !m.is_empty());

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
    /// true when config was written to settings.local.json (contains secrets)
    pub used_local_settings: bool,
    /// true when .claude/.gitignore was created/updated to exclude settings.local.json
    pub gitignore_updated: bool,
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

    // Build config from the shared env builder
    let env_map = build_env(&request);
    let mut config = ClaudeConfig {
        env: HashMap::new(),
        model: request.model.clone().filter(|m| !m.is_empty()),
    };
    for (key, value) in env_map {
        if let Some(s) = value.as_str() {
            config.env.insert(key, s.to_string());
        }
    }

    // Configs containing secrets go to settings.local.json, which Claude Code
    // users conventionally gitignore; plain configs go to settings.json.
    let contains_secret = config
        .env
        .get("ANTHROPIC_API_KEY")
        .or_else(|| config.env.get("ANTHROPIC_AUTH_TOKEN"))
        .map_or(false, |v| !v.is_empty());
    let file_name = if contains_secret {
        "settings.local.json"
    } else {
        "settings.json"
    };
    let config_path = claude_dir.join(file_name);

    // Merge into the existing file (if any) so unrelated settings such as
    // permissions and enabledMcpjsonServers are preserved.
    let mut root: serde_json::Map<String, serde_json::Value> = if config_path.exists() {
        fs::read_to_string(&config_path)
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    let env_entry = root
        .entry("env")
        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
    if let Some(env_obj) = env_entry.as_object_mut() {
        for (key, value) in &config.env {
            env_obj.insert(key.clone(), serde_json::Value::String(value.clone()));
        }
    }
    if let Some(model) = &config.model {
        root.insert("model".to_string(), serde_json::Value::String(model.clone()));
    }

    let json = serde_json::to_string_pretty(&serde_json::Value::Object(root))
        .map_err(|e| format!("序列化配置失败: {}", e))?;

    fs::write(&config_path, json)
        .map_err(|e| format!("写入配置文件失败: {}", e))?;

    // Keep secrets out of git: ensure .claude/.gitignore excludes settings.local.json
    let mut gitignore_updated = false;
    if contains_secret {
        let gitignore_path = claude_dir.join(".gitignore");
        let existing = fs::read_to_string(&gitignore_path).unwrap_or_default();
        let already_ignored = existing
            .lines()
            .any(|line| line.trim() == "settings.local.json");
        if !already_ignored {
            let mut content = existing;
            if !content.is_empty() && !content.ends_with('\n') {
                content.push('\n');
            }
            content.push_str("settings.local.json\n");
            // Best-effort: failure to write .gitignore should not fail the export
            gitignore_updated = fs::write(&gitignore_path, content).is_ok();
        }
    }

    // Remember the project so it shows up in the registry / cascade menu
    let _ = super::projects::register_project_internal(&project_path, "export", true);

    Ok(ExportToProjectResult {
        config_path: config_path.to_string_lossy().to_string(),
        created_directory,
        used_local_settings: contains_secret,
        gitignore_updated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_request(api_key: &str) -> ClaudeConfigRequest {
        ClaudeConfigRequest {
            api_key: api_key.to_string(),
            auth_token: api_key.to_string(),
            base_url: Some("https://api.example.com".to_string()),
            model: Some("test-model".to_string()),
            custom_config_path: None,
            thinking_mode: None,
            thinking_effort: None,
            max_tokens: None,
            tiers: None,
        }
    }

    fn temp_project(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("model-test-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn export_with_secret_writes_local_settings_and_gitignore() {
        let project = temp_project("secret");
        let result = export_to_project(make_request("sk-test-123"), project.to_string_lossy().to_string()).unwrap();

        assert!(result.used_local_settings);
        assert!(result.config_path.ends_with(".claude/settings.local.json"));

        let content: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&result.config_path).unwrap()).unwrap();
        assert_eq!(content["env"]["ANTHROPIC_API_KEY"], "sk-test-123");
        assert_eq!(content["model"], "test-model");

        let gitignore = fs::read_to_string(project.join(".claude/.gitignore")).unwrap();
        assert!(gitignore.contains("settings.local.json"));

        fs::remove_dir_all(&project).unwrap();
    }

    #[test]
    fn export_merges_with_existing_local_settings() {
        let project = temp_project("merge");
        let claude_dir = project.join(".claude");
        fs::create_dir_all(&claude_dir).unwrap();
        fs::write(
            claude_dir.join("settings.local.json"),
            r#"{"permissions":{"allow":["Bash(ls *)"]},"env":{"OTHER_VAR":"keep-me"}}"#,
        )
        .unwrap();

        let result = export_to_project(make_request("sk-test-456"), project.to_string_lossy().to_string()).unwrap();

        let content: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&result.config_path).unwrap()).unwrap();
        // 原有的 permissions 和无关 env 变量保留
        assert_eq!(content["permissions"]["allow"][0], "Bash(ls *)");
        assert_eq!(content["env"]["OTHER_VAR"], "keep-me");
        // 新配置写入
        assert_eq!(content["env"]["ANTHROPIC_API_KEY"], "sk-test-456");

        fs::remove_dir_all(&project).unwrap();
    }

    #[test]
    fn export_without_secret_writes_plain_settings() {
        let project = temp_project("nosecret");
        let result = export_to_project(make_request(""), project.to_string_lossy().to_string()).unwrap();

        assert!(!result.used_local_settings);
        assert!(result.config_path.ends_with(".claude/settings.json"));
        assert!(!project.join(".claude/.gitignore").exists());

        fs::remove_dir_all(&project).unwrap();
    }

    #[test]
    fn build_env_writes_tier_variables() {
        let mut req = make_request("sk-tier-1");
        req.tiers = Some(ModelTiersRequest {
            opus: Some("big-model".to_string()),
            sonnet: None,
            haiku: Some("tiny-model".to_string()),
        });
        let env = build_env(&req);
        assert_eq!(
            env.get("ANTHROPIC_DEFAULT_OPUS_MODEL").and_then(|v| v.as_str()),
            Some("big-model")
        );
        assert_eq!(
            env.get("ANTHROPIC_DEFAULT_HAIKU_MODEL").and_then(|v| v.as_str()),
            Some("tiny-model")
        );
        assert!(!env.contains_key("ANTHROPIC_DEFAULT_SONNET_MODEL"));
        // deprecated variable must never be written
        assert!(!env.contains_key("ANTHROPIC_SMALL_FAST_MODEL"));
    }

    #[test]
    fn apply_removes_cleared_tier_keys() {
        let dir = temp_project("apply-tiers");
        let path = dir.join("settings.json");
        let mut req = make_request("sk-tier-2");
        req.custom_config_path = Some(path.to_string_lossy().to_string());
        req.tiers = Some(ModelTiersRequest {
            opus: None,
            sonnet: None,
            haiku: Some("tiny".to_string()),
        });
        apply_claude_config(req.clone()).unwrap();
        let content: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(content["env"]["ANTHROPIC_DEFAULT_HAIKU_MODEL"], "tiny");

        let mut cleared = req.clone();
        cleared.tiers = None;
        apply_claude_config(cleared).unwrap();
        let content2: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert!(content2["env"].get("ANTHROPIC_DEFAULT_HAIKU_MODEL").is_none());

        fs::remove_dir_all(&dir).unwrap();
    }
}
