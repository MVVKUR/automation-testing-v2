pub mod auth;
pub mod projects;
pub mod test_cases;
pub mod scenarios;

use axum::{http::StatusCode, Json};
use serde_json::{json, Value};

pub async fn health_check() -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "status": "healthy",
            "service": "core-api",
            "version": env!("CARGO_PKG_VERSION")
        })),
    )
}
