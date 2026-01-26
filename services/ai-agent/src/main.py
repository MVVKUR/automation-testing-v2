"""Main FastAPI application for AI Agent service."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.config import get_settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup and shutdown events."""
    settings = get_settings()
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Debug mode: {settings.debug}")
    yield
    logger.info("Shutting down AI Agent service")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="AI Agent service for code analysis and test generation using Claude",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include API routes
    app.include_router(router, prefix="/api/v1")

    @app.get("/health")
    async def health_check() -> dict:
        """Health check endpoint."""
        return {
            "status": "healthy",
            "service": settings.app_name,
            "version": settings.app_version,
        }

    @app.get("/")
    async def root() -> dict:
        """Root endpoint."""
        return {
            "message": "AI Agent Service",
            "version": settings.app_version,
            "docs": "/docs",
        }

    return app


app = create_app()


def main() -> None:
    """Run the application using uvicorn."""
    settings = get_settings()
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )


if __name__ == "__main__":
    main()
