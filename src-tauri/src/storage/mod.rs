use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;
use crate::models::ApiConfig;

static CONFIGS: Mutex<Option<Vec<ApiConfig>>> = Mutex::new(None);

fn get_config_path(_app: &AppHandle) -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Cannot find config directory".to_string())?;
    let app_dir = config_dir.join("com.local.model-test");
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Cannot create config directory: {}", e))?;
    Ok(app_dir.join("configs.json"))
}

pub fn init(app: &AppHandle) -> Result<(), String> {
    let path = get_config_path(app)?;
    let configs = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Cannot read configs: {}", e))?;
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
