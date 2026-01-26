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
        Claims, CreateScenarioRequest, Scenario, ScenarioListResponse, ScenarioResponse,
        UpdateScenarioRequest,
    },
    AppState,
};

pub async fn list_scenarios(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(test_case_id): Path<Uuid>,
) -> AppResult<Json<ScenarioListResponse>> {
    // Verify user has access to test case
    verify_test_case_access(&state, test_case_id, claims.sub).await?;

    let scenarios: Vec<Scenario> = sqlx::query_as(
        r#"
        SELECT * FROM scenarios
        WHERE test_case_id = $1 AND is_active = true
        ORDER BY order_index ASC
        "#,
    )
    .bind(test_case_id)
    .fetch_all(state.db.get_pool())
    .await?;

    let total = scenarios.len() as i64;

    Ok(Json(ScenarioListResponse {
        scenarios: scenarios.into_iter().map(|s| s.into()).collect(),
        total,
    }))
}

pub async fn create_scenario(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(test_case_id): Path<Uuid>,
    Json(payload): Json<CreateScenarioRequest>,
) -> AppResult<(StatusCode, Json<ScenarioResponse>)> {
    // Verify user has access to test case
    verify_test_case_access(&state, test_case_id, claims.sub).await?;

    // Get max order_index for this test case
    let max_order: Option<(i32,)> = sqlx::query_as(
        "SELECT COALESCE(MAX(order_index), -1) FROM scenarios WHERE test_case_id = $1",
    )
    .bind(test_case_id)
    .fetch_one(state.db.get_pool())
    .await?;

    let order_index = payload.order_index.unwrap_or(max_order.map(|m| m.0 + 1).unwrap_or(0));

    let scenario: Scenario = sqlx::query_as(
        r#"
        INSERT INTO scenarios (test_case_id, name, description, order_index)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        "#,
    )
    .bind(test_case_id)
    .bind(&payload.name)
    .bind(&payload.description)
    .bind(order_index)
    .fetch_one(state.db.get_pool())
    .await?;

    Ok((StatusCode::CREATED, Json(scenario.into())))
}

pub async fn get_scenario(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<Json<ScenarioResponse>> {
    let scenario: Scenario = sqlx::query_as(
        "SELECT * FROM scenarios WHERE id = $1 AND is_active = true",
    )
    .bind(id)
    .fetch_optional(state.db.get_pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Scenario not found".to_string()))?;

    // Verify user has access to test case
    verify_test_case_access(&state, scenario.test_case_id, claims.sub).await?;

    Ok(Json(scenario.into()))
}

pub async fn update_scenario(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateScenarioRequest>,
) -> AppResult<Json<ScenarioResponse>> {
    let existing: Scenario = sqlx::query_as(
        "SELECT * FROM scenarios WHERE id = $1 AND is_active = true",
    )
    .bind(id)
    .fetch_optional(state.db.get_pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Scenario not found".to_string()))?;

    // Verify user has access to test case
    verify_test_case_access(&state, existing.test_case_id, claims.sub).await?;

    let name = payload.name.unwrap_or(existing.name);
    let description = payload.description.or(existing.description);
    let order_index = payload.order_index.unwrap_or(existing.order_index);
    let is_active = payload.is_active.unwrap_or(existing.is_active);

    let scenario: Scenario = sqlx::query_as(
        r#"
        UPDATE scenarios
        SET name = $1, description = $2, order_index = $3, is_active = $4
        WHERE id = $5
        RETURNING *
        "#,
    )
    .bind(&name)
    .bind(&description)
    .bind(order_index)
    .bind(is_active)
    .bind(id)
    .fetch_one(state.db.get_pool())
    .await?;

    Ok(Json(scenario.into()))
}

pub async fn delete_scenario(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> AppResult<StatusCode> {
    let scenario: Scenario = sqlx::query_as(
        "SELECT * FROM scenarios WHERE id = $1 AND is_active = true",
    )
    .bind(id)
    .fetch_optional(state.db.get_pool())
    .await?
    .ok_or_else(|| AppError::NotFound("Scenario not found".to_string()))?;

    // Verify user has access to test case
    verify_test_case_access(&state, scenario.test_case_id, claims.sub).await?;

    // Soft delete
    sqlx::query("UPDATE scenarios SET is_active = false WHERE id = $1")
        .bind(id)
        .execute(state.db.get_pool())
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn verify_test_case_access(
    state: &Arc<AppState>,
    test_case_id: Uuid,
    user_id: Uuid,
) -> AppResult<()> {
    let exists: Option<(i64,)> = sqlx::query_as(
        r#"
        SELECT 1 FROM test_cases tc
        JOIN projects p ON tc.project_id = p.id
        WHERE tc.id = $1 AND p.owner_id = $2 AND p.is_active = true
        "#,
    )
    .bind(test_case_id)
    .bind(user_id)
    .fetch_optional(state.db.get_pool())
    .await?;

    if exists.is_none() {
        return Err(AppError::NotFound("Test case not found or access denied".to_string()));
    }

    Ok(())
}
