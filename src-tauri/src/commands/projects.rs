use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectEntry {
    pub path: String,
    pub name: String,
    /// "export" = registered by export_to_project, "manual" = added by user
    pub source: String,
    pub added_at: String,
    #[serde(default)]
    pub last_applied_at: Option<String>,
}

static PROJECTS: Mutex<Option<Vec<ProjectEntry>>> = Mutex::new(None);

fn get_projects_path() -> Result<PathBuf, String> {
    let config_dir = dirs::config_dir().ok_or_else(|| "找不到配置目录".to_string())?;
    let app_dir = config_dir.join("com.local.model-test");
    fs::create_dir_all(&app_dir).map_err(|e| format!("无法创建配置目录: {}", e))?;
    Ok(app_dir.join("projects.json"))
}

pub fn init_projects() -> Result<(), String> {
    let path = get_projects_path()?;
    let projects = if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        match serde_json::from_str(&content) {
            Ok(projects) => projects,
            Err(e) => {
                eprintln!("项目注册表解析失败，已备份原文件: {}", e);
                let backup = path.with_extension("json.corrupt-backup");
                let _ = fs::rename(&path, &backup);
                Vec::new()
            }
        }
    } else {
        Vec::new()
    };

    let mut global = PROJECTS.lock().map_err(|e| e.to_string())?;
    *global = Some(projects);
    Ok(())
}

fn read_projects() -> Result<Vec<ProjectEntry>, String> {
    let global = PROJECTS.lock().map_err(|e| e.to_string())?;
    Ok(global.clone().unwrap_or_default())
}

