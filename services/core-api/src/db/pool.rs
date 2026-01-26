use sqlx::{postgres::PgPoolOptions, PgPool};

#[derive(Clone)]
pub struct DbPool {
    pool: PgPool,
}

impl DbPool {
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .min_connections(2)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .idle_timeout(std::time::Duration::from_secs(600))
            .connect(database_url)
            .await?;

        tracing::info!("Database connection pool established");

        Ok(Self { pool })
    }

    pub fn get_pool(&self) -> &PgPool {
        &self.pool
    }

    pub async fn run_migrations(&self) -> Result<(), sqlx::migrate::MigrateError> {
        sqlx::migrate!("./src/db/migrations")
            .run(&self.pool)
            .await?;

        tracing::info!("Database migrations completed");
        Ok(())
    }
}

impl std::ops::Deref for DbPool {
    type Target = PgPool;

    fn deref(&self) -> &Self::Target {
        &self.pool
    }
}
