use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};
use std::path::PathBuf;
use thiserror::Error;

pub mod migrations;

pub type DbPool = Pool<Sqlite>;

#[derive(Error, Debug)]
pub enum DbError {
    #[error("Database connection error: {0}")]
    ConnectionError(#[from] sqlx::Error),

    #[error("Migration error: {0}")]
    MigrationError(String),

    #[error("Database path error: {0}")]
    PathError(String),
}

/// Get the application data directory for storing the database
pub fn get_db_path() -> Result<PathBuf, DbError> {
    let proj_dirs = directories::ProjectDirs::from("com", "autotest", "ai")
        .ok_or_else(|| DbError::PathError("Could not determine app data directory".into()))?;

    let data_dir = proj_dirs.data_dir();

    // Ensure the directory exists
    std::fs::create_dir_all(data_dir)
        .map_err(|e| DbError::PathError(format!("Failed to create data directory: {}", e)))?;

    Ok(data_dir.join("autotest.db"))
}

/// Initialize the database connection pool
pub async fn init_pool() -> Result<DbPool, DbError> {
    let db_path = get_db_path()?;
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    log::info!("Initializing database at: {}", db_path.display());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    // Run migrations
    migrations::run(&pool).await?;

    log::info!("Database initialized successfully");

    Ok(pool)
}
