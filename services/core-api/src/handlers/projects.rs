use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{
        Claims, CreateProjectRequest, Project, ProjectListResponse, ProjectResponse,
        UpdateProjectRequest,
    },
    AppState,
};

pub async fn list_projects(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> AppResult<Json<ProjectListResponse>> {
    let projects: Vec<Project> = sqlx::query_as(
        r#"
        SELECT * FROM projects
        WHERE owner_id = $1 AND is_active = true
        ORDER BY created_at DESC
        "#,
    )
    .bind(claims.sub)
    .fetch_all(state.db.get_pool())
    .await?;

    let total = projects.len() as i64;

    Ok(Json(ProjectListResponse {
        projects: projects.into_iter().map(|p| p.into()).collect(),
        total,
    }))
}

pub async fn create_project(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateProjectRequest>,
) -> AppResult<(StatusCode, Json<ProjectResponse>)> {
    let project: Project = sqlx::query_as(
        r#"
        INSERT INTO projects (name, description, owner_id)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(claims.sub)
    .fetch_one(state.db.get_pool())
    .await?;

    Ok((StatusCode::CREATED, Json(project.into())))
}

pub async fn get_project(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<ProjectResponse>> {
    let project: Project = sqlx::query_as(
        r#"
        SELECT * FROM projects
        WHERE id = $1 AND owner_id = $2 AND is_active = true
        "#,
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(state.db.get_pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    Ok(Json(project.into()))
}

pub async fn update_project(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateProjectRequest>,
) -> AppResult<Json<ProjectResponse>> {
    // Verify project exists and belongs to user
    let existing: Project = sqlx::query_as(
        "SELECT * FROM projects WHERE id = $1 AND owner_id = $2 AND is_active = true",
    )
    .bind(id)
    .bind(claims.sub)
    .fetch_optional(state.db.get_pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Project not found".to_string()))?;

    let name = payload.name.unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    let project: Project = sqlx::query_as(
        r#"
        UPDATE projects
        SET name = $1, description = $2, is_active = $3
        WHERE id = $4
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(is_active)
    .bind(id)
    .fetch_one(state.db.get_pool())
    .await?;

    Ok(Json(project.into()))
}

pub async fn delete_project(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let result = sqlx::query(
        "UPDATE projects SET is_active = false WHERE id = $1 AND owner_id = $2 AND is_active = true",
    )
    .bind(id)
    .bind(claims.sub)
    .execute(state.db.get_pool())
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Project not found".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}
