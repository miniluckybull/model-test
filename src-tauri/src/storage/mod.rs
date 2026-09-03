use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use crate::models::ApiConfig;

static CONFIGS: Mutex<Option<Vec<ApiConfig>>> = Mutex::new(None);

fn get_config_path(_app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "找不到配置目录".to_string())?;
    let app_dir = config_dir.join("com.local.model-test");
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("无法创建配置目录: {}", e))?;
    Ok(app_dir.join("configs.json"))
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let path = get_config_path(app)?;
    let configs = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("无法读取配置: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };
    
    let mut global = CONFIGS.lock().map_err(|e| e.to_string())?;
    *global = Some(configs);
    Ok(())
}

fn get_configs() -> Result<Vec<ApiConfig>, String> {
    let global = CONFIGS.lock().map_err(|e| e.to_string())?;
    Ok(global.clone().unwrap_or_default())
}

fn save_configs(configs: &[ApiConfig]) -> Result<(), String> {
    let mut global = CONFIGS.lock().map_err(|e| e.to_string())?;
    *global = Some(configs.to_vec());
    
    // Write to disk
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "找不到配置目录".to_string())?;
    let app_dir = config_dir.join("com.local.model-test");
    let path = app_dir.join("configs.json");
    
    let json = serde_json::to_string_pretty(configs)
        .map_err(|e| format!("无法序列化配置: {}", e))?;
    
    std::fs::write(&path, json)
        .map_err(|e| format!("无法写入配置文件: {}", e))?;
    
    Ok(())
}

pub fn read_configs() -> Result<Vec<ApiConfig>, String> {
    get_configs()
}

pub fn write_configs(configs: &[ApiConfig]) -> Result<(), String> {
    save_configs(configs)
}

pub fn find_config(id: &str) -> Result<Option<ApiConfig>, String> {
    let configs = get_configs()?;
    Ok(configs.into_iter().find(|c| c.id == id))
}
