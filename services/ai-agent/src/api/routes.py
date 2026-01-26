"""API routes for AI Agent service."""

import logging
from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from src.agents.analyzer import CodeAnalyzer
from src.agents.generator import TestGenerator
from src.agents.requirements_parser import RequirementsParser
from src.agents.scenario_builder import ScenarioBuilder
from src.api.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    BuildScenarioRequest,
    BuildScenarioResponse,
    CoverageAnalysisRequest,
    CoverageAnalysisResponse,
    ExtractTestCasesRequest,
    GenerateRequest,
    GenerateResponse,
    JobResponse,
    JobResult,
    JobStatus,
    ParseRequirementsRequest,
    RequirementsParseResponse,
    SuggestRequest,
    SuggestResponse,
    TestScenariosResponse,
)
from src.config import get_settings
from src.tasks.celery_app import celery_app
from src.tasks.job_store import get_job_store

logger = logging.getLogger(__name__)
router = APIRouter(tags=["AI Agent"])


def get_analyzer() -> CodeAnalyzer:
    """Get CodeAnalyzer instance."""
    settings = get_settings()
    return CodeAnalyzer(
        api_key=settings.anthropic_api_key,
        model=settings.anthropic_model,
    )


def get_generator() -> TestGenerator:
    """Get TestGenerator instance."""
    settings = get_settings()
    return TestGenerator(
        api_key=settings.anthropic_api_key,
        model=settings.anthropic_model,
    )


def get_requirements_parser() -> RequirementsParser:
    """Get RequirementsParser instance."""
    settings = get_settings()
    return RequirementsParser(
        api_key=settings.anthropic_api_key,
        model=settings.anthropic_model,
    )


def get_scenario_builder() -> ScenarioBuilder:
    """Get ScenarioBuilder instance."""
    settings = get_settings()
    return ScenarioBuilder(
        api_key=settings.anthropic_api_key,
        model=settings.anthropic_model,
    )


# ============================================================================
# Code Analysis Endpoints
# ============================================================================


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_code(request: AnalyzeRequest) -> AnalyzeResponse:
    """
    Analyze source code for structure, complexity, and testability.

    This endpoint performs synchronous code analysis using Claude AI.
    """
    logger.info(f"Analyzing {request.language} code, type: {request.analysis_type}")

    try:
        analyzer = get_analyzer()
        result = await analyzer.analyze(
            code=request.code,
            language=request.language,
            analysis_type=request.analysis_type,
            context=request.context,
        )
        return AnalyzeResponse(success=True, result=result)
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return AnalyzeResponse(success=False, error=str(e))


@router.post("/analyze/async", response_model=JobResponse)
async def analyze_code_async(
    request: AnalyzeRequest,
    background_tasks: BackgroundTasks,
) -> JobResponse:
    """
    Start async code analysis job.

    Returns a job ID that can be used to poll for results.
    """
    job_id = str(uuid4())
    job_store = get_job_store()
    job = job_store.create_job(job_id)

    # Queue the task
    background_tasks.add_task(
        run_analysis_job,
        job_id=job_id,
        request=request,
    )

    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        created_at=job.created_at,
        message="Analysis job queued",
    )


async def run_analysis_job(job_id: str, request: AnalyzeRequest) -> None:
    """Background task to run analysis job."""
    job_store = get_job_store()
    job_store.mark_running(job_id)

    try:
        analyzer = get_analyzer()
        result = await analyzer.analyze(
            code=request.code,
            language=request.language,
            analysis_type=request.analysis_type,
            context=request.context,
        )
        job_store.mark_completed(job_id, result.model_dump())
    except Exception as e:
        logger.error(f"Analysis job {job_id} failed: {e}")
        job_store.mark_failed(job_id, str(e))


# ============================================================================
# Test Generation Endpoints
# ============================================================================


