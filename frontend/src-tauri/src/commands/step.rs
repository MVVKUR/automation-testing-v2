use crate::db::DbPool;
use crate::models::{CreateStep, Step, StepConfig, StepWithConfig, UpdateStep};
use tauri::State;

#[tauri::command]
pub async fn create_step(pool: State<'_, DbPool>, data: CreateStep) -> Result<Step, String> {
    let step = Step::new(data);

    sqlx::query(
        r#"
        INSERT INTO steps (id, scenario_id, step_order, step_type, label, config, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&step.id)
    .bind(&step.scenario_id)
    .bind(step.step_order)
    .bind(&step.step_type)
    .bind(&step.label)
    .bind(&step.config)
    .bind(&step.created_at)
    .bind(&step.updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create step: {}", e))?;

    log::info!("Created step: {} ({})", step.label, step.id);

    Ok(step)
}

#[tauri::command]
pub async fn get_step(pool: State<'_, DbPool>, id: String) -> Result<Option<StepWithConfig>, String> {
    let step = sqlx::query_as::<_, Step>("SELECT * FROM steps WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get step: {}", e))?;

    Ok(step.map(|s| s.with_config()))
}

#[tauri::command]
pub async fn list_steps_by_scenario(
    pool: State<'_, DbPool>,
    scenario_id: String,
) -> Result<Vec<StepWithConfig>, String> {
    let steps = sqlx::query_as::<_, Step>(
        "SELECT * FROM steps WHERE scenario_id = ? ORDER BY step_order ASC",
    )
    .bind(&scenario_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to list steps: {}", e))?;

    Ok(steps.into_iter().map(|s| s.with_config()).collect())
}

#[tauri::command]
pub async fn update_step(
    pool: State<'_, DbPool>,
    id: String,
    data: UpdateStep,
) -> Result<Step, String> {
    let existing = sqlx::query_as::<_, Step>("SELECT * FROM steps WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get step: {}", e))?
        .ok_or_else(|| format!("Step not found: {}", id))?;

    let now = chrono::Utc::now().to_rfc3339();

    let new_config = if let Some(config) = data.config {
        serde_json::to_string(&config).unwrap_or_else(|_| existing.config.clone())
    } else {
        existing.config.clone()
    };

    let updated = Step {
        id: existing.id,
        scenario_id: existing.scenario_id,
        step_order: data.step_order.unwrap_or(existing.step_order),
        step_type: data.step_type.unwrap_or(existing.step_type),
        label: data.label.unwrap_or(existing.label),
        config: new_config,
        created_at: existing.created_at,
        updated_at: now,
    };

    sqlx::query(
        r#"
        UPDATE steps
        SET step_order = ?, step_type = ?, label = ?, config = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(updated.step_order)
    .bind(&updated.step_type)
    .bind(&updated.label)
    .bind(&updated.config)
    .bind(&updated.updated_at)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update step: {}", e))?;

    log::info!("Updated step: {}", id);

    Ok(updated)
}

#[tauri::command]
pub async fn update_step_config(
    pool: State<'_, DbPool>,
    id: String,
    config: StepConfig,
) -> Result<Step, String> {
    let existing = sqlx::query_as::<_, Step>("SELECT * FROM steps WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get step: {}", e))?
        .ok_or_else(|| format!("Step not found: {}", id))?;

    let now = chrono::Utc::now().to_rfc3339();
    let config_json =
        serde_json::to_string(&config).map_err(|e| format!("Failed to serialize config: {}", e))?;

    sqlx::query("UPDATE steps SET config = ?, updated_at = ? WHERE id = ?")
        .bind(&config_json)
        .bind(&now)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update step config: {}", e))?;

    let updated = Step {
        config: config_json,
        updated_at: now,
        ..existing
    };

    log::info!("Updated step config: {}", id);

    Ok(updated)
}

#[tauri::command]
pub async fn delete_step(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM steps WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete step: {}", e))?;

    if result.rows_affected() == 0 {
        return Err(format!("Step not found: {}", id));
    }

    log::info!("Deleted step: {}", id);

    Ok(())
}

#[tauri::command]
pub async fn reorder_steps(
    pool: State<'_, DbPool>,
    scenario_id: String,
    step_ids: Vec<String>,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();

    for (index, step_id) in step_ids.iter().enumerate() {
        sqlx::query("UPDATE steps SET step_order = ?, updated_at = ? WHERE id = ? AND scenario_id = ?")
            .bind(index as i32 + 1)
            .bind(&now)
            .bind(step_id)
            .bind(&scenario_id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Failed to reorder step {}: {}", step_id, e))?;
    }

    log::info!("Reordered {} steps in scenario {}", step_ids.len(), scenario_id);

    Ok(())
}

#[tauri::command]
pub async fn bulk_create_steps(
    pool: State<'_, DbPool>,
    steps: Vec<CreateStep>,
) -> Result<Vec<Step>, String> {
    let mut created_steps = Vec::with_capacity(steps.len());

    for step_data in steps {
        let step = Step::new(step_data);

        sqlx::query(
            r#"
            INSERT INTO steps (id, scenario_id, step_order, step_type, label, config, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&step.id)
        .bind(&step.scenario_id)
        .bind(step.step_order)
        .bind(&step.step_type)
        .bind(&step.label)
        .bind(&step.config)
        .bind(&step.created_at)
        .bind(&step.updated_at)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to create step: {}", e))?;

        created_steps.push(step);
    }

    log::info!("Bulk created {} steps", created_steps.len());

    Ok(created_steps)
}

#[tauri::command]
pub async fn bulk_delete_steps(
    pool: State<'_, DbPool>,
    step_ids: Vec<String>,
) -> Result<i32, String> {
    let mut deleted = 0;

    for id in step_ids {
        let result = sqlx::query("DELETE FROM steps WHERE id = ?")
            .bind(&id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Failed to delete step {}: {}", id, e))?;

        deleted += result.rows_affected() as i32;
    }

    log::info!("Bulk deleted {} steps", deleted);

    Ok(deleted)
}
