use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum TestCasePriority {
    Low,
    Medium,
    High,
    Critical,
}

impl Default for TestCasePriority {
    fn default() -> Self {
        Self::Medium
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "varchar", rename_all = "lowercase")]
pub enum TestCaseStatus {
    Draft,
    Active,
    Archived,
}

impl Default for TestCaseStatus {
    fn default() -> Self {
        Self::Draft
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TestCase {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub priority: String,
    pub status: String,
    pub tags: Vec<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestCaseResponse {
    pub id: Uuid,
    pub project_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub priority: String,
    pub status: String,
    pub tags: Vec<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<TestCase> for TestCaseResponse {
    fn from(tc: TestCase) -> Self {
        Self {
            id: tc.id,
            project_id: tc.project_id,
            name: tc.name,
            description: tc.description,
            priority: tc.priority,
            status: tc.status,
            tags: tc.tags,
            created_by: tc.created_by,
            created_at: tc.created_at,
            updated_at: tc.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateTestCaseRequest {
    #[validate(length(min = 1, max = 255, message = "Name must be between 1 and 255 characters"))]
    pub name: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateTestCaseRequest {
    #[validate(length(min = 1, max = 255, message = "Name must be between 1 and 255 characters"))]
    pub name: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct TestCaseListResponse {
    pub test_cases: Vec<TestCaseResponse>,
    pub total: i64,
}