fn save_projects(projects: &[ProjectEntry]) -> Result<(), String> {
    {
        let mut global = PROJECTS.lock().map_err(|e| e.to_string())?;
        *global = Some(projects.to_vec());
    }
    let path = get_projects_path()?;
    let json = serde_json::to_string_pretty(projects)
        .map_err(|e| format!("无法序列化项目注册表: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("无法写入项目注册表: {}", e))?;
    Ok(())
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn project_name(path: &str) -> String {
    PathBuf::from(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Register or refresh a project entry; returns the stored entry.
pub fn register_project_internal(
    path: &str,
    source: &str,
    touch_applied: bool,
) -> Result<ProjectEntry, String> {
    let dir = PathBuf::from(path);
    if !dir.is_dir() {
        return Err(format!("路径不是目录: {}", path));
    }

    let mut projects = read_projects()?;
    let now = now_iso();
    let entry = match projects.iter_mut().find(|p| p.path == path) {
        Some(existing) => {
            if touch_applied {
                existing.last_applied_at = Some(now.clone());
            }
            existing.clone()
        }
        None => {
            let entry = ProjectEntry {
                path: path.to_string(),
                name: project_name(path),
                source: source.to_string(),
                added_at: now.clone(),
                last_applied_at: if touch_applied { Some(now) } else { None },
            };
            projects.push(entry.clone());
            entry
        }
    };
    save_projects(&projects)?;
    Ok(entry)
}

#[tauri::command]
pub fn list_projects() -> Result<Vec<ProjectEntry>, String> {
    read_projects()
}

#[tauri::command]
pub fn register_project(path: String) -> Result<ProjectEntry, String> {
    register_project_internal(&path, "manual", false)
}

#[tauri::command]
pub fn remove_project(path: String) -> Result<(), String> {
    let mut projects = read_projects()?;
    let initial_len = projects.len();
    projects.retain(|p| p.path != path);
    if projects.len() == initial_len {
        return Err(format!("未登记的项目: {}", path));
    }
    save_projects(&projects)
}

/// Parsed view of a Claude Code config target (global or a project dir)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetConfigInfo {
    /// "global" or the project path
    pub target: String,
    /// which file the info was read from, e.g. "settings.local.json"
    pub source_file: Option<String>,
    pub full_path: Option<String>,
    pub model: Option<String>,
    pub tier_opus: Option<String>,
    pub tier_sonnet: Option<String>,
    pub tier_haiku: Option<String>,
    /// whether the file carries an API key / auth token (value never returned)
    pub has_secret: bool,
    /// file mtime as ISO string
    pub updated_at: Option<String>,
}

fn read_target_file(path: &std::path::Path) -> Option<(serde_json::Value, std::time::SystemTime)> {
    let content = fs::read_to_string(path).ok()?;
    let value: serde_json::Value = serde_json::from_str(&content).ok()?;
    let mtime = fs::metadata(path).and_then(|m| m.modified()).ok()?;
    Some((value, mtime))
}

fn env_str(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get("env")
        .and_then(|e| e.get(key))
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

fn build_target_info(target: &str, file_name: Option<&str>, path: &std::path::Path) -> TargetConfigInfo {
    let mut info = TargetConfigInfo {
        target: target.to_string(),
        // source_file is only reported when the file was actually read
        source_file: None,
        full_path: None,
        model: None,
        tier_opus: None,
        tier_sonnet: None,
        tier_haiku: None,
        has_secret: false,
        updated_at: None,
    };

    if let Some((value, mtime)) = read_target_file(path) {
        info.source_file = file_name.map(|s| s.to_string());
        info.full_path = Some(path.to_string_lossy().to_string());
        info.model = env_str(&value, "ANTHROPIC_MODEL")
            .or_else(|| value.get("model").and_then(|m| m.as_str()).map(|s| s.to_string()));
        info.tier_opus = env_str(&value, "ANTHROPIC_DEFAULT_OPUS_MODEL");
        info.tier_sonnet = env_str(&value, "ANTHROPIC_DEFAULT_SONNET_MODEL");
        info.tier_haiku = env_str(&value, "ANTHROPIC_DEFAULT_HAIKU_MODEL");
        info.has_secret = env_str(&value, "ANTHROPIC_API_KEY").is_some()
            || env_str(&value, "ANTHROPIC_AUTH_TOKEN").is_some();
        info.updated_at = mtime
            .duration_since(std::time::UNIX_EPOCH)
            .ok()
            .map(|d| {
                chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                    .map(|t| t.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
                    .unwrap_or_default()
            });
    }

    info
}

/// Create a new (empty) project directory under `parent` and register it.
/// If the directory already exists it is registered as-is.
#[tauri::command]
pub fn create_project_dir(parent: String, name: String) -> Result<ProjectEntry, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("项目名不能为空".to_string());
    }
    if name.contains('/') || name.contains('\\') || name == "." || name == ".." {
        return Err("项目名不能包含路径分隔符".to_string());
    }

    let dir = PathBuf::from(&parent).join(&name);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败: {}", e))?;
    } else if !dir.is_dir() {
        return Err(format!("目标已存在且不是目录: {}", dir.display()));
    }

    register_project_internal(dir.to_string_lossy().as_ref(), "manual", false)
}

/// Initialize a git repository in a project directory, but only when it is
/// safe: no existing repo, and no tracked-looking content that could be
/// swallowed by a fresh repo. Returns true when a repo was created.
#[tauri::command]
pub fn init_git_repo(path: String) -> Result<bool, String> {
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(format!("路径不是目录: {}", path));
    }
    if dir.join(".git").exists() {
        return Ok(false);
    }
    // Guard against initializing over an existing non-git project
    let has_content = fs::read_dir(&dir)
        .map_err(|e| format!("读取目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .any(|e| e.file_name() != ".claude");
    if has_content {
        return Err("目录非空且不是 git 仓库，为避免误纳已有文件，未执行 git init".to_string());
    }

    let output = std::process::Command::new("git")
        .arg("init")
        .current_dir(&dir)
        .output()
        .map_err(|e| format!("执行 git init 失败: {}", e))?;
    if !output.status.success() {
        return Err(format!(
            "git init 失败: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(true)
}

/// Open a Terminal.app window at the given directory (macOS), optionally starting Claude Code.
#[tauri::command]
pub fn open_terminal_at(path: String, launch_claude: Option<bool>) -> Result<(), String> {
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        return Err(format!("路径不是目录: {}", path));
    }
    let shell_path = path.replace('\'', "'\\''");
    let mut command = format!("cd '{}'", shell_path);
    if launch_claude.unwrap_or(false) {
        command.push_str(" && claude");
    }
    let escaped = command.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        "tell application \"Terminal\"\nactivate\ndo script \"{}\"\nend tell",
        escaped
    );
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| format!("调用 osascript 失败: {}", e))?;
    if !output.status.success() {
        return Err(format!(
            "打开终端失败: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

/// Read the effective Claude Code config of a target.
/// path=None → global ~/.claude/settings.json; otherwise <path>/.claude/,
/// with settings.local.json taking precedence over settings.json.
#[tauri::command]
pub fn scan_claude_target(path: Option<String>) -> Result<TargetConfigInfo, String> {
    match path {
        None => {
            let home = dirs::home_dir().ok_or("找不到主目录")?;
            let file = home.join(".claude").join("settings.json");
            Ok(build_target_info("global", Some("settings.json"), &file))
        }
        Some(project_path) => {
            let claude_dir = PathBuf::from(&project_path).join(".claude");
            let local = claude_dir.join("settings.local.json");
            let shared = claude_dir.join("settings.json");
            if local.exists() {
                Ok(build_target_info(&project_path, Some("settings.local.json"), &local))
            } else if shared.exists() {
                Ok(build_target_info(&project_path, Some("settings.json"), &shared))
            } else {
                Ok(build_target_info(&project_path, None, &shared))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("model-test-{}-{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn scan_prefers_local_settings_and_reads_tiers() {
        let dir = temp_dir("scan");
        let claude = dir.join(".claude");
        fs::create_dir_all(&claude).unwrap();
        fs::write(
            claude.join("settings.json"),
            r#"{"env":{"ANTHROPIC_MODEL":"shared-model"},"model":"shared-model"}"#,
        )
        .unwrap();
        fs::write(
            claude.join("settings.local.json"),
            r#"{"env":{"ANTHROPIC_MODEL":"local-model","ANTHROPIC_DEFAULT_HAIKU_MODEL":"tiny","ANTHROPIC_API_KEY":"sk-x"},"permissions":{"allow":[]}}"#,
        )
        .unwrap();

        let info = scan_claude_target(Some(dir.to_string_lossy().to_string())).unwrap();
        assert_eq!(info.source_file.as_deref(), Some("settings.local.json"));
        assert_eq!(info.model.as_deref(), Some("local-model"));
        assert_eq!(info.tier_haiku.as_deref(), Some("tiny"));
        assert!(info.has_secret);
        assert!(info.updated_at.is_some());

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn scan_reports_unconfigured_project() {
        let dir = temp_dir("scan-empty");
        let info = scan_claude_target(Some(dir.to_string_lossy().to_string())).unwrap();
        assert!(info.source_file.is_none());
        assert!(info.model.is_none());
        assert!(!info.has_secret);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn register_project_dedupes_by_path() {
        let dir = temp_dir("reg");
        register_project_internal(dir.to_str().unwrap(), "manual", false).unwrap();
        register_project_internal(dir.to_str().unwrap(), "export", true).unwrap();
        let projects = read_projects().unwrap();
        assert_eq!(projects.iter().filter(|p| p.path == dir.to_str().unwrap()).count(), 1);
        let entry = projects.iter().find(|p| p.path == dir.to_str().unwrap()).unwrap();
        assert!(entry.last_applied_at.is_some());
        // cleanup registry entry
        remove_project(dir.to_string_lossy().to_string()).unwrap();
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn init_git_repo_guards() {
        // empty dir → creates repo
        let empty = temp_dir("git-empty");
        assert!(init_git_repo(empty.to_string_lossy().to_string()).unwrap());
        assert!(empty.join(".git").exists());
        // existing repo → false, no error
        assert!(!init_git_repo(empty.to_string_lossy().to_string()).unwrap());

        // non-empty non-git dir → Err and no .git created
        let busy = temp_dir("git-busy");
        fs::write(busy.join("README.md"), "x").unwrap();
        assert!(init_git_repo(busy.to_string_lossy().to_string()).is_err());
        assert!(!busy.join(".git").exists());

        fs::remove_dir_all(&empty).unwrap();
        fs::remove_dir_all(&busy).unwrap();
    }

    #[test]
    fn create_project_dir_validates_name() {
        let parent = temp_dir("create-parent");
        assert!(create_project_dir(parent.to_string_lossy().to_string(), String::new()).is_err());
        assert!(create_project_dir(parent.to_string_lossy().to_string(), "a/b".to_string()).is_err());

        let entry =
            create_project_dir(parent.to_string_lossy().to_string(), "newproj".to_string()).unwrap();
        assert!(PathBuf::from(&entry.path).is_dir());

        // existing dir → registered as-is, same path
        let again =
            create_project_dir(parent.to_string_lossy().to_string(), "newproj".to_string()).unwrap();
        assert_eq!(again.path, entry.path);

        remove_project(entry.path.clone()).unwrap();
        fs::remove_dir_all(&parent).unwrap();
    }
}
