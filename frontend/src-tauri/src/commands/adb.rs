use serde::{Deserialize, Serialize};
use std::process::Command;
use std::env;
use std::path::PathBuf;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// Find the ADB executable path
fn get_adb_path() -> String {
    // Try common ADB locations
    let home = env::var("HOME").unwrap_or_default();

    let possible_paths = vec![
        format!("{}/Library/Android/sdk/platform-tools/adb", home), // macOS default
        format!("{}/Android/Sdk/platform-tools/adb", home), // Linux default
        "/usr/local/bin/adb".to_string(),
        "/opt/homebrew/bin/adb".to_string(),
        "adb".to_string(), // Fall back to PATH
    ];

    for path in possible_paths {
        let path_buf = PathBuf::from(&path);
        if path_buf.exists() || path == "adb" {
            return path;
        }
    }

    // Default to just "adb" and hope it's in PATH
    "adb".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdbDevice {
    pub serial: String,
    pub state: String,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledApp {
    pub package_name: String,
    pub app_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenInfo {
    pub width: u32,
    pub height: u32,
}

/// List connected ADB devices
#[tauri::command]
pub async fn adb_list_devices() -> Result<Vec<AdbDevice>, String> {
    let output = Command::new(&get_adb_path())
        .args(["devices", "-l"])
        .output()
        .map_err(|e| format!("Failed to execute adb: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB command failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut devices = Vec::new();

    for line in stdout.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let serial = parts[0].to_string();
            let state = parts[1].to_string();

            // Extract model if available
            let model = parts.iter()
                .find(|p| p.starts_with("model:"))
                .map(|p| p.replace("model:", ""));

            devices.push(AdbDevice {
                serial,
                state,
                model,
            });
        }
    }

    Ok(devices)
}

/// Take a screenshot from the Android device and return as base64
#[tauri::command]
pub async fn adb_take_screenshot(device_id: Option<String>) -> Result<String, String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s");
        args.push(id);
    }

    args.extend(["exec-out", "screencap", "-p"]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute adb screencap: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB screencap failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Return base64 encoded PNG
    let base64_image = BASE64.encode(&output.stdout);
    Ok(format!("data:image/png;base64,{}", base64_image))
}

/// Get screen dimensions
#[tauri::command]
pub async fn adb_get_screen_size(device_id: Option<String>) -> Result<ScreenInfo, String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s");
        args.push(id);
    }

    args.extend(["shell", "wm", "size"]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to get screen size: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB command failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    // Parse "Physical size: 1080x1920" or "Override size: 1080x1920"
    for line in stdout.lines() {
        if line.contains("size:") {
            if let Some(size_part) = line.split(':').nth(1) {
                let dimensions: Vec<&str> = size_part.trim().split('x').collect();
                if dimensions.len() == 2 {
                    let width = dimensions[0].parse::<u32>().unwrap_or(1080);
                    let height = dimensions[1].parse::<u32>().unwrap_or(1920);
                    return Ok(ScreenInfo { width, height });
                }
            }
        }
    }

    // Default dimensions if parsing fails
    Ok(ScreenInfo { width: 1080, height: 1920 })
}

/// Execute tap at coordinates
#[tauri::command]
pub async fn adb_tap(device_id: Option<String>, x: u32, y: u32) -> Result<(), String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    args.extend([
        "shell".to_string(),
        "input".to_string(),
        "tap".to_string(),
        x.to_string(),
        y.to_string(),
    ]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute tap: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB tap failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// Execute swipe gesture
#[tauri::command]
pub async fn adb_swipe(
    device_id: Option<String>,
    x1: u32,
    y1: u32,
    x2: u32,
    y2: u32,
    duration_ms: Option<u32>,
) -> Result<(), String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    args.extend([
        "shell".to_string(),
        "input".to_string(),
        "swipe".to_string(),
        x1.to_string(),
        y1.to_string(),
        x2.to_string(),
        y2.to_string(),
    ]);

    if let Some(duration) = duration_ms {
        args.push(duration.to_string());
    }

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute swipe: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB swipe failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// Input text
#[tauri::command]
pub async fn adb_input_text(device_id: Option<String>, text: String) -> Result<(), String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    // Escape special characters for shell
    let escaped_text = text
        .replace('\\', "\\\\")
        .replace(' ', "%s")
        .replace('\'', "\\'")
        .replace('"', "\\\"")
        .replace('&', "\\&")
        .replace('|', "\\|")
        .replace('<', "\\<")
        .replace('>', "\\>")
        .replace('(', "\\(")
        .replace(')', "\\)");

    args.extend([
        "shell".to_string(),
        "input".to_string(),
        "text".to_string(),
        escaped_text,
    ]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to input text: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB input text failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// Send key event
#[tauri::command]
pub async fn adb_keyevent(device_id: Option<String>, keycode: String) -> Result<(), String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    args.extend([
        "shell".to_string(),
        "input".to_string(),
        "keyevent".to_string(),
        keycode,
    ]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to send keyevent: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB keyevent failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// Launch an app by package name
#[tauri::command]
pub async fn adb_launch_app(device_id: Option<String>, package_name: String) -> Result<(), String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    args.extend([
        "shell".to_string(),
        "monkey".to_string(),
        "-p".to_string(),
        package_name,
        "-c".to_string(),
        "android.intent.category.LAUNCHER".to_string(),
        "1".to_string(),
    ]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to launch app: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB launch app failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// Stop an app
#[tauri::command]
pub async fn adb_stop_app(device_id: Option<String>, package_name: String) -> Result<(), String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    args.extend([
        "shell".to_string(),
        "am".to_string(),
        "force-stop".to_string(),
        package_name,
    ]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to stop app: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB stop app failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// List installed packages
#[tauri::command]
pub async fn adb_list_packages(device_id: Option<String>, third_party_only: bool) -> Result<Vec<InstalledApp>, String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s");
        args.push(id);
    }

    args.push("shell");
    args.push("pm");
    args.push("list");
    args.push("packages");

    if third_party_only {
        args.push("-3"); // Only third-party apps
    }

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to list packages: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB list packages failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let apps: Vec<InstalledApp> = stdout
        .lines()
        .filter_map(|line| {
            line.strip_prefix("package:")
                .map(|pkg| InstalledApp {
                    package_name: pkg.trim().to_string(),
                    app_name: None, // Would need additional query to get app name
                })
        })
        .collect();

    Ok(apps)
}

/// Install APK
#[tauri::command]
pub async fn adb_install_apk(device_id: Option<String>, apk_path: String) -> Result<(), String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    args.extend([
        "install".to_string(),
        "-r".to_string(), // Replace existing app
        apk_path,
    ]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to install APK: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB install failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// Clear app data
#[tauri::command]
pub async fn adb_clear_app_data(device_id: Option<String>, package_name: String) -> Result<(), String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    args.extend([
        "shell".to_string(),
        "pm".to_string(),
        "clear".to_string(),
        package_name,
    ]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to clear app data: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB clear app data failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

/// Get UI hierarchy dump (for element detection)
#[tauri::command]
pub async fn adb_dump_ui(device_id: Option<String>) -> Result<String, String> {
    let mut args = vec![];

    if let Some(ref id) = device_id {
        args.push("-s".to_string());
        args.push(id.clone());
    }

    // Dump UI hierarchy to device
    args.extend([
        "shell".to_string(),
        "uiautomator".to_string(),
        "dump".to_string(),
        "/sdcard/ui_dump.xml".to_string(),
    ]);

    let output = Command::new(&get_adb_path())
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to dump UI: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ADB UI dump failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Read the dump file
    let mut read_args = vec![];
    if let Some(ref id) = device_id {
        read_args.push("-s".to_string());
        read_args.push(id.clone());
    }
    read_args.extend([
        "shell".to_string(),
        "cat".to_string(),
        "/sdcard/ui_dump.xml".to_string(),
    ]);

    let read_output = Command::new(&get_adb_path())
        .args(&read_args)
        .output()
        .map_err(|e| format!("Failed to read UI dump: {}", e))?;

    if !read_output.status.success() {
        return Err(format!(
            "Failed to read UI dump: {}",
            String::from_utf8_lossy(&read_output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&read_output.stdout).to_string())
}

/// Press back button
#[tauri::command]
pub async fn adb_press_back(device_id: Option<String>) -> Result<(), String> {
    adb_keyevent(device_id, "KEYCODE_BACK".to_string()).await
}

/// Press home button
#[tauri::command]
pub async fn adb_press_home(device_id: Option<String>) -> Result<(), String> {
    adb_keyevent(device_id, "KEYCODE_HOME".to_string()).await
}

/// Press enter key
#[tauri::command]
pub async fn adb_press_enter(device_id: Option<String>) -> Result<(), String> {
    adb_keyevent(device_id, "KEYCODE_ENTER".to_string()).await
}

/// Long press at coordinates
#[tauri::command]
pub async fn adb_long_press(device_id: Option<String>, x: u32, y: u32, duration_ms: Option<u32>) -> Result<(), String> {
    // Long press is implemented as a swipe from point to same point with duration
    let duration = duration_ms.unwrap_or(1000);
    adb_swipe(device_id, x, y, x, y, Some(duration)).await
}
