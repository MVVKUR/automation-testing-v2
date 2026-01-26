use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Critical,
    High,
    Medium,
    Low,
}

impl std::fmt::Display for Priority {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Priority::Critical => write!(f, "Critical"),
            Priority::High => write!(f, "High"),
            Priority::Medium => write!(f, "Medium"),
            Priority::Low => write!(f, "Low"),
        }
    }
}

impl From<String> for Priority {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "critical" => Priority::Critical,
            "high" => Priority::High,
            "low" => Priority::Low,
            _ => Priority::Medium,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TestType {
    Automated,
    Manual,
}

impl std::fmt::Display for TestType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TestType::Automated => write!(f, "Automated"),
            TestType::Manual => write!(f, "Manual"),
        }
    }
}

impl From<String> for TestType {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "manual" => TestType::Manual,
            _ => TestType::Automated,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TestStatus {
    Pending,
    Success,
    Failed,
    Warning,
    Running,
    Skipped,
}

impl std::fmt::Display for TestStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TestStatus::Pending => write!(f, "pending"),
            TestStatus::Success => write!(f, "success"),
            TestStatus::Failed => write!(f, "failed"),
            TestStatus::Warning => write!(f, "warning"),
            TestStatus::Running => write!(f, "running"),
            TestStatus::Skipped => write!(f, "skipped"),
        }
    }
}

impl From<String> for TestStatus {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "success" | "passed" => TestStatus::Success,
            "failed" => TestStatus::Failed,
            "warning" => TestStatus::Warning,
            "running" => TestStatus::Running,
            "skipped" => TestStatus::Skipped,
            _ => TestStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TestCase {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub priority: String,
    pub test_type: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTestCase {
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub priority: Option<String>,
    pub test_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTestCase {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub priority: Option<String>,
    pub test_type: Option<String>,
    pub status: Option<String>,
}

impl TestCase {
    pub fn new(data: CreateTestCase) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: format!("TC-{}", &uuid::Uuid::new_v4().to_string()[..8].to_uppercase()),
            project_id: data.project_id,
            name: data.name,
            description: data.description,
            category: data.category,
            priority: data.priority.unwrap_or_else(|| "Medium".to_string()),
            test_type: data.test_type.unwrap_or_else(|| "Automated".to_string()),
            status: "pending".to_string(),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}
