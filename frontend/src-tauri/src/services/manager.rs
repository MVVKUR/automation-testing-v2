use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::async_runtime::JoinHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfig {
    pub name: String,
    pub port: u16,
    pub host: String,
    pub health_endpoint: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

impl Default for ServiceConfig {
    fn default() -> Self {
        Self {
            name: String::new(),
            port: 0,
            host: "127.0.0.1".to_string(),
            health_endpoint: "/health".to_string(),
            command: String::new(),
            args: Vec::new(),
            env: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ServiceStatus {
    Stopped,
    Starting,
    Running,
    Unhealthy,
    Stopping,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceState {
    pub status: ServiceStatus,
    pub pid: Option<u32>,
    pub uptime_secs: Option<u64>,
    pub last_health_check: Option<i64>,
    pub error_message: Option<String>,
}

impl Default for ServiceState {
    fn default() -> Self {
        Self {
            status: ServiceStatus::Stopped,
            pid: None,
            uptime_secs: None,
            last_health_check: None,
            error_message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceInfo {
    pub config: ServiceConfig,
    pub state: ServiceState,
}

pub struct ServiceManager {
    services: Arc<RwLock<HashMap<String, ServiceInfo>>>,
    handles: Arc<RwLock<HashMap<String, JoinHandle<()>>>>,
}

impl ServiceManager {
    pub fn new() -> Self {
        Self {
            services: Arc::new(RwLock::new(HashMap::new())),
            handles: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn register_service(&self, config: ServiceConfig) {
        let mut services = self.services.write().await;
        let name = config.name.clone();
        services.insert(
            name,
            ServiceInfo {
                config,
                state: ServiceState::default(),
            },
        );
    }

    pub async fn get_service(&self, name: &str) -> Option<ServiceInfo> {
        let services = self.services.read().await;
        services.get(name).cloned()
    }

    pub async fn get_all_services(&self) -> Vec<ServiceInfo> {
        let services = self.services.read().await;
        services.values().cloned().collect()
    }

    pub async fn update_status(&self, name: &str, status: ServiceStatus) {
        let mut services = self.services.write().await;
        if let Some(service) = services.get_mut(name) {
            service.state.status = status;
        }
    }

    pub async fn update_state(&self, name: &str, state: ServiceState) {
        let mut services = self.services.write().await;
        if let Some(service) = services.get_mut(name) {
            service.state = state;
        }
    }

    pub async fn set_error(&self, name: &str, error: String) {
        let mut services = self.services.write().await;
        if let Some(service) = services.get_mut(name) {
            service.state.status = ServiceStatus::Error;
            service.state.error_message = Some(error);
        }
    }

    pub async fn store_handle(&self, name: String, handle: JoinHandle<()>) {
        let mut handles = self.handles.write().await;
        handles.insert(name, handle);
    }

    pub async fn remove_handle(&self, name: &str) -> Option<JoinHandle<()>> {
        let mut handles = self.handles.write().await;
        handles.remove(name)
    }
}

impl Default for ServiceManager {
    fn default() -> Self {
        Self::new()
    }
}

// Default service configurations
pub fn get_ai_agent_config() -> ServiceConfig {
    let mut env = HashMap::new();
    env.insert("HOST".to_string(), "127.0.0.1".to_string());
    env.insert("PORT".to_string(), "8001".to_string());

    ServiceConfig {
        name: "ai-agent".to_string(),
        port: 8001,
        host: "127.0.0.1".to_string(),
        health_endpoint: "/health".to_string(),
        command: "python3".to_string(),
        args: vec!["-m".to_string(), "uvicorn".to_string(), "src.main:app".to_string(), "--host".to_string(), "127.0.0.1".to_string(), "--port".to_string(), "8001".to_string()],
        env,
    }
}

pub fn get_test_runner_config() -> ServiceConfig {
    let mut env = HashMap::new();
    env.insert("PORT".to_string(), "8002".to_string());
    env.insert("NODE_ENV".to_string(), "production".to_string());

    ServiceConfig {
        name: "test-runner".to_string(),
        port: 8002,
        host: "127.0.0.1".to_string(),
        health_endpoint: "/api/health".to_string(),
        command: "node".to_string(),
        args: vec!["dist/index.js".to_string()],
        env,
    }
}
