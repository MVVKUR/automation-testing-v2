"""Celery application for async job processing."""

import logging
from typing import Any, Optional

from celery import Celery

from src.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Initialize Celery app
celery_app = Celery(
    "ai_agent",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=settings.job_timeout_seconds,
    task_soft_time_limit=settings.job_timeout_seconds - 30,
    worker_prefetch_multiplier=1,
    worker_concurrency=settings.max_concurrent_jobs,
    result_expires=3600,  # Results expire after 1 hour
)


@celery_app.task(bind=True, name="analyze_code")
def analyze_code_task(
    self,
    code: str,
    language: str,
    analysis_type: str = "full",
    context: Optional[str] = None,
) -> dict[str, Any]:
    """Celery task for async code analysis.

    Args:
        code: Source code to analyze
        language: Programming language
        analysis_type: Type of analysis
        context: Additional context

    Returns:
        Analysis result as dictionary
    """
    import asyncio

    from src.agents.analyzer import CodeAnalyzer
    from src.api.schemas import AnalysisType

    logger.info(f"Starting analysis task {self.request.id}")

    try:
        analyzer = CodeAnalyzer(
            api_key=settings.anthropic_api_key,
            model=settings.anthropic_model,
        )

        # Run async code in sync context
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                analyzer.analyze(
                    code=code,
                    language=language,
                    analysis_type=AnalysisType(analysis_type),
                    context=context,
                )
            )
        finally:
            loop.close()

        logger.info(f"Analysis task {self.request.id} completed")
        return result.model_dump()

    except Exception as e:
        logger.error(f"Analysis task {self.request.id} failed: {e}")
        raise


@celery_app.task(bind=True, name="generate_tests")
def generate_tests_task(
    self,
    code: str,
    language: str,
    framework: str,
    coverage_targets: Optional[list[str]] = None,
    test_style: str = "unit",
    additional_instructions: Optional[str] = None,
) -> dict[str, Any]:
    """Celery task for async test generation.

    Args:
        code: Source code to generate tests for
        language: Programming language
        framework: Test framework
        coverage_targets: Specific targets to cover
        test_style: Type of tests
        additional_instructions: Additional instructions

    Returns:
        Generated test as dictionary
    """
    import asyncio

    from src.agents.generator import TestGenerator
    from src.api.schemas import TestFramework

    logger.info(f"Starting generation task {self.request.id}")

    try:
        generator = TestGenerator(
            api_key=settings.anthropic_api_key,
            model=settings.anthropic_model,
        )

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                generator.generate(
                    code=code,
                    language=language,
                    framework=TestFramework(framework),
                    coverage_targets=coverage_targets,
                    test_style=test_style,
                    additional_instructions=additional_instructions,
                )
            )
        finally:
            loop.close()

        logger.info(f"Generation task {self.request.id} completed")
        return result.model_dump()

    except Exception as e:
        logger.error(f"Generation task {self.request.id} failed: {e}")
        raise


@celery_app.task(bind=True, name="suggest_improvements")
def suggest_improvements_task(
    self,
    code: str,
    existing_tests: str,
    language: str,
    framework: str,
) -> dict[str, Any]:
    """Celery task for async test improvement suggestions.

    Args:
        code: Source code
        existing_tests: Existing test code
        language: Programming language
        framework: Test framework

    Returns:
        Suggestions result as dictionary
    """
    import asyncio

    from src.agents.generator import TestGenerator
    from src.api.schemas import TestFramework

    logger.info(f"Starting suggestion task {self.request.id}")

    try:
        generator = TestGenerator(
            api_key=settings.anthropic_api_key,
            model=settings.anthropic_model,
        )

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                generator.suggest_improvements(
                    code=code,
                    existing_tests=existing_tests,
                    language=language,
                    framework=TestFramework(framework),
                )
            )
        finally:
            loop.close()

        logger.info(f"Suggestion task {self.request.id} completed")
        return result.model_dump()

    except Exception as e:
        logger.error(f"Suggestion task {self.request.id} failed: {e}")
        raise


def get_task_status(task_id: str) -> dict[str, Any]:
    """Get the status of a Celery task.

    Args:
        task_id: Task ID

    Returns:
        Task status dictionary
    """
    from celery.result import AsyncResult

    result = AsyncResult(task_id, app=celery_app)

    status_map = {
        "PENDING": "pending",
        "STARTED": "running",
        "SUCCESS": "completed",
        "FAILURE": "failed",
        "REVOKED": "failed",
    }

    return {
        "task_id": task_id,
        "status": status_map.get(result.status, result.status.lower()),
        "result": result.result if result.ready() else None,
        "error": str(result.result) if result.failed() else None,
    }
