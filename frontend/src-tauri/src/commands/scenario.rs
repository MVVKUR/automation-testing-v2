use crate::db::DbPool;
use crate::models::{CreateScenario, Scenario, ScenarioWithSteps, Step, UpdateScenario};
use tauri::State;

#[tauri::command]
pub async fn create_scenario(
    pool: State<'_, DbPool>,
    data: CreateScenario,
) -> Result<Scenario, String> {
    let scenario = Scenario::new(data);

    sqlx::query(
        r#"
        INSERT INTO scenarios (id, test_case_id, name, description, target_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&scenario.id)
    .bind(&scenario.test_case_id)
    .bind(&scenario.name)
    .bind(&scenario.description)
    .bind(&scenario.target_url)
    .bind(&scenario.created_at)
    .bind(&scenario.updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create scenario: {}", e))?;

    log::info!("Created scenario: {} ({})", scenario.name, scenario.id);

    Ok(scenario)
}

#[tauri::command]
pub async fn get_scenario(
    pool: State<'_, DbPool>,
    id: String,
) -> Result<Option<Scenario>, String> {
    let scenario = sqlx::query_as::<_, Scenario>("SELECT * FROM scenarios WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get scenario: {}", e))?;

    Ok(scenario)
}

#[tauri::command]
pub async fn get_scenario_with_steps(
    pool: State<'_, DbPool>,
    id: String,
) -> Result<Option<ScenarioWithSteps>, String> {
    let scenario = sqlx::query_as::<_, Scenario>("SELECT * FROM scenarios WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get scenario: {}", e))?;

    let Some(scenario) = scenario else {
        return Ok(None);
    };

    let steps = sqlx::query_as::<_, Step>(
        "SELECT * FROM steps WHERE scenario_id = ? ORDER BY step_order ASC",
    )
    .bind(&scenario.id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to get steps: {}", e))?;

    Ok(Some(ScenarioWithSteps { scenario, steps }))
}

#[tauri::command]
pub async fn list_scenarios_by_test_case(
    pool: State<'_, DbPool>,
    test_case_id: String,
) -> Result<Vec<Scenario>, String> {
    let scenarios = sqlx::query_as::<_, Scenario>(
        "SELECT * FROM scenarios WHERE test_case_id = ? ORDER BY created_at DESC",
    )
    .bind(&test_case_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to list scenarios: {}", e))?;

    Ok(scenarios)
}

#[tauri::command]
pub async fn update_scenario(
    pool: State<'_, DbPool>,
    id: String,
    data: UpdateScenario,
) -> Result<Scenario, String> {
    let existing = sqlx::query_as::<_, Scenario>("SELECT * FROM scenarios WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get scenario: {}", e))?
        .ok_or_else(|| format!("Scenario not found: {}", id))?;

    let now = chrono::Utc::now().to_rfc3339();

    let updated = Scenario {
        id: existing.id,
        test_case_id: existing.test_case_id,
        name: data.name.unwrap_or(existing.name),
        description: data.description.or(existing.description),
        target_url: data.target_url.or(existing.target_url),
        created_at: existing.created_at,
        updated_at: now,
    };

    sqlx::query(
        r#"
        UPDATE scenarios
        SET name = ?, description = ?, target_url = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&updated.name)
    .bind(&updated.description)
    .bind(&updated.target_url)
    .bind(&updated.updated_at)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update scenario: {}", e))?;

    log::info!("Updated scenario: {}", id);

    Ok(updated)
}

#[tauri::command]
pub async fn delete_scenario(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM scenarios WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete scenario: {}", e))?;

    if result.rows_affected() == 0 {
        return Err(format!("Scenario not found: {}", id));
    }

    log::info!("Deleted scenario: {}", id);

    Ok(())
}

#[tauri::command]
pub async fn duplicate_scenario(
    pool: State<'_, DbPool>,
    id: String,
    new_name: Option<String>,
) -> Result<Scenario, String> {
    // Get original scenario
    let original = sqlx::query_as::<_, Scenario>("SELECT * FROM scenarios WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get scenario: {}", e))?
        .ok_or_else(|| format!("Scenario not found: {}", id))?;

    // Create new scenario
    let new_scenario = Scenario::new(CreateScenario {
        test_case_id: original.test_case_id,
        name: new_name.unwrap_or_else(|| format!("{} (Copy)", original.name)),
        description: original.description,
        target_url: original.target_url,
    });

    sqlx::query(
        r#"
        INSERT INTO scenarios (id, test_case_id, name, description, target_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&new_scenario.id)
    .bind(&new_scenario.test_case_id)
    .bind(&new_scenario.name)
    .bind(&new_scenario.description)
    .bind(&new_scenario.target_url)
    .bind(&new_scenario.created_at)
    .bind(&new_scenario.updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create duplicated scenario: {}", e))?;

    // Copy all steps
    let steps =
        sqlx::query_as::<_, Step>("SELECT * FROM steps WHERE scenario_id = ? ORDER BY step_order")
            .bind(&id)
            .fetch_all(pool.inner())
            .await
            .map_err(|e| format!("Failed to get steps: {}", e))?;

    for step in steps {
        let new_step_id = format!(
            "STEP-{}",
            &uuid::Uuid::new_v4().to_string()[..8].to_uppercase()
        );
        let now = chrono::Utc::now().to_rfc3339();

        sqlx::query(
            r#"
            INSERT INTO steps (id, scenario_id, step_order, step_type, label, config, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&new_step_id)
        .bind(&new_scenario.id)
        .bind(step.step_order)
        .bind(&step.step_type)
        .bind(&step.label)
        .bind(&step.config)
        .bind(&now)
        .bind(&now)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to duplicate step: {}", e))?;
    }

    log::info!(
        "Duplicated scenario {} -> {}",
        id,
        new_scenario.id
    );

    Ok(new_scenario)
}
