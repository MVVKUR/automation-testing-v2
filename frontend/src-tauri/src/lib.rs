use serde::{Deserialize, Serialize};
use tauri::Manager;
use std::sync::Arc;
use tokio::sync::RwLock;

pub mod commands;
pub mod db;
pub mod models;
pub mod services;

use commands::*;
use services::manager::{ServiceManager, get_ai_agent_config, get_test_runner_config};

// App info command
#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "AutoTest AI".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[derive(Serialize, Deserialize)]
struct AppInfo {
    name: String,
    version: String,
    platform: String,
    arch: String,
}

// Greet command (for testing)
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to AutoTest AI.", name)
}

// Platform check
#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

// Get database path command
#[tauri::command]
fn get_db_path() -> Result<String, String> {
    db::get_db_path()
        .map(|p| p.display().to_string())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables from .env file
    if let Err(e) = dotenvy::dotenv() {
        log::warn!("No .env file found or error loading it: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Setup logging in debug mode
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            log::info!("AutoTest AI starting...");

            // Initialize service manager
            let service_manager = Arc::new(RwLock::new(ServiceManager::new()));

            // Register services
            let sm = service_manager.clone();
            tauri::async_runtime::spawn(async move {
                let manager = sm.write().await;
                manager.register_service(get_ai_agent_config()).await;
                manager.register_service(get_test_runner_config()).await;
                log::info!("Services registered");
            });

            app.manage(service_manager);

            // Initialize database in a background task
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match db::init_pool().await {
                    Ok(pool) => {
                        log::info!("Database initialized successfully");
                        handle.manage(pool);
                    }
                    Err(e) => {
                        log::error!("Failed to initialize database: {}", e);
                    }
                }
            });

            log::info!("AutoTest AI started");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // App info
            get_app_info,
            greet,
            get_platform,
            get_db_path,
            // Project commands
            create_project,
            get_project,
            list_projects,
            update_project,
            delete_project,
            search_projects,
            // Test case commands
            create_test_case,
            get_test_case,
            list_test_cases,
            list_test_cases_by_project,
            update_test_case,
            update_test_case_status,
            delete_test_case,
            get_test_case_stats,
            // Scenario commands
            create_scenario,
            get_scenario,
            get_scenario_with_steps,
            list_scenarios_by_test_case,
            update_scenario,
            delete_scenario,
            duplicate_scenario,
            // Step commands
            create_step,
            get_step,
            list_steps_by_scenario,
            update_step,
            update_step_config,
            delete_step,
            reorder_steps,
            bulk_create_steps,
            bulk_delete_steps,
            // Test run commands
            create_test_run,
            get_test_run,
            list_test_runs,
            update_test_run,
            start_test_run,
            complete_test_run,
            delete_test_run,
            get_test_run_summary,
            create_step_result,
            list_step_results,
            // Service management commands
            get_services_status,
            check_service_health,
            check_all_services_health,
            get_service_urls,
            // AI Agent commands
            ai_analyze_code,
            ai_generate_tests,
            ai_parse_requirements,
            ai_check_available,
            // Test Runner commands
            runner_execute_tests,
            runner_get_execution,
            runner_cancel_execution,
            runner_generate_spec,
            runner_get_queue_stats,
            runner_check_available,
            // Jira integration commands
            jira_get_issue,
            jira_create_issue,
            jira_search_issues,
            // GitHub integration commands
            github_get_issue,
            github_create_issue,
            github_list_issues,
            github_get_pull_request,
            // Real-time event commands
            services::events::subscribe_to_execution,
            services::events::emit_test_event,
            // ADB commands for Android device control
            adb_list_devices,
            adb_take_screenshot,
            adb_get_screen_size,
            adb_tap,
            adb_swipe,
            adb_input_text,
            adb_keyevent,
            adb_launch_app,
            adb_stop_app,
            adb_list_packages,
            adb_install_apk,
            adb_clear_app_data,
            adb_dump_ui,
            adb_press_back,
            adb_press_home,
            adb_press_enter,
            adb_long_press,
            // AI Screenshot Analysis commands (Mobile)
            ai_analyze_screen,
            ai_suggest_next_step,
            ai_find_element_coordinates,
            // AI Web Automation commands
            ai_analyze_web_page,
            ai_find_web_element,
            ai_suggest_web_step,
            // iOS Simulator commands
            ios_list_devices,
            ios_take_screenshot,
            ios_get_screen_size,
            ios_tap,
            ios_swipe,
            ios_input_text,
            ios_press_home,
            ios_launch_app,
            ios_terminate_app,
            ios_list_apps,
            ios_boot_device,
            ios_shutdown_device,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
