use crate::db::DbPool;
use crate::models::{CreateTestCase, TestCase, UpdateTestCase};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCaseFilter {
    pub project_id: Option<String>,
    pub category: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub test_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCaseStats {
    pub total: i64,
    pub passed: i64,
    pub failed: i64,
    pub pending: i64,
    pub by_category: Vec<CategoryCount>,
    pub by_priority: Vec<PriorityCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryCount {
    pub category: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityCount {
    pub priority: String,
    pub count: i64,
}

#[tauri::command]
pub async fn create_test_case(
    pool: State<'_, DbPool>,
    data: CreateTestCase,
) -> Result<TestCase, String> {
    let test_case = TestCase::new(data);

    sqlx::query(
        r#"
        INSERT INTO test_cases (id, project_id, name, description, category, priority, test_type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&test_case.id)
    .bind(&test_case.project_id)
    .bind(&test_case.name)
    .bind(&test_case.description)
    .bind(&test_case.category)
    .bind(&test_case.priority)
    .bind(&test_case.test_type)
    .bind(&test_case.status)
    .bind(&test_case.created_at)
    .bind(&test_case.updated_at)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to create test case: {}", e))?;

    log::info!("Created test case: {} ({})", test_case.name, test_case.id);

    Ok(test_case)
}

#[tauri::command]
pub async fn get_test_case(
    pool: State<'_, DbPool>,
    id: String,
) -> Result<Option<TestCase>, String> {
    let test_case = sqlx::query_as::<_, TestCase>("SELECT * FROM test_cases WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get test case: {}", e))?;

    Ok(test_case)
}

#[tauri::command]
pub async fn list_test_cases(
    pool: State<'_, DbPool>,
    filter: Option<TestCaseFilter>,
) -> Result<Vec<TestCase>, String> {
    let filter = filter.unwrap_or(TestCaseFilter {
        project_id: None,
        category: None,
        priority: None,
        status: None,
        test_type: None,
    });

    let mut query = String::from("SELECT * FROM test_cases WHERE 1=1");
    let mut bindings: Vec<String> = Vec::new();

    if let Some(ref project_id) = filter.project_id {
        query.push_str(" AND project_id = ?");
        bindings.push(project_id.clone());
    }
    if let Some(ref category) = filter.category {
        query.push_str(" AND category = ?");
        bindings.push(category.clone());
    }
    if let Some(ref priority) = filter.priority {
        query.push_str(" AND priority = ?");
        bindings.push(priority.clone());
    }
    if let Some(ref status) = filter.status {
        query.push_str(" AND status = ?");
        bindings.push(status.clone());
    }
    if let Some(ref test_type) = filter.test_type {
        query.push_str(" AND test_type = ?");
        bindings.push(test_type.clone());
    }

    query.push_str(" ORDER BY created_at DESC");

    // Build and execute query with dynamic bindings
    let mut sqlx_query = sqlx::query_as::<_, TestCase>(&query);
    for binding in bindings {
        sqlx_query = sqlx_query.bind(binding);
    }

    let test_cases = sqlx_query
        .fetch_all(pool.inner())
        .await
        .map_err(|e| format!("Failed to list test cases: {}", e))?;

    Ok(test_cases)
}

#[tauri::command]
pub async fn list_test_cases_by_project(
    pool: State<'_, DbPool>,
    project_id: String,
) -> Result<Vec<TestCase>, String> {
    let test_cases = sqlx::query_as::<_, TestCase>(
        "SELECT * FROM test_cases WHERE project_id = ? ORDER BY created_at DESC",
    )
    .bind(&project_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to list test cases: {}", e))?;

    Ok(test_cases)
}

#[tauri::command]
pub async fn update_test_case(
    pool: State<'_, DbPool>,
    id: String,
    data: UpdateTestCase,
) -> Result<TestCase, String> {
    let existing = sqlx::query_as::<_, TestCase>("SELECT * FROM test_cases WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Failed to get test case: {}", e))?
        .ok_or_else(|| format!("Test case not found: {}", id))?;

    let now = chrono::Utc::now().to_rfc3339();

    let updated = TestCase {
        id: existing.id,
        project_id: existing.project_id,
        name: data.name.unwrap_or(existing.name),
        description: data.description.or(existing.description),
        category: data.category.or(existing.category),
        priority: data.priority.unwrap_or(existing.priority),
        test_type: data.test_type.unwrap_or(existing.test_type),
        status: data.status.unwrap_or(existing.status),
        created_at: existing.created_at,
        updated_at: now,
    };

    sqlx::query(
        r#"
        UPDATE test_cases
        SET name = ?, description = ?, category = ?, priority = ?, test_type = ?, status = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&updated.name)
    .bind(&updated.description)
    .bind(&updated.category)
    .bind(&updated.priority)
    .bind(&updated.test_type)
    .bind(&updated.status)
    .bind(&updated.updated_at)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Failed to update test case: {}", e))?;

    log::info!("Updated test case: {}", id);

    Ok(updated)
}

#[tauri::command]
pub async fn update_test_case_status(
    pool: State<'_, DbPool>,
    id: String,
    status: String,
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();

    let result = sqlx::query("UPDATE test_cases SET status = ?, updated_at = ? WHERE id = ?")
        .bind(&status)
        .bind(&now)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to update test case status: {}", e))?;

    if result.rows_affected() == 0 {
        return Err(format!("Test case not found: {}", id));
    }

    log::info!("Updated test case status: {} -> {}", id, status);

    Ok(())
}

#[tauri::command]
pub async fn delete_test_case(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    let result = sqlx::query("DELETE FROM test_cases WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Failed to delete test case: {}", e))?;

    if result.rows_affected() == 0 {
        return Err(format!("Test case not found: {}", id));
    }

    log::info!("Deleted test case: {}", id);

    Ok(())
}

#[tauri::command]
pub async fn get_test_case_stats(
    pool: State<'_, DbPool>,
    project_id: String,
) -> Result<TestCaseStats, String> {
    // Get total counts by status
    let (total,): (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM test_cases WHERE project_id = ?")
            .bind(&project_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| format!("Failed to count test cases: {}", e))?;

    let (passed,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM test_cases WHERE project_id = ? AND status = 'success'",
    )
    .bind(&project_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Failed to count passed: {}", e))?;

    let (failed,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM test_cases WHERE project_id = ? AND status = 'failed'",
    )
    .bind(&project_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Failed to count failed: {}", e))?;

    let (pending,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM test_cases WHERE project_id = ? AND status IN ('pending', 'warning')",
    )
    .bind(&project_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Failed to count pending: {}", e))?;

    // Get counts by category
    let by_category: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT COALESCE(category, 'Uncategorized') as category, COUNT(*) as count
        FROM test_cases WHERE project_id = ?
        GROUP BY category ORDER BY count DESC
        "#,
    )
    .bind(&project_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to get category counts: {}", e))?;

    // Get counts by priority
    let by_priority: Vec<(String, i64)> = sqlx::query_as(
        r#"
        SELECT priority, COUNT(*) as count
        FROM test_cases WHERE project_id = ?
        GROUP BY priority ORDER BY
            CASE priority
                WHEN 'Critical' THEN 1
                WHEN 'High' THEN 2
                WHEN 'Medium' THEN 3
                WHEN 'Low' THEN 4
            END
        "#,
    )
    .bind(&project_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Failed to get priority counts: {}", e))?;

    Ok(TestCaseStats {
        total,
        passed,
        failed,
        pending,
        by_category: by_category
            .into_iter()
            .map(|(category, count)| CategoryCount { category, count })
            .collect(),
        by_priority: by_priority
            .into_iter()
            .map(|(priority, count)| PriorityCount { priority, count })
            .collect(),
    })
}
