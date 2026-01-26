use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Authentication failed: {0}")]
    AuthError(String),

    #[error("Authorization failed: {0}")]
    Unauthorized(String),

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("JWT error: {0}")]
    JwtError(#[from] jsonwebtoken::errors::Error),

    #[error("Internal server error: {0}")]
    InternalError(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Conflict: {0}")]
    Conflict(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            AppError::AuthError(msg) => (StatusCode::UNAUTHORIZED, msg.clone()),
            AppError::Unauthorized(msg) => (StatusCode::FORBIDDEN, msg.clone()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::ValidationError(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::DatabaseError(e) => {
                tracing::error!("Database error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Database error occurred".to_string(),
                )
            }
            AppError::JwtError(e) => {
                tracing::error!("JWT error: {:?}", e);
                (StatusCode::UNAUTHORIZED, "Invalid token".to_string())
            }
            AppError::InternalError(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, msg.clone())
            }
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
        };

        let body = Json(json!({
            "error": {
                "message": error_message,
                "code": status.as_u16()
            }
        }));

        (status, body).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
