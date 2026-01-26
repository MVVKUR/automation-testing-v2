use std::sync::Arc;

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{extract::State, http::StatusCode, Json};
use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{AuthResponse, Claims, CreateUserRequest, LoginRequest, User, UserResponse},
    AppState,
};

pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUserRequest>,
) -> AppResult<(StatusCode, Json<AuthResponse>)> {
    // Check if user already exists
    let existing_user: Option<User> = sqlx::query_as(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(&payload.email)
    .fetch_optional(state.db.get_pool())
    .await?;

    if existing_user.is_some() {
        return Err(AppError::Conflict("User with this email already exists".to_string()));
    }

    // Hash password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(payload.password.as_bytes(), &salt)
        .map_err(|e| AppError::InternalError(format!("Password hashing failed: {}", e)))?
        .to_string();

    // Create user
    let user: User = sqlx::query_as(
        r#"
        INSERT INTO users (email, password_hash, name, role)
        VALUES ($1, $2, $3, 'user')
        RETURNING *
        "#,
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.name)
    .fetch_one(state.db.get_pool())
    .await?;

    // Generate JWT token
    let token = generate_jwt(&user, &state.config.jwt_secret, state.config.jwt_expiration_hours)?;

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            token,
            user: user.into(),
        }),
    ))
}

pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LoginRequest>,
) -> AppResult<Json<AuthResponse>> {
    // Find user by email
    let user: User = sqlx::query_as(
        "SELECT * FROM users WHERE email = $1 AND is_active = true"
    )
    .bind(&payload.email)
    .fetch_optional(state.db.get_pool())
    .await?
    .ok_or_else(|| AppError::AuthError("Invalid email or password".to_string()))?;

    // Verify password
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|e| AppError::InternalError(format!("Password hash parsing failed: {}", e)))?;

    Argon2::default()
        .verify_password(payload.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::AuthError("Invalid email or password".to_string()))?;

    // Generate JWT token
    let token = generate_jwt(&user, &state.config.jwt_secret, state.config.jwt_expiration_hours)?;

    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

fn generate_jwt(user: &User, secret: &str, expiration_hours: i64) -> AppResult<String> {
    let now = Utc::now();
    let exp = now + chrono::Duration::hours(expiration_hours);

    let claims = Claims {
        sub: user.id,
        email: user.email.clone(),
        role: user.role.clone(),
        exp: exp.timestamp(),
        iat: now.timestamp(),
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;

    Ok(token)
}