@router.post("/generate", response_model=GenerateResponse)
async def generate_tests(request: GenerateRequest) -> GenerateResponse:
    """
    Generate test code for the provided source code.

    This endpoint uses Claude AI to generate comprehensive tests.
    """
    logger.info(f"Generating {request.framework} tests for {request.language} code")

    try:
        generator = get_generator()
        result = await generator.generate(
            code=request.code,
            language=request.language,
            framework=request.framework,
            coverage_targets=request.coverage_targets,
            test_style=request.test_style,
            additional_instructions=request.additional_instructions,
        )
        return GenerateResponse(success=True, result=result)
    except Exception as e:
        logger.error(f"Test generation failed: {e}")
        return GenerateResponse(success=False, error=str(e))


@router.post("/generate/async", response_model=JobResponse)
async def generate_tests_async(
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
) -> JobResponse:
    """
    Start async test generation job.

    Returns a job ID that can be used to poll for results.
    """
    job_id = str(uuid4())
    job_store = get_job_store()
    job = job_store.create_job(job_id)

    background_tasks.add_task(
        run_generation_job,
        job_id=job_id,
        request=request,
    )

    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        created_at=job.created_at,
        message="Test generation job queued",
    )


async def run_generation_job(job_id: str, request: GenerateRequest) -> None:
    """Background task to run generation job."""
    job_store = get_job_store()
    job_store.mark_running(job_id)

    try:
        generator = get_generator()
        result = await generator.generate(
            code=request.code,
            language=request.language,
            framework=request.framework,
            coverage_targets=request.coverage_targets,
            test_style=request.test_style,
            additional_instructions=request.additional_instructions,
        )
        job_store.mark_completed(job_id, result.model_dump())
    except Exception as e:
        logger.error(f"Generation job {job_id} failed: {e}")
        job_store.mark_failed(job_id, str(e))


@router.post("/suggest", response_model=SuggestResponse)
async def suggest_improvements(request: SuggestRequest) -> SuggestResponse:
    """
    Analyze existing tests and suggest improvements.

    Provides recommendations for better test coverage and quality.
    """
    logger.info(f"Generating suggestions for {request.language} tests")

    try:
        generator = get_generator()
        result = await generator.suggest_improvements(
            code=request.code,
            existing_tests=request.existing_tests,
            language=request.language,
            framework=request.framework,
        )
        return SuggestResponse(success=True, result=result)
    except Exception as e:
        logger.error(f"Suggestion generation failed: {e}")
        return SuggestResponse(success=False, error=str(e))


# ============================================================================
# Requirements Parsing Endpoints
# ============================================================================


@router.post("/requirements/parse", response_model=RequirementsParseResponse)
async def parse_requirements(request: ParseRequirementsRequest) -> RequirementsParseResponse:
    """
    Parse a requirements document and extract test scenarios.

    Supports various document types including user stories, BRD, PRD.
    """
    logger.info(f"Parsing {request.document_type} document")

    try:
        parser = get_requirements_parser()
        result = await parser.parse_requirements(
            content=request.content,
            document_type=request.document_type,
            context=request.context,
        )

        return RequirementsParseResponse(
            success=True,
            requirements=result.get("requirements", []),
            test_scenarios=result.get("test_scenarios", []),
            summary=result.get("summary"),
        )
    except Exception as e:
        logger.error(f"Requirements parsing failed: {e}")
        return RequirementsParseResponse(success=False, error=str(e))


@router.post("/requirements/parse/async", response_model=JobResponse)
async def parse_requirements_async(
    request: ParseRequirementsRequest,
    background_tasks: BackgroundTasks,
) -> JobResponse:
    """Start async requirements parsing job."""
    job_id = str(uuid4())
    job_store = get_job_store()
    job = job_store.create_job(job_id)

    background_tasks.add_task(
        run_requirements_parse_job,
        job_id=job_id,
        request=request,
    )

    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        created_at=job.created_at,
        message="Requirements parsing job queued",
    )


