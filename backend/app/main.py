import platform
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import init_db
from app.routers import (
    projects_router,
    test_cases_router,
    scenarios_router,
    steps_router,
    test_runs_router,
    step_results_router,
    services_router,
    ai_router,
    mobile_router,
    integrations_router,
    test_runner_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    print(f"Starting {settings.app_name} v{settings.app_version}")
    print(f"Database: {settings.get_database_path()}")
    await init_db()
    yield
    # Shutdown
    print("Shutting down...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects_router, prefix="/api")
app.include_router(test_cases_router, prefix="/api")
app.include_router(scenarios_router, prefix="/api")
app.include_router(steps_router, prefix="/api")
app.include_router(test_runs_router, prefix="/api")
app.include_router(step_results_router, prefix="/api")
app.include_router(services_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(mobile_router, prefix="/api")
app.include_router(integrations_router, prefix="/api")
app.include_router(test_runner_router, prefix="/api")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
    }


@app.get("/api/app-info")
async def get_app_info():
    """Get application info"""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "platform": platform.system().lower(),
        "arch": platform.machine(),
    }


@app.get("/api/platform")
async def get_platform():
    """Get platform info"""
    return platform.system().lower()


@app.get("/api/db-path")
async def get_db_path():
    """Get database path"""
    return str(settings.get_database_path())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
