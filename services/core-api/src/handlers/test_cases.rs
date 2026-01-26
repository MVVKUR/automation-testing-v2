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
        Claims, CreateTestCaseRequest, TestCase, TestCaseListResponse, TestCaseResponse,
        UpdateTestCaseRequest,
    },
    AppState,
};

pub async fn list_test_cases(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(project_id): Path<Uuid>,
) -> AppResult<Json<TestCaseListResponse>> {
    // Verify user has access to project
    verify_project_access(&state, project_id, claims.sub).await?;

    let test_cases: Vec<TestCase> = sqlx::query_as(
        r#"
        SELECT * FROM test_cases
        WHERE project_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(project_id)
    .fetch_all(state.db.get_pool())
    .await?;

    let total = test_cases.len() as i64;

    Ok(Json(TestCaseListResponse {
        test_cases: test_cases.into_iter().map(|tc| tc.into()).collect(),
        total,
    }))
}

pub async fn create_test_case(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<CreateTestCaseRequest>,
) -> AppResult<(StatusCode, Json<TestCaseResponse>)> {
    // Verify user has access to project
    verify_project_access(&state, project_id, claims.sub).await?;

    let priority = payload.priority.unwrap_or_else(|| "medium".to_string());
    let tags = payload.tags.unwrap_or_default();

    let test_case: TestCase = sqlx::query_as(
        r#"
        INSERT INTO test_cases (project_id, name, description, priority, tags, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#,
    )
    .bind(project_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(&priority)
    .bind(&tags)
    .bind(claims.sub)
    .fetch_one(state.db.get_pool())
    .await?;

    Ok((StatusCode::CREATED, Json(test_case.into())))
}

pub async fn get_test_case(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<TestCaseResponse>> {
    let test_case: TestCase = sqlx::query_as(
        "SELECT * FROM test_cases WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(state.db.get_pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Test case not found".to_string()))?;

    // Verify user has access to project
    verify_project_access(&state, test_case.project_id, claims.sub).await?;

    Ok(Json(test_case.into()))
}

pub async fn update_test_case(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTestCaseRequest>,
) -> AppResult<Json<TestCaseResponse>> {
    let existing: TestCase = sqlx::query_as(
        "SELECT * FROM test_cases WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(state.db.get_pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Test case not found".to_string()))?;

    // Verify user has access to project
    verify_project_access(&state, existing.project_id, claims.sub).await?;

    let name = payload.name.unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let priority = payload.priority.unwrap_or(existing.priority);
    let status = payload.status.unwrap_or(existing.status);
    let tags = payload.tags.unwrap_or(existing.tags);

    let test_case: TestCase = sqlx::query_as(
        r#"
        UPDATE test_cases
        SET name = $1, description = $2, priority = $3, status = $4, tags = $5
        WHERE id = $6
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(&priority)
    .bind(&status)
    .bind(&tags)
    .bind(id)
    .fetch_one(state.db.get_pool())
    .await?;

    Ok(Json(test_case.into()))
}

pub async fn delete_test_case(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let test_case: TestCase = sqlx::query_as(
        "SELECT * FROM test_cases WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(state.db.get_pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Test case not found".to_string()))?;

    // Verify user has access to project
    verify_project_access(&state, test_case.project_id, claims.sub).await?;

    sqlx::query("DELETE FROM test_cases WHERE id = $1")
        .bind(id)
        .execute(state.db.get_pool())
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn verify_project_access(
    state: &Arc<AppState>,
    project_id: Uuid,
    user_id: Uuid,
) -> AppResult<()> {
    let exists: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2 AND is_active = true",
    )
    .bind(project_id)
    .bind(user_id)
    .fetch_optional(state.db.get_pool())
    .await?;

    if exists.is_none() {
        return Err(AppError::NotFound("Project not found or access denied".to_string()));
    }

    Ok(())
}