async def run_requirements_parse_job(
    job_id: str, request: ParseRequirementsRequest
) -> None:
    """Background task to parse requirements."""
    job_store = get_job_store()
    job_store.mark_running(job_id)

    try:
        parser = get_requirements_parser()
        result = await parser.parse_requirements(
            content=request.content,
            document_type=request.document_type,
            context=request.context,
        )
        job_store.mark_completed(job_id, result)
    except Exception as e:
        logger.error(f"Requirements parse job {job_id} failed: {e}")
        job_store.mark_failed(job_id, str(e))


@router.post("/requirements/extract-tests", response_model=TestScenariosResponse)
async def extract_test_cases(request: ExtractTestCasesRequest) -> TestScenariosResponse:
    """
    Extract detailed test cases from parsed requirements.

    Generates executable test scenarios with steps and selectors.
    """
    logger.info(f"Extracting test cases for {len(request.requirements)} requirements")

    try:
        parser = get_requirements_parser()
        scenarios = await parser.extract_test_cases(
            requirements=request.requirements,
            test_framework=request.test_framework.value,
            include_negative_cases=request.include_negative_cases,
        )

        return TestScenariosResponse(success=True, scenarios=scenarios)
    except Exception as e:
        logger.error(f"Test case extraction failed: {e}")
        return TestScenariosResponse(success=False, error=str(e))


@router.post("/requirements/coverage", response_model=CoverageAnalysisResponse)
async def analyze_coverage(request: CoverageAnalysisRequest) -> CoverageAnalysisResponse:
    """
    Analyze test coverage for requirements.

    Identifies gaps and provides recommendations.
    """
    logger.info("Analyzing test coverage")

    try:
        parser = get_requirements_parser()
        result = await parser.analyze_coverage(
            requirements=request.requirements,
            existing_tests=request.existing_tests,
        )

        return CoverageAnalysisResponse(
            success=True,
            overall_coverage=result.get("overall_coverage"),
            covered_requirements=result.get("covered_requirements", []),
            uncovered_requirements=result.get("uncovered_requirements", []),
            recommendations=result.get("recommendations", []),
        )
    except Exception as e:
        logger.error(f"Coverage analysis failed: {e}")
        return CoverageAnalysisResponse(success=False, error=str(e))


# ============================================================================
# Scenario Builder Endpoints
# ============================================================================


@router.post("/scenarios/build", response_model=BuildScenarioResponse)
async def build_scenario(request: BuildScenarioRequest) -> BuildScenarioResponse:
    """
    Build a test scenario from natural language description.

    Generates executable test steps and code.
    """
    logger.info(f"Building scenario for {request.framework}")

    try:
        builder = get_scenario_builder()
        scenario = await builder.build_scenario(
            description=request.description,
            base_url=request.base_url,
            framework=request.framework,
            include_assertions=request.include_assertions,
        )

        return BuildScenarioResponse(success=True, scenario=scenario)
    except Exception as e:
        logger.error(f"Scenario building failed: {e}")
        return BuildScenarioResponse(success=False, error=str(e))


@router.post("/scenarios/build/async", response_model=JobResponse)
async def build_scenario_async(
    request: BuildScenarioRequest,
    background_tasks: BackgroundTasks,
) -> JobResponse:
    """Start async scenario building job."""
    job_id = str(uuid4())
    job_store = get_job_store()
    job = job_store.create_job(job_id)

    background_tasks.add_task(
        run_scenario_build_job,
        job_id=job_id,
        request=request,
    )

    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        created_at=job.created_at,
        message="Scenario build job queued",
    )


async def run_scenario_build_job(
    job_id: str, request: BuildScenarioRequest
) -> None:
    """Background task to build scenario."""
    job_store = get_job_store()
    job_store.mark_running(job_id)

    try:
        builder = get_scenario_builder()
        scenario = await builder.build_scenario(
            description=request.description,
            base_url=request.base_url,
            framework=request.framework,
            include_assertions=request.include_assertions,
        )
        job_store.mark_completed(job_id, scenario.model_dump())
    except Exception as e:
        logger.error(f"Scenario build job {job_id} failed: {e}")
        job_store.mark_failed(job_id, str(e))


