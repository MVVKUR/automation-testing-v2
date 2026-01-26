use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub app_url: String,
    pub repo_url: Option<String>,
    pub project_type: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProject {
    pub name: String,
    pub description: Option<String>,
    pub app_url: String,
    pub repo_url: Option<String>,
    pub project_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProject {
    pub name: Option<String>,
    pub description: Option<String>,
    pub app_url: Option<String>,
    pub repo_url: Option<String>,
    pub project_type: Option<String>,
}

impl Project {
    pub fn new(data: CreateProject) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: data.name,
            description: data.description,
            app_url: data.app_url,
            repo_url: data.repo_url,
            project_type: data.project_type.unwrap_or_else(|| "web".to_string()),
            created_at: now.clone(),
            updated_at: now,
        }
    }
}
