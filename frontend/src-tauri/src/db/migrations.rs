use sqlx::{Pool, Sqlite};

use super::DbError;

/// Run all database migrations
pub async fn run(pool: &Pool<Sqlite>) -> Result<(), DbError> {
    log::info!("Running database migrations...");

    // Create migrations table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| DbError::MigrationError(e.to_string()))?;

    // Run migrations in order
    if !is_migration_applied(pool, "001_create_projects").await? {
        log::info!("Running migration: 001_create_projects");
        create_projects_table(pool).await?;
        mark_migration_applied(pool, "001_create_projects").await?;
    }

    if !is_migration_applied(pool, "002_create_test_cases").await? {
        log::info!("Running migration: 002_create_test_cases");
        create_test_cases_table(pool).await?;
        mark_migration_applied(pool, "002_create_test_cases").await?;
    }

    if !is_migration_applied(pool, "003_create_scenarios").await? {
        log::info!("Running migration: 003_create_scenarios");
        create_scenarios_table(pool).await?;
        mark_migration_applied(pool, "003_create_scenarios").await?;
    }

    if !is_migration_applied(pool, "004_create_steps").await? {
        log::info!("Running migration: 004_create_steps");
        create_steps_table(pool).await?;
        mark_migration_applied(pool, "004_create_steps").await?;
    }

    if !is_migration_applied(pool, "005_create_test_runs").await? {
        log::info!("Running migration: 005_create_test_runs");
        create_test_runs_table(pool).await?;
        mark_migration_applied(pool, "005_create_test_runs").await?;
    }

    if !is_migration_applied(pool, "006_create_step_results").await? {
        log::info!("Running migration: 006_create_step_results");
        create_step_results_table(pool).await?;
        mark_migration_applied(pool, "006_create_step_results").await?;
    }

    log::info!("All migrations completed successfully");

    Ok(())
}

async fn is_migration_applied(pool: &Pool<Sqlite>, name: &str) -> Result<bool, DbError> {
    let result: Option<(i64,)> = sqlx::query_as("SELECT id FROM _migrations WHERE name = ?")
        .bind(name)
        .fetch_optional(pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;
    Ok(result.is_some())
}

async fn mark_migration_applied(pool: &Pool<Sqlite>, name: &str) -> Result<(), DbError> {
    sqlx::query("INSERT INTO _migrations (name) VALUES (?)")
        .bind(name)
        .execute(pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;
    Ok(())
}

async fn create_projects_table(pool: &Pool<Sqlite>) -> Result<(), DbError> {
    sqlx::query(
        r#"
        CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            app_url TEXT NOT NULL,
            repo_url TEXT,
            project_type TEXT NOT NULL DEFAULT 'web',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| DbError::MigrationError(e.to_string()))?;

    Ok(())
}

async fn create_test_cases_table(pool: &Pool<Sqlite>) -> Result<(), DbError> {
    sqlx::query(
        r#"
        CREATE TABLE test_cases (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            priority TEXT NOT NULL DEFAULT 'Medium',
            test_type TEXT NOT NULL DEFAULT 'Automated',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| DbError::MigrationError(e.to_string()))?;

    // Create index for faster lookups
    sqlx::query("CREATE INDEX idx_test_cases_project ON test_cases(project_id)")
        .execute(pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

    Ok(())
}

async fn create_scenarios_table(pool: &Pool<Sqlite>) -> Result<(), DbError> {
    sqlx::query(
        r#"
        CREATE TABLE scenarios (
            id TEXT PRIMARY KEY,
            test_case_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            target_url TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| DbError::MigrationError(e.to_string()))?;

    sqlx::query("CREATE INDEX idx_scenarios_test_case ON scenarios(test_case_id)")
        .execute(pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

    Ok(())
}

async fn create_steps_table(pool: &Pool<Sqlite>) -> Result<(), DbError> {
    sqlx::query(
        r#"
        CREATE TABLE steps (
            id TEXT PRIMARY KEY,
            scenario_id TEXT NOT NULL,
            step_order INTEGER NOT NULL,
            step_type TEXT NOT NULL,
            label TEXT NOT NULL,
            config TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| DbError::MigrationError(e.to_string()))?;

    sqlx::query("CREATE INDEX idx_steps_scenario ON steps(scenario_id)")
        .execute(pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

    Ok(())
}

async fn create_test_runs_table(pool: &Pool<Sqlite>) -> Result<(), DbError> {
    sqlx::query(
        r#"
        CREATE TABLE test_runs (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            duration_ms INTEGER,
            passed INTEGER NOT NULL DEFAULT 0,
            failed INTEGER NOT NULL DEFAULT 0,
            skipped INTEGER NOT NULL DEFAULT 0,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| DbError::MigrationError(e.to_string()))?;

    sqlx::query("CREATE INDEX idx_test_runs_project ON test_runs(project_id)")
        .execute(pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

    Ok(())
}

async fn create_step_results_table(pool: &Pool<Sqlite>) -> Result<(), DbError> {
    sqlx::query(
        r#"
        CREATE TABLE step_results (
            id TEXT PRIMARY KEY,
            test_run_id TEXT NOT NULL,
            step_id TEXT NOT NULL,
            test_case_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            duration_ms INTEGER,
            error_message TEXT,
            screenshot_path TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (test_run_id) REFERENCES test_runs(id) ON DELETE CASCADE,
            FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE,
            FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| DbError::MigrationError(e.to_string()))?;

    sqlx::query("CREATE INDEX idx_step_results_run ON step_results(test_run_id)")
        .execute(pool)
        .await
        .map_err(|e| DbError::MigrationError(e.to_string()))?;

    Ok(())
}
