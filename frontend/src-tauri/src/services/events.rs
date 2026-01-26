use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tokio_tungstenite::{connect_async, tungstenite::Message};

const TEST_RUNNER_WS_URL: &str = "ws://127.0.0.1:8002";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ExecutionEvent {
    #[serde(rename = "execution:started")]
    Started {
        execution_id: String,
        scenario_id: String,
        runner: String,
    },
    #[serde(rename = "execution:progress")]
    Progress {
        execution_id: String,
        progress: u32,
        current_step: String,
        step_index: u32,
        total_steps: u32,
    },
    #[serde(rename = "execution:step_completed")]
    StepCompleted {
        execution_id: String,
        step_index: u32,
        status: String,
        duration_ms: u64,
        screenshot: Option<String>,
    },
    #[serde(rename = "execution:completed")]
    Completed {
        execution_id: String,
        status: String,
        passed: u32,
        failed: u32,
        skipped: u32,
        duration_ms: u64,
    },
    #[serde(rename = "execution:failed")]
    Failed {
        execution_id: String,
        error: String,
    },
    #[serde(rename = "execution:log")]
    Log {
        execution_id: String,
        level: String,
        message: String,
        timestamp: String,
    },
}

#[derive(Debug, Clone)]
pub struct EventSubscription {
    pub execution_id: String,
    pub active: bool,
}

pub struct EventManager {
    subscriptions: Arc<RwLock<Vec<EventSubscription>>>,
}

impl EventManager {
    pub fn new() -> Self {
        Self {
            subscriptions: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn subscribe(&self, execution_id: String) {
        let mut subs = self.subscriptions.write().await;
        if !subs.iter().any(|s| s.execution_id == execution_id) {
            subs.push(EventSubscription {
                execution_id,
                active: true,
            });
        }
    }

    pub async fn unsubscribe(&self, execution_id: &str) {
        let mut subs = self.subscriptions.write().await;
        subs.retain(|s| s.execution_id != execution_id);
    }

    pub async fn is_subscribed(&self, execution_id: &str) -> bool {
        let subs = self.subscriptions.read().await;
        subs.iter().any(|s| s.execution_id == execution_id && s.active)
    }

    pub async fn get_active_subscriptions(&self) -> Vec<String> {
        let subs = self.subscriptions.read().await;
        subs.iter()
            .filter(|s| s.active)
            .map(|s| s.execution_id.clone())
            .collect()
    }
}

impl Default for EventManager {
    fn default() -> Self {
        Self::new()
    }
}

pub type EventManagerState = Arc<RwLock<EventManager>>;

/// Connect to the test runner WebSocket and forward events to the Tauri app
pub async fn connect_to_test_runner_events(
    app_handle: AppHandle,
    execution_id: String,
) -> Result<(), String> {
    let url = format!("{}/ws?execution_id={}", TEST_RUNNER_WS_URL, execution_id);

    let (ws_stream, _) = connect_async(&url)
        .await
        .map_err(|e| format!("Failed to connect to WebSocket: {}", e))?;

    let (mut _write, mut read) = ws_stream.split();

    log::info!("Connected to test runner WebSocket for execution: {}", execution_id);

    while let Some(message) = read.next().await {
        match message {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<ExecutionEvent>(&text) {
                    Ok(event) => {
                        // Emit the event to the frontend
                        let event_name = match &event {
                            ExecutionEvent::Started { .. } => "execution:started",
                            ExecutionEvent::Progress { .. } => "execution:progress",
                            ExecutionEvent::StepCompleted { .. } => "execution:step_completed",
                            ExecutionEvent::Completed { .. } => "execution:completed",
                            ExecutionEvent::Failed { .. } => "execution:failed",
                            ExecutionEvent::Log { .. } => "execution:log",
                        };

                        if let Err(e) = app_handle.emit(event_name, &event) {
                            log::error!("Failed to emit event: {}", e);
                        }

                        // If execution completed or failed, we can close the connection
                        match &event {
                            ExecutionEvent::Completed { .. } | ExecutionEvent::Failed { .. } => {
                                log::info!("Execution finished, closing WebSocket");
                                break;
                            }
                            _ => {}
                        }
                    }
                    Err(e) => {
                        log::warn!("Failed to parse WebSocket message: {}", e);
                    }
                }
            }
            Ok(Message::Close(_)) => {
                log::info!("WebSocket connection closed");
                break;
            }
            Err(e) => {
                log::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

/// Tauri command to subscribe to execution events
#[tauri::command]
pub async fn subscribe_to_execution(
    app_handle: AppHandle,
    execution_id: String,
) -> Result<(), String> {
    let execution_id_clone = execution_id.clone();

    // Spawn the WebSocket connection in a background task
    tauri::async_runtime::spawn(async move {
        if let Err(e) = connect_to_test_runner_events(app_handle, execution_id_clone).await {
            log::error!("WebSocket connection error: {}", e);
        }
    });

    Ok(())
}

/// Tauri command to emit a test event (for testing purposes)
#[tauri::command]
pub async fn emit_test_event(
    app_handle: AppHandle,
    event_type: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    app_handle
        .emit(&event_type, payload)
        .map_err(|e| format!("Failed to emit event: {}", e))
}
