use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Scenario {
    pub id: Uuid,
    pub test_case_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub order_index: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScenarioResponse {
    pub id: Uuid,
    pub test_case_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub order_index: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Scenario> for ScenarioResponse {
    fn from(scenario: Scenario) -> Self {
        Self {
            id: scenario.id,
            test_case_id: scenario.test_case_id,
            name: scenario.name,
            description: scenario.description,
            order_index: scenario.order_index,
            is_active: scenario.is_active,
            created_at: scenario.created_at,
            updated_at: scenario.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateScenarioRequest {
    #[validate(length(min = 1, max = 255, message = "Name must be between 1 and 255 characters"))]
    pub name: String,
    pub description: Option<String>,
    pub order_index: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateScenarioRequest {
    #[validate(length(min = 1, max = 255, message = "Name must be between 1 and 255 characters"))]
    pub name: Option<String>,
    pub description: Option<String>,
    pub order_index: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ScenarioListResponse {
    pub scenarios: Vec<ScenarioResponse>,
    pub total: i64,
}
