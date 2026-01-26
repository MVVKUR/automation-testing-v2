use std::sync::Arc;

use axum::{
    body::Body,
    extract::State,
    http::{header, Request, StatusCode},
    middleware::Next,
    response::Response,
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde_json::json;

use crate::{models::Claims, AppState};

pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|header| header.to_str().ok());

    let token = match auth_header {
        Some(header) if header.starts_with("Bearer ") => &header[7..],
        _ => {
            return Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({
                    "error": {
                        "message": "Missing or invalid authorization header",
                        "code": 401
                    }
                })),
            ));
        }
    };

    let claims = decode::<Claims>(
        token,
        &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|e| {
        tracing::warn!("JWT validation failed: {:?}", e);
        (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": {
                    "message": "Invalid or expired token",
                    "code": 401
                }
            })),
        )
    })?
    .claims;

    // Insert claims into request extensions for use in handlers
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}
