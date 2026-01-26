mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;

use axum::{
    routing::{get, post, put, delete},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::db::pool::DbPool;
use crate::middleware::auth::auth_middleware;

pub struct AppState {
    pub db: DbPool,
    pub config: Config,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "core_api=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    dotenvy::dotenv().ok();

    let config = Config::from_env()?;
    let db_pool = DbPool::connect(&config.database_url).await?;

    let app_state = Arc::new(AppState {
        db: db_pool,
        config,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let public_routes = Router::new()
        .route("/health", get(handlers::health_check))
        .route("/auth/register", post(handlers::auth::register))
        .route("/auth/login", post(handlers::auth::login));

    let protected_routes = Router::new()
        .route("/projects", get(handlers::projects::list_projects))
        .route("/projects", post(handlers::projects::create_project))
        .route("/projects/{id}", get(handlers::projects::get_project))
        .route("/projects/{id}", put(handlers::projects::update_project))
        .route("/projects/{id}", delete(handlers::projects::delete_project))
        .route("/projects/{project_id}/test-cases", get(handlers::test_cases::list_test_cases))
        .route("/projects/{project_id}/test-cases", post(handlers::test_cases::create_test_case))
        .route("/test-cases/{id}", get(handlers::test_cases::get_test_case))
        .route("/test-cases/{id}", put(handlers::test_cases::update_test_case))
        .route("/test-cases/{id}", delete(handlers::test_cases::delete_test_case))
        .route("/test-cases/{test_case_id}/scenarios", get(handlers::scenarios::list_scenarios))
        .route("/test-cases/{test_case_id}/scenarios", post(handlers::scenarios::create_scenario))
        .route("/scenarios/{id}", get(handlers::scenarios::get_scenario))
        .route("/scenarios/{id}", put(handlers::scenarios::update_scenario))
        .route("/scenarios/{id}", delete(handlers::scenarios::delete_scenario))
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            auth_middleware,
        ));

    let app = Router::new()
        .merge(public_routes)
        .nest("/api/v1", protected_routes)
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(app_state);

    let addr = "0.0.0.0:8080";
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
