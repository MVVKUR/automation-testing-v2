use crate::db::DbPool;
use crate::models::{CreateProject, Project, UpdateProject};
use tauri::State;

#[tauri::command]
pub async fn create_project(
    pool: State<'_, DbPool>,
    data: CreateProject,
) -> Result<Project, String> {
    let project = Project::new(data);

    sqlx::query(
        r#"
        INSERT INTO projects (id, name, description, app_url, repo_url, project_type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&project.id)
    .bind(&project.name)
    .bind(&project.description)
    .bind(&project.app_url)
    .bind(&project.repo_url)
    .bind(&project.project_type)
    .bind(&project.created_at)
    .bind(&project.updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create project: {}", e))?;

    log::info!("Created project: {} ({})", project.name, project.id);

    Ok(project)
}

#[tauri::command]
pub async fn get_project(pool: State<'_, DbPool>, id: String) -> Result<Option<Project>, String> {
    let project = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get project: {}", e))?;

    Ok(project)
}

#[tauri::command]
pub async fn list_projects(pool: State<'_, DbPool>) -> Result<Vec<Project>, String> {
    let projects =
        sqlx::query_as::<_, Project>("SELECT * FROM projects ORDER BY updated_at DESC")
            .fetch_all(pool.inner())
            .await
            .map_err(|e| format!("Failed to list projects: {}", e))?;

    Ok(projects)
}

#[tauri::command]
pub async fn update_project(
    pool: State<'_, DbPool>,
    id: String,
    data: UpdateProject,
) -> Result<Project, String> {
    // Get existing project
    let existing = sqlx::query_as::<_, Project>("SELECT * FROM projects WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get project: {}", e))?
        .ok_or_else(|| format!("Project not found: {}", id))?;

    let now = chrono::Utc::now().to_rfc3339();

    let updated = Project {
        id: existing.id,
        name: data.name.unwrap_or(existing.name),
        description: data.description.or(existing.description),
        app_url: data.app_url.unwrap_or(existing.app_url),
        repo_url: data.repo_url.or(existing.repo_url),
        project_type: data.project_type.unwrap_or(existing.project_type),
        created_at: existing.created_at,
        updated_at: now,
    };

    sqlx::query(
        r#"
        UPDATE projects
        SET name = ?, description = ?, app_url = ?, repo_url = ?, project_type = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&updated.name)
    .bind(&updated.description)
    .bind(&updated.app_url)
    .bind(&updated.repo_url)
    .bind(&updated.project_type)
    .bind(&updated.updated_at)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update project: {}", e))?;

    log::info!("Updated project: {}", id);

    Ok(updated)
}

#[tauri::command]
pub async fn delete_project(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete project: {}", e))?;

    if result.rows_affected() == 0 {
        return Err(format!("Project not found: {}", id));
    }

    log::info!("Deleted project: {}", id);

    Ok(())
}

#[tauri::command]
pub async fn search_projects(
    pool: State<'_, DbPool>,
    query: String,
) -> Result<Vec<Project>, String> {
    let search_pattern = format!("%{}%", query);

    let projects = sqlx::query_as::<_, Project>(
        r#"
        SELECT * FROM projects
        WHERE name LIKE ? OR description LIKE ? OR app_url LIKE ?
        ORDER BY updated_at DESC
        "#,
    )
    .bind(&search_pattern)
    .bind(&search_pattern)
    .bind(&search_pattern)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to search projects: {}", e))?;

    Ok(projects)
}
