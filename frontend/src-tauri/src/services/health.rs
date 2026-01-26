use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use chrono::Utc;
use futures_util::future::join_all;

use super::manager::{ServiceConfig, ServiceStatus, ServiceState};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckResponse {
    pub status: String,
    pub service: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub name: String,
    pub status: ServiceStatus,
    pub response_time_ms: Option<u64>,
    pub details: Option<HealthCheckResponse>,
    pub error: Option<String>,
    pub checked_at: i64,
}

pub struct HealthChecker {
    client: Client,
}

impl HealthChecker {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .expect("Failed to create HTTP client");

        Self { client }
    }

    pub async fn check_service(&self, config: &ServiceConfig) -> ServiceHealth {
        let url = format!(
            "http://{}:{}{}",
            config.host, config.port, config.health_endpoint
        );

        let start = std::time::Instant::now();
        let checked_at = Utc::now().timestamp();

        match self.client.get(&url).send().await {
            Ok(response) => {
                let response_time = start.elapsed().as_millis() as u64;

                if response.status().is_success() {
                    let details = response.json::<HealthCheckResponse>().await.ok();
                    ServiceHealth {
                        name: config.name.clone(),
                        status: ServiceStatus::Running,
                        response_time_ms: Some(response_time),
                        details,
                        error: None,
                        checked_at,
                    }
                } else {
                    ServiceHealth {
                        name: config.name.clone(),
                        status: ServiceStatus::Unhealthy,
                        response_time_ms: Some(response_time),
                        details: None,
                        error: Some(format!("HTTP {}", response.status())),
                        checked_at,
                    }
                }
            }
            Err(e) => {
                let error_msg = if e.is_connect() {
                    "Connection refused - service not running".to_string()
                } else if e.is_timeout() {
                    "Health check timed out".to_string()
                } else {
                    e.to_string()
                };

                ServiceHealth {
                    name: config.name.clone(),
                    status: ServiceStatus::Stopped,
                    response_time_ms: None,
                    details: None,
                    error: Some(error_msg),
                    checked_at,
                }
            }
        }
    }

    pub async fn check_all_services(&self, configs: &[ServiceConfig]) -> Vec<ServiceHealth> {
        let futures: Vec<_> = configs
            .iter()
            .map(|config| self.check_service(config))
            .collect();

        join_all(futures).await
    }

    pub fn health_to_state(&self, health: &ServiceHealth) -> ServiceState {
        ServiceState {
            status: health.status,
            pid: None,
            uptime_secs: None,
            last_health_check: Some(health.checked_at),
            error_message: health.error.clone(),
        }
    }
}

impl Default for HealthChecker {
    fn default() -> Self {
        Self::new()
    }
}
