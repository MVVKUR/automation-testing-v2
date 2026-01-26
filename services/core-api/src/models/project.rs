use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: Uuid,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub owner_id: Uuid,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Project> for ProjectResponse {
    fn from(project: Project) -> Self {
        Self {
            id: project.id,
            name: project.name,
            description: project.description,
            owner_id: project.owner_id,
            is_active: project.is_active,
            created_at: project.created_at,
            updated_at: project.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateProjectRequest {
    #[validate(length(min = 1, max = 255, message = "Name must be between 1 and 255 characters"))]
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateProjectRequest {
    #[validate(length(min = 1, max = 255, message = "Name must be between 1 and 255 characters"))]
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ProjectListResponse {
    pub projects: Vec<ProjectResponse>,
    pub total: i64,
}
