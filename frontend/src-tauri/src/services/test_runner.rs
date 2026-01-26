use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const TEST_RUNNER_BASE_URL: &str = "http://127.0.0.1:8002";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunTestsRequest {
    pub scenario_id: String,
    pub runner: String, // "cypress" or "playwright"
    pub browser: Option<String>,
    pub headless: Option<bool>,
    pub timeout: Option<u32>,
    pub env_vars: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunTestsResponse {
    pub execution_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionStatus {
    pub id: String,
    pub status: String, // "queued", "running", "completed", "failed"
    pub progress: Option<u32>,
    pub current_step: Option<String>,
    pub results: Option<ExecutionResults>,
    pub error: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResults {
    pub total_tests: u32,
    pub passed: u32,
    pub failed: u32,
    pub skipped: u32,
    pub duration_ms: u64,
    pub artifacts: Vec<Artifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub artifact_type: String, // "screenshot", "video", "log"
    pub name: String,
    pub path: String,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateSpecRequest {
    pub scenario_id: String,
    pub steps: Vec<ScenarioStep>,
    pub runner: String,
    pub options: Option<SpecOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioStep {
    pub order: u32,
    pub action: String,
    pub selector: Option<String>,
    pub value: Option<String>,
    pub config: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpecOptions {
    pub base_url: Option<String>,
    pub timeout: Option<u32>,
    pub retry_count: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateSpecResponse {
    pub spec_code: String,
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStats {
    pub waiting: u32,
    pub active: u32,
    pub completed: u32,
    pub failed: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestRunListItem {
    pub id: String,
    pub scenario_id: String,
    pub status: String,
    pub runner: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub passed: Option<u32>,
    pub failed: Option<u32>,
}

pub struct TestRunnerClient {
    client: Client,
    base_url: String,
}

impl TestRunnerClient {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: TEST_RUNNER_BASE_URL.to_string(),
        }
    }

    pub fn with_base_url(base_url: &str) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: base_url.to_string(),
        }
    }

    pub async fn run_tests(&self, request: RunTestsRequest) -> Result<RunTestsResponse, String> {
        let url = format!("{}/api/run", self.base_url);

        self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn get_execution(&self, execution_id: &str) -> Result<ExecutionStatus, String> {
        let url = format!("{}/api/executions/{}", self.base_url, execution_id);

        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn list_executions(&self, limit: Option<u32>) -> Result<Vec<TestRunListItem>, String> {
        let mut url = format!("{}/api/executions", self.base_url);
        if let Some(limit) = limit {
            url = format!("{}?limit={}", url, limit);
        }

        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn cancel_execution(&self, execution_id: &str) -> Result<(), String> {
        let url = format!("{}/api/executions/{}/cancel", self.base_url, execution_id);

        let response = self.client
            .post(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if response.status().is_success() {
            Ok(())
        } else {
            Err(format!("Failed to cancel execution: HTTP {}", response.status()))
        }
    }

    pub async fn generate_spec(&self, request: GenerateSpecRequest) -> Result<GenerateSpecResponse, String> {
        let url = format!("{}/api/generate-spec", self.base_url);

        self.client
            .post(&url)
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn get_queue_stats(&self) -> Result<QueueStats, String> {
        let url = format!("{}/api/queue/stats", self.base_url);

        self.client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn is_available(&self) -> bool {
        let url = format!("{}/api/health", self.base_url);
        self.client.get(&url).send().await.map(|r| r.status().is_success()).unwrap_or(false)
    }
}

impl Default for TestRunnerClient {
    fn default() -> Self {
        Self::new()
    }
}
