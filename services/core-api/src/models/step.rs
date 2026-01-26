use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Step {
    pub id: Uuid,
    pub scenario_id: Uuid,
    pub action_type: String,
    pub target: Option<String>,
    pub value: Option<String>,
    pub order_index: i32,
    pub timeout_ms: Option<i32>,
    pub is_optional: bool,
    pub metadata: JsonValue,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StepResponse {
    pub id: Uuid,
    pub scenario_id: Uuid,
    pub action_type: String,
    pub target: Option<String>,
    pub value: Option<String>,
    pub order_index: i32,
    pub timeout_ms: Option<i32>,
    pub is_optional: bool,
    pub metadata: JsonValue,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Step> for StepResponse {
    fn from(step: Step) -> Self {
        Self {
            id: step.id,
            scenario_id: step.scenario_id,
            action_type: step.action_type,
            target: step.target,
            value: step.value,
            order_index: step.order_index,
            timeout_ms: step.timeout_ms,
            is_optional: step.is_optional,
            metadata: step.metadata,
            created_at: step.created_at,
            updated_at: step.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateStepRequest {
    #[validate(length(min = 1, max = 100, message = "Action type must be between 1 and 100 characters"))]
    pub action_type: String,
    pub target: Option<String>,
    pub value: Option<String>,
    pub order_index: Option<i32>,
    pub timeout_ms: Option<i32>,
    pub is_optional: Option<bool>,
    pub metadata: Option<JsonValue>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateStepRequest {
    #[validate(length(min = 1, max = 100, message = "Action type must be between 1 and 100 characters"))]
    pub action_type: Option<String>,
    pub target: Option<String>,
    pub value: Option<String>,
    pub order_index: Option<i32>,
    pub timeout_ms: Option<i32>,
    pub is_optional: Option<bool>,
    pub metadata: Option<JsonValue>,
}

#[derive(Debug, Serialize)]
pub struct StepListResponse {
    pub steps: Vec<StepResponse>,
    pub total: i64,
}
