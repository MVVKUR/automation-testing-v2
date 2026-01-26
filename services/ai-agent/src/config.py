"""Configuration settings for AI Agent service."""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # API Settings
    app_name: str = "AI Agent Service"
    app_version: str = "0.1.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8081

    # Anthropic Settings
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"
    anthropic_max_tokens: int = 8192

    # Redis Settings
    redis_url: str = "redis://localhost:6379/0"
    redis_password: Optional[str] = None

    # Celery Settings
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Job Settings
    job_timeout_seconds: int = 300
    max_concurrent_jobs: int = 10

    @property
    def celery_broker(self) -> str:
        """Get Celery broker URL with password if set."""
        if self.redis_password:
            return self.celery_broker_url.replace("://", f"://:{self.redis_password}@")
        return self.celery_broker_url

    @property
    def celery_backend(self) -> str:
        """Get Celery result backend URL with password if set."""
        if self.redis_password:
            return self.celery_result_backend.replace("://", f"://:{self.redis_password}@")
        return self.celery_result_backend


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