# ============================================================================
# Job Management Endpoints
# ============================================================================


@router.get("/jobs/{job_id}", response_model=JobResult)
async def get_job_status(job_id: str) -> JobResult:
    """
    Get the status and result of an async job.

    Poll this endpoint to check if a job has completed.
    """
    job_store = get_job_store()
    job = job_store.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    return job


@router.get("/jobs", response_model=list[JobResult])
async def list_jobs(
    status_filter: Optional[str] = None,
    limit: int = 50,
) -> list[JobResult]:
    """List all jobs, optionally filtered by status."""
    job_store = get_job_store()

    filter_status = None
    if status_filter:
        try:
            filter_status = JobStatus(status_filter)
        except ValueError:
            pass

    return job_store.list_jobs(status=filter_status, limit=limit)


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str) -> dict:
    """Cancel a pending or running job."""
    job_store = get_job_store()
    job = job_store.get_job(job_id)

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found",
        )

    if job.status in [JobStatus.COMPLETED, JobStatus.FAILED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job with status {job.status}",
        )

    # Try to revoke Celery task if using Celery
    try:
        celery_app.control.revoke(job_id, terminate=True)
    except Exception:
        pass

    job_store.mark_failed(job_id, "Job cancelled by user")

    return {"message": f"Job {job_id} cancelled"}


# ============================================================================
# Utility Endpoints
# ============================================================================


@router.get("/models")
async def list_models() -> dict:
    """List available Claude models."""
    return {
        "models": [
            {
                "id": "claude-opus-4-20250514",
                "name": "Claude Opus 4",
                "description": "Most capable model for complex tasks",
            },
            {
                "id": "claude-sonnet-4-20250514",
                "name": "Claude Sonnet 4",
                "description": "Balanced performance and speed (recommended)",
            },
            {
                "id": "claude-3-5-sonnet-20241022",
                "name": "Claude 3.5 Sonnet",
                "description": "Previous generation balanced model",
            },
            {
                "id": "claude-3-5-haiku-20241022",
                "name": "Claude 3.5 Haiku",
                "description": "Fastest model for quick tasks",
            },
        ],
        "default": "claude-sonnet-4-20250514",
    }


@router.get("/frameworks")
async def list_frameworks() -> dict:
    """List supported test frameworks."""
    return {
        "frameworks": [
            {
                "id": "cypress",
                "language": "javascript",
                "name": "Cypress",
                "description": "E2E testing for web applications",
            },
            {
                "id": "playwright",
                "language": "typescript",
                "name": "Playwright",
                "description": "Cross-browser testing automation",
            },
            {
                "id": "pytest",
                "language": "python",
                "name": "pytest",
                "description": "Python testing framework",
            },
            {
                "id": "jest",
                "language": "javascript",
                "name": "Jest",
                "description": "JavaScript testing framework",
            },
            {
                "id": "mocha",
                "language": "javascript",
                "name": "Mocha",
                "description": "Flexible JavaScript test framework",
            },
            {
                "id": "unittest",
                "language": "python",
                "name": "unittest",
                "description": "Python standard library testing",
            },
        ]
    }


@router.get("/languages")
async def list_languages() -> dict:
    """List supported programming languages."""
    return {
        "languages": [
            {"id": "python", "name": "Python", "extensions": [".py"]},
            {"id": "javascript", "name": "JavaScript", "extensions": [".js", ".mjs"]},
            {"id": "typescript", "name": "TypeScript", "extensions": [".ts", ".tsx"]},
            {"id": "java", "name": "Java", "extensions": [".java"]},
            {"id": "go", "name": "Go", "extensions": [".go"]},
            {"id": "rust", "name": "Rust", "extensions": [".rs"]},
            {"id": "ruby", "name": "Ruby", "extensions": [".rb"]},
            {"id": "c", "name": "C", "extensions": [".c", ".h"]},
            {"id": "cpp", "name": "C++", "extensions": [".cpp", ".hpp", ".cc"]},
        ]
    }
