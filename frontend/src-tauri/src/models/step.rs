use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StepType {
    Navigate,
    Type,
    Click,
    Wait,
    Verify,
    Screenshot,
    Scroll,
    Hover,
    Select,
    Custom,
}

impl std::fmt::Display for StepType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StepType::Navigate => write!(f, "navigate"),
            StepType::Type => write!(f, "type"),
            StepType::Click => write!(f, "click"),
            StepType::Wait => write!(f, "wait"),
            StepType::Verify => write!(f, "verify"),
            StepType::Screenshot => write!(f, "screenshot"),
            StepType::Scroll => write!(f, "scroll"),
            StepType::Hover => write!(f, "hover"),
            StepType::Select => write!(f, "select"),
            StepType::Custom => write!(f, "custom"),
        }
    }
}

impl From<String> for StepType {
    fn from(s: String) -> Self {
        match s.to_lowercase().as_str() {
            "navigate" | "visit" => StepType::Navigate,
            "type" | "input" => StepType::Type,
            "click" => StepType::Click,
            "wait" => StepType::Wait,
            "verify" | "assert" => StepType::Verify,
            "screenshot" => StepType::Screenshot,
            "scroll" => StepType::Scroll,
            "hover" => StepType::Hover,
            "select" => StepType::Select,
            _ => StepType::Custom,
        }
    }
}

/// Configuration for a step - stored as JSON
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StepConfig {
    /// URL for navigate steps
    pub url: Option<String>,
    /// CSS selector for element targeting
    pub selector: Option<String>,
    /// Value to type or expected value
    pub value: Option<String>,
    /// Timeout in milliseconds
    pub timeout: Option<u64>,
    /// Expected value for assertions
    pub expected: Option<String>,
    /// Operator for assertions (equals, contains, etc.)
    pub operator: Option<String>,
    /// Additional custom data
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Step {
    pub id: String,
    pub scenario_id: String,
    pub step_order: i32,
    pub step_type: String,
    pub label: String,
    pub config: String, // JSON string
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStep {
    pub scenario_id: String,
    pub step_order: i32,
    pub step_type: String,
    pub label: String,
    pub config: Option<StepConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStep {
    pub step_order: Option<i32>,
    pub step_type: Option<String>,
    pub label: Option<String>,
    pub config: Option<StepConfig>,
}

/// Step with parsed config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepWithConfig {
    pub id: String,
    pub scenario_id: String,
    pub step_order: i32,
    pub step_type: String,
    pub label: String,
    pub config: StepConfig,
    pub created_at: String,
    pub updated_at: String,
}

impl Step {
    pub fn new(data: CreateStep) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        let config = data.config.unwrap_or_default();
        Self {
            id: format!("STEP-{}", &uuid::Uuid::new_v4().to_string()[..8].to_uppercase()),
            scenario_id: data.scenario_id,
            step_order: data.step_order,
            step_type: data.step_type,
            label: data.label,
            config: serde_json::to_string(&config).unwrap_or_else(|_| "{}".to_string()),
            created_at: now.clone(),
            updated_at: now,
        }
    }

    /// Parse the config JSON into StepConfig
    pub fn parsed_config(&self) -> StepConfig {
        serde_json::from_str(&self.config).unwrap_or_default()
    }

    /// Convert to StepWithConfig
    pub fn with_config(self) -> StepWithConfig {
        let config = self.parsed_config();
        StepWithConfig {
            id: self.id,
            scenario_id: self.scenario_id,
            step_order: self.step_order,
            step_type: self.step_type,
            label: self.label,
            config,
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}
