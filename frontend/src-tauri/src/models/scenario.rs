use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Scenario {
    pub id: String,
    pub test_case_id: String,
    pub name: String,
    pub description: Option<String>,
    pub target_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateScenario {
    pub test_case_id: String,
    pub name: String,
    pub description: Option<String>,
    pub target_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateScenario {
    pub name: Option<String>,
    pub description: Option<String>,
    pub target_url: Option<String>,
}

/// Scenario with its steps included
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioWithSteps {
    #[serde(flatten)]
    pub scenario: Scenario,
    pub steps: Vec<super::Step>,
}

impl Scenario {
    pub fn new(data: CreateScenario) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: format!("SCN-{}", &uuid::Uuid::new_v4().to_string()[..8].to_uppercase()),
            test_case_id: data.test_case_id,
            name: data.name,
            description: data.description,
            target_url: data.target_url,
            created_at: now.clone(),
            updated_at: now,
        }
    }
}
