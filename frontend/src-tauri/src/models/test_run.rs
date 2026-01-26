use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RunStatus {
    Pending,
    Running,
    Passed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for RunStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RunStatus::Pending => write!(f, "pending"),
            RunStatus::Running => write!(f, "running"),
            RunStatus::Passed => write!(f, "passed"),
            RunStatus::Failed => write!(f, "failed"),
            RunStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl From<String> for RunStatus {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "running" => RunStatus::Running,
            "passed" | "success" => RunStatus::Passed,
            "failed" => RunStatus::Failed,
            "cancelled" => RunStatus::Cancelled,
            _ => RunStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TestRun {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub status: String,
    pub duration_ms: Option<i64>,
    pub passed: i32,
    pub failed: i32,
    pub skipped: i32,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTestRun {
    pub project_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTestRun {
    pub status: Option<String>,
    pub duration_ms: Option<i64>,
    pub passed: Option<i32>,
    pub failed: Option<i32>,
    pub skipped: Option<i32>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StepResult {
    pub id: String,
    pub test_run_id: String,
    pub step_id: String,
    pub test_case_id: String,
    pub status: String,
    pub duration_ms: Option<i64>,
    pub error_message: Option<String>,
    pub screenshot_path: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStepResult {
    pub test_run_id: String,
    pub step_id: String,
    pub test_case_id: String,
    pub status: String,
    pub duration_ms: Option<i64>,
    pub error_message: Option<String>,
    pub screenshot_path: Option<String>,
}

/// Summary statistics for a test run
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestRunSummary {
    pub total_runs: i64,
    pub passed_runs: i64,
    pub failed_runs: i64,
    pub avg_duration_ms: Option<f64>,
}

impl TestRun {
    pub fn new(data: CreateTestRun) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: format!("RUN-{}", &uuid::Uuid::new_v4().to_string()[..8].to_uppercase()),
            project_id: data.project_id,
            name: data.name,
            status: "pending".to_string(),
            duration_ms: None,
            passed: 0,
            failed: 0,
            skipped: 0,
            started_at: None,
            completed_at: None,
            created_at: now,
        }
    }
}

impl StepResult {
    pub fn new(data: CreateStepResult) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: format!("RES-{}", &uuid::Uuid::new_v4().to_string()[..8].to_uppercase()),
            test_run_id: data.test_run_id,
            step_id: data.step_id,
            test_case_id: data.test_case_id,
            status: data.status,
            duration_ms: data.duration_ms,
            error_message: data.error_message,
            screenshot_path: data.screenshot_path,
            created_at: now,
        }
    }
}
