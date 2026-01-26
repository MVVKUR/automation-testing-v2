use crate::db::DbPool;
use crate::models::{CreateStepResult, CreateTestRun, StepResult, TestRun, TestRunSummary, UpdateTestRun};
use tauri::State;

#[tauri::command]
pub async fn create_test_run(
    pool: State<'_, DbPool>,
    data: CreateTestRun,
) -> Result<TestRun, String> {
    let test_run = TestRun::new(data);

    sqlx::query(
        r#"
        INSERT INTO test_runs (id, project_id, name, status, duration_ms, passed, failed, skipped, started_at, completed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&test_run.id)
    .bind(&test_run.project_id)
    .bind(&test_run.name)
    .bind(&test_run.status)
    .bind(&test_run.duration_ms)
    .bind(test_run.passed)
    .bind(test_run.failed)
    .bind(test_run.skipped)
    .bind(&test_run.started_at)
    .bind(&test_run.completed_at)
    .bind(&test_run.created_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create test run: {}", e))?;

    log::info!("Created test run: {} ({})", test_run.name, test_run.id);

    Ok(test_run)
}

#[tauri::command]
pub async fn get_test_run(pool: State<'_, DbPool>, id: String) -> Result<Option<TestRun>, String> {
    let test_run = sqlx::query_as::<_, TestRun>("SELECT * FROM test_runs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get test run: {}", e))?;

    Ok(test_run)
}

#[tauri::command]
pub async fn list_test_runs(
    pool: State<'_, DbPool>,
    project_id: String,
    limit: Option<i32>,
) -> Result<Vec<TestRun>, String> {
    let limit = limit.unwrap_or(50);

    let test_runs = sqlx::query_as::<_, TestRun>(
        "SELECT * FROM test_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(&project_id)
    .bind(limit)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to list test runs: {}", e))?;

    Ok(test_runs)
}

#[tauri::command]
pub async fn update_test_run(
    pool: State<'_, DbPool>,
    id: String,
    data: UpdateTestRun,
) -> Result<TestRun, String> {
    let existing = sqlx::query_as::<_, TestRun>("SELECT * FROM test_runs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get test run: {}", e))?
        .ok_or_else(|| format!("Test run not found: {}", id))?;

    let updated = TestRun {
        id: existing.id,
        project_id: existing.project_id,
        name: existing.name,
        status: data.status.unwrap_or(existing.status),
        duration_ms: data.duration_ms.or(existing.duration_ms),
        passed: data.passed.unwrap_or(existing.passed),
        failed: data.failed.unwrap_or(existing.failed),
        skipped: data.skipped.unwrap_or(existing.skipped),
        started_at: data.started_at.or(existing.started_at),
        completed_at: data.completed_at.or(existing.completed_at),
        created_at: existing.created_at,
    };

    sqlx::query(
        r#"
        UPDATE test_runs
        SET status = ?, duration_ms = ?, passed = ?, failed = ?, skipped = ?, started_at = ?, completed_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&updated.status)
    .bind(&updated.duration_ms)
    .bind(updated.passed)
    .bind(updated.failed)
    .bind(updated.skipped)
    .bind(&updated.started_at)
    .bind(&updated.completed_at)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update test run: {}", e))?;

    log::info!("Updated test run: {}", id);

    Ok(updated)
}

#[tauri::command]
pub async fn start_test_run(pool: State<'_, DbPool>, id: String) -> Result<TestRun, String> {
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query("UPDATE test_runs SET status = 'running', started_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to start test run: {}", e))?;

    get_test_run(pool, id)
        .await?
        .ok_or_else(|| "Test run not found after update".to_string())
}

#[tauri::command]
pub async fn complete_test_run(
    pool: State<'_, DbPool>,
    id: String,
    passed: i32,
    failed: i32,
    skipped: i32,
) -> Result<TestRun, String> {
    let now = chrono::Utc::now().to_rfc3339();

    // Get start time to calculate duration
    let test_run = sqlx::query_as::<_, TestRun>("SELECT * FROM test_runs WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get test run: {}", e))?
        .ok_or_else(|| format!("Test run not found: {}", id))?;

    let duration_ms = if let Some(ref started_at) = test_run.started_at {
        let start = chrono::DateTime::parse_from_rfc3339(started_at)
            .map_err(|e| format!("Failed to parse start time: {}", e))?;
        let end = chrono::DateTime::parse_from_rfc3339(&now)
            .map_err(|e| format!("Failed to parse end time: {}", e))?;
        Some((end - start).num_milliseconds())
    } else {
        None
    };

    let status = if failed > 0 { "failed" } else { "passed" };

    sqlx::query(
        r#"
        UPDATE test_runs
        SET status = ?, duration_ms = ?, passed = ?, failed = ?, skipped = ?, completed_at = ?
        WHERE id = ?
        "#,
    )
    .bind(status)
    .bind(&duration_ms)
    .bind(passed)
    .bind(failed)
    .bind(skipped)
    .bind(&now)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to complete test run: {}", e))?;

    log::info!(
        "Completed test run: {} - {} ({} passed, {} failed)",
        id,
        status,
        passed,
        failed
    );

    get_test_run(pool, id)
        .await?
        .ok_or_else(|| "Test run not found after update".to_string())
}

#[tauri::command]
pub async fn delete_test_run(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM test_runs WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete test run: {}", e))?;

    if result.rows_affected() == 0 {
        return Err(format!("Test run not found: {}", id));
    }

    log::info!("Deleted test run: {}", id);

    Ok(())
}

#[tauri::command]
pub async fn get_test_run_summary(
    pool: State<'_, DbPool>,
    project_id: String,
) -> Result<TestRunSummary, String> {
    let (total_runs,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM test_runs WHERE project_id = ?")
            .bind(&project_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| format!("Failed to count runs: {}", e))?;

    let (passed_runs,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM test_runs WHERE project_id = ? AND status = 'passed'")
            .bind(&project_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| format!("Failed to count passed: {}", e))?;

    let (failed_runs,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM test_runs WHERE project_id = ? AND status = 'failed'")
            .bind(&project_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| format!("Failed to count failed: {}", e))?;

    let avg_duration: Option<(f64,)> = sqlx::query_as(
        "SELECT AVG(duration_ms) FROM test_runs WHERE project_id = ? AND duration_ms IS NOT NULL",
    )
    .bind(&project_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Failed to get avg duration: {}", e))?;

    Ok(TestRunSummary {
        total_runs,
        passed_runs,
        failed_runs,
        avg_duration_ms: avg_duration.map(|(d,)| d),
    })
}

// Step results commands

#[tauri::command]
pub async fn create_step_result(
    pool: State<'_, DbPool>,
    data: CreateStepResult,
) -> Result<StepResult, String> {
    let result = StepResult::new(data);

    sqlx::query(
        r#"
        INSERT INTO step_results (id, test_run_id, step_id, test_case_id, status, duration_ms, error_message, screenshot_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&result.id)
    .bind(&result.test_run_id)
    .bind(&result.step_id)
    .bind(&result.test_case_id)
    .bind(&result.status)
    .bind(&result.duration_ms)
    .bind(&result.error_message)
    .bind(&result.screenshot_path)
    .bind(&result.created_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create step result: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub async fn list_step_results(
    pool: State<'_, DbPool>,
    test_run_id: String,
) -> Result<Vec<StepResult>, String> {
    let results = sqlx::query_as::<_, StepResult>(
        "SELECT * FROM step_results WHERE test_run_id = ? ORDER BY created_at ASC",
    )
    .bind(&test_run_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to list step results: {}", e))?;

    Ok(results)
}
