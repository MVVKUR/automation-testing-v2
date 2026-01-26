use serde::{Deserialize, Serialize};
use std::process::Command;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[derive(Debug, Serialize, Deserialize)]
pub struct IosDevice {
    pub udid: String,
    pub name: String,
    pub state: String,
    pub runtime: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IosScreenSize {
    pub width: u32,
    pub height: u32,
}

/// List all iOS simulators
#[tauri::command]
pub async fn ios_list_devices() -> Result<Vec<IosDevice>, String> {
    let output = Command::new("xcrun")
        .args(["simctl", "list", "devices", "-j"])
        .output()
        .map_err(|e| format!("Failed to list iOS devices: {}", e))?;

    if !output.status.success() {
        return Err("Failed to list iOS devices".to_string());
    }

    let json_output: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse device list: {}", e))?;

    let mut devices = Vec::new();

    if let Some(device_types) = json_output["devices"].as_object() {
        for (runtime, runtime_devices) in device_types {
            if let Some(devices_array) = runtime_devices.as_array() {
                for device in devices_array {
                    let name = device["name"].as_str().unwrap_or("Unknown").to_string();
                    let udid = device["udid"].as_str().unwrap_or("").to_string();
                    let state = device["state"].as_str().unwrap_or("Unknown").to_string();

                    // Only include booted or shutdown devices (not unavailable)
                    if !udid.is_empty() && (state == "Booted" || state == "Shutdown") {
                        devices.push(IosDevice {
                            udid,
                            name,
                            state,
                            runtime: runtime.clone(),
                        });
                    }
                }
            }
        }
    }

    // Sort: Booted devices first
    devices.sort_by(|a, b| {
        if a.state == "Booted" && b.state != "Booted" {
            std::cmp::Ordering::Less
        } else if a.state != "Booted" && b.state == "Booted" {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(devices)
}

/// Take a screenshot from iOS simulator
#[tauri::command]
pub async fn ios_take_screenshot(device_id: Option<String>) -> Result<String, String> {
    let temp_file = std::env::temp_dir().join("ios_screenshot.png");

    let mut args = vec!["simctl", "io"];

    let device = device_id.as_deref().unwrap_or("booted");
    args.push(device);
    args.push("screenshot");

    let temp_path_str = temp_file.to_string_lossy().to_string();
    args.push(&temp_path_str);

    let output = Command::new("xcrun")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to take screenshot: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Screenshot failed: {}", error));
    }

    // Read and encode as base64
    let image_data = std::fs::read(&temp_file)
        .map_err(|e| format!("Failed to read screenshot: {}", e))?;

    let base64_data = BASE64.encode(&image_data);

    // Clean up
    let _ = std::fs::remove_file(&temp_file);

    Ok(base64_data)
}

/// Get iOS simulator screen size
#[tauri::command]
pub async fn ios_get_screen_size(device_id: Option<String>) -> Result<IosScreenSize, String> {
    // Take a screenshot and get dimensions from it
    let temp_file = std::env::temp_dir().join("ios_size_check.png");

    let mut args = vec!["simctl", "io"];
    let device = device_id.as_deref().unwrap_or("booted");
    args.push(device);
    args.push("screenshot");
    let temp_path_str = temp_file.to_string_lossy().to_string();
    args.push(&temp_path_str);

    let output = Command::new("xcrun")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to get screen size: {}", e))?;

    if !output.status.success() {
        return Err("Failed to get screen size".to_string());
    }

    // Use sips to get image dimensions
    let sips_output = Command::new("sips")
        .args(["-g", "pixelWidth", "-g", "pixelHeight", &temp_path_str])
        .output()
        .map_err(|e| format!("Failed to get dimensions: {}", e))?;

    let sips_str = String::from_utf8_lossy(&sips_output.stdout);

    let mut width = 0u32;
    let mut height = 0u32;

    for line in sips_str.lines() {
        if line.contains("pixelWidth") {
            if let Some(val) = line.split(':').last() {
                width = val.trim().parse().unwrap_or(0);
            }
        } else if line.contains("pixelHeight") {
            if let Some(val) = line.split(':').last() {
                height = val.trim().parse().unwrap_or(0);
            }
        }
    }

    // Clean up
    let _ = std::fs::remove_file(&temp_file);

    Ok(IosScreenSize { width, height })
}

/// Tap on iOS simulator screen
#[tauri::command]
pub async fn ios_tap(x: u32, y: u32, device_id: Option<String>) -> Result<bool, String> {
    // Method 1: Try using cliclick (requires knowing the simulator window position)
    // For now, we'll use a simpler approach with simctl spawn

    // Get the Simulator window and tap using cliclick
    // First, we need to convert device coordinates to screen coordinates

    // Activate Simulator app
    let _ = Command::new("osascript")
        .args(["-e", "tell application \"Simulator\" to activate"])
        .output();

    std::thread::sleep(std::time::Duration::from_millis(200));

    // Get window position using AppleScript
    let window_info = Command::new("osascript")
        .args(["-e", r#"
tell application "System Events"
    tell process "Simulator"
        set frontWin to front window
        set winPos to position of frontWin
        set winSize to size of frontWin
        return (item 1 of winPos as text) & "," & (item 2 of winPos as text) & "," & (item 1 of winSize as text) & "," & (item 2 of winSize as text)
    end tell
end tell
"#])
        .output();

    let (win_x, win_y, win_w, win_h) = if let Ok(output) = window_info {
        if output.status.success() {
            let info_str = String::from_utf8_lossy(&output.stdout);
            let parts: Vec<&str> = info_str.trim().split(',').collect();
            if parts.len() == 4 {
                (
                    parts[0].parse::<i32>().unwrap_or(0),
                    parts[1].parse::<i32>().unwrap_or(0),
                    parts[2].parse::<i32>().unwrap_or(0),
                    parts[3].parse::<i32>().unwrap_or(0),
                )
            } else {
                return Err("Failed to parse window info".to_string());
            }
        } else {
            return Err("AppleScript failed - accessibility permissions may be required".to_string());
        }
    } else {
        return Err("Failed to get window info".to_string());
    };

    // Get device screen size
    let screen_size = ios_get_screen_size(device_id.clone()).await?;

    // Calculate scale factor and convert coordinates
    let scale_x = win_w as f64 / screen_size.width as f64;
    let scale_y = win_h as f64 / screen_size.height as f64;

    // Account for window title bar (approximately 28 pixels on macOS)
    let title_bar_height = 28;

    let screen_x = win_x + (x as f64 * scale_x) as i32;
    let screen_y = win_y + title_bar_height + (y as f64 * scale_y) as i32;

    log::info!("iOS tap: device ({}, {}) -> screen ({}, {})", x, y, screen_x, screen_y);

    // Use cliclick to tap
    let output = Command::new("cliclick")
        .args([&format!("c:{},{}", screen_x, screen_y)])
        .output()
        .map_err(|e| format!("Failed to tap: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Tap failed: {}", error));
    }

    Ok(true)
}

/// Swipe on iOS simulator
#[tauri::command]
pub async fn ios_swipe(x1: u32, y1: u32, x2: u32, y2: u32, _duration_ms: Option<u32>, device_id: Option<String>) -> Result<bool, String> {
    // Activate Simulator
    let _ = Command::new("osascript")
        .args(["-e", "tell application \"Simulator\" to activate"])
        .output();

    std::thread::sleep(std::time::Duration::from_millis(200));

    // Get window info
    let window_info = Command::new("osascript")
        .args(["-e", r#"
tell application "System Events"
    tell process "Simulator"
        set frontWin to front window
        set winPos to position of frontWin
        set winSize to size of frontWin
        return (item 1 of winPos as text) & "," & (item 2 of winPos as text) & "," & (item 1 of winSize as text) & "," & (item 2 of winSize as text)
    end tell
end tell
"#])
        .output()
        .map_err(|e| format!("Failed to get window info: {}", e))?;

    if !window_info.status.success() {
        return Err("AppleScript failed - accessibility permissions may be required".to_string());
    }

    let info_str = String::from_utf8_lossy(&window_info.stdout);
    let parts: Vec<&str> = info_str.trim().split(',').collect();
    if parts.len() != 4 {
        return Err("Invalid window info".to_string());
    }

    let win_x = parts[0].parse::<i32>().unwrap_or(0);
    let win_y = parts[1].parse::<i32>().unwrap_or(0);
    let win_w = parts[2].parse::<i32>().unwrap_or(0);
    let win_h = parts[3].parse::<i32>().unwrap_or(0);

    let screen_size = ios_get_screen_size(device_id).await?;

    let scale_x = win_w as f64 / screen_size.width as f64;
    let scale_y = win_h as f64 / screen_size.height as f64;
    let title_bar_height = 28;

    let screen_x1 = win_x + (x1 as f64 * scale_x) as i32;
    let screen_y1 = win_y + title_bar_height + (y1 as f64 * scale_y) as i32;
    let screen_x2 = win_x + (x2 as f64 * scale_x) as i32;
    let screen_y2 = win_y + title_bar_height + (y2 as f64 * scale_y) as i32;

    // Use cliclick for drag
    let output = Command::new("cliclick")
        .args([
            &format!("dd:{},{}", screen_x1, screen_y1),
            &format!("du:{},{}", screen_x2, screen_y2),
        ])
        .output()
        .map_err(|e| format!("Failed to swipe: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Swipe failed: {}", error));
    }

    Ok(true)
}

/// Input text on iOS simulator
#[tauri::command]
pub async fn ios_input_text(text: String, device_id: Option<String>) -> Result<bool, String> {
    // Copy text to pasteboard and paste
    let mut args = vec!["simctl", "pbcopy"];
    let device = device_id.as_deref().unwrap_or("booted");
    args.insert(2, device);

    let output = Command::new("xcrun")
        .args(["simctl", "pbcopy", device])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to copy to pasteboard: {}", e))?;

    if let Some(mut stdin) = output.stdin {
        use std::io::Write;
        stdin.write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write to pasteboard: {}", e))?;
    }

    // Wait a bit for pasteboard
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Paste using keyboard shortcut
    let _ = Command::new("osascript")
        .args(["-e", r#"
tell application "Simulator"
    activate
end tell
delay 0.1
tell application "System Events"
    keystroke "v" using command down
end tell
"#])
        .output();

    Ok(true)
}

/// Press home button on iOS simulator
#[tauri::command]
pub async fn ios_press_home(device_id: Option<String>) -> Result<bool, String> {
    let device = device_id.as_deref().unwrap_or("booted");

    let output = Command::new("xcrun")
        .args(["simctl", "ui", device, "home"])
        .output()
        .map_err(|e| format!("Failed to press home: {}", e))?;

    Ok(output.status.success())
}

/// Launch an app on iOS simulator
#[tauri::command]
pub async fn ios_launch_app(bundle_id: String, device_id: Option<String>) -> Result<bool, String> {
    let device = device_id.as_deref().unwrap_or("booted");

    let output = Command::new("xcrun")
        .args(["simctl", "launch", device, &bundle_id])
        .output()
        .map_err(|e| format!("Failed to launch app: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Launch failed: {}", error));
    }

    Ok(true)
}

/// Terminate an app on iOS simulator
#[tauri::command]
pub async fn ios_terminate_app(bundle_id: String, device_id: Option<String>) -> Result<bool, String> {
    let device = device_id.as_deref().unwrap_or("booted");

    let output = Command::new("xcrun")
        .args(["simctl", "terminate", device, &bundle_id])
        .output()
        .map_err(|e| format!("Failed to terminate app: {}", e))?;

    Ok(output.status.success())
}

/// List installed apps on iOS simulator
#[tauri::command]
pub async fn ios_list_apps(device_id: Option<String>) -> Result<Vec<String>, String> {
    let device = device_id.as_deref().unwrap_or("booted");

    let output = Command::new("xcrun")
        .args(["simctl", "listapps", device])
        .output()
        .map_err(|e| format!("Failed to list apps: {}", e))?;

    if !output.status.success() {
        return Err("Failed to list apps".to_string());
    }

    // Parse the plist output to get bundle IDs
    // Format: "com.apple.Health" = {
    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut bundle_ids = Vec::new();
    let mut system_apps = Vec::new();

    // Common system apps useful for testing
    let useful_system_apps = [
        "com.apple.mobilesafari",
        "com.apple.Preferences",
        "com.apple.Maps",
        "com.apple.MobileSMS",
        "com.apple.mobilephone",
        "com.apple.calculator",
        "com.apple.camera",
        "com.apple.DocumentsApp",
        "com.apple.mobilenotes",
        "com.apple.reminders",
    ];

    for line in output_str.lines() {
        let trimmed = line.trim();
        // Look for lines like: "com.example.app" = {
        if trimmed.starts_with('"') && trimmed.contains("\" =") {
            // Extract the bundle ID between quotes
            if let Some(end_quote) = trimmed[1..].find('"') {
                let bundle_id = &trimmed[1..end_quote + 1];

                if !bundle_id.starts_with("com.apple.") {
                    // Third-party app - add to main list
                    bundle_ids.push(bundle_id.to_string());
                } else if useful_system_apps.contains(&bundle_id) {
                    // Useful system app - add to separate list
                    system_apps.push(bundle_id.to_string());
                }
            }
        }
    }

    // Sort: third-party apps first, then system apps
    bundle_ids.sort();
    system_apps.sort();
    bundle_ids.extend(system_apps);

    Ok(bundle_ids)
}

/// Boot an iOS simulator
#[tauri::command]
pub async fn ios_boot_device(device_id: String) -> Result<bool, String> {
    let output = Command::new("xcrun")
        .args(["simctl", "boot", &device_id])
        .output()
        .map_err(|e| format!("Failed to boot device: {}", e))?;

    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr);
        // Ignore "already booted" error
        if !error.contains("already booted") {
            return Err(format!("Boot failed: {}", error));
        }
    }

    Ok(true)
}

/// Shutdown an iOS simulator
#[tauri::command]
pub async fn ios_shutdown_device(device_id: String) -> Result<bool, String> {
    let output = Command::new("xcrun")
        .args(["simctl", "shutdown", &device_id])
        .output()
        .map_err(|e| format!("Failed to shutdown device: {}", e))?;

    Ok(output.status.success())
}
