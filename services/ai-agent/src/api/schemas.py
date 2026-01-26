"""Pydantic models for API request/response schemas."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    """Job execution status."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisType(str, Enum):
    """Types of code analysis."""

    STRUCTURE = "structure"
    COMPLEXITY = "complexity"
    DEPENDENCIES = "dependencies"
    SECURITY = "security"
    TESTABILITY = "testability"
    FULL = "full"


class TestFramework(str, Enum):
    """Supported test frameworks."""

    PYTEST = "pytest"
    UNITTEST = "unittest"
    JEST = "jest"
    MOCHA = "mocha"
    PLAYWRIGHT = "playwright"
    CYPRESS = "cypress"


class RequirementType(str, Enum):
    """Types of requirements."""

    FUNCTIONAL = "functional"
    NON_FUNCTIONAL = "non_functional"
    SECURITY = "security"
    PERFORMANCE = "performance"
    ACCESSIBILITY = "accessibility"


class Priority(str, Enum):
    """Priority levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# Request Models
class AnalyzeRequest(BaseModel):
    """Request model for code analysis."""

    code: str = Field(..., description="Source code to analyze")
    language: str = Field(..., description="Programming language (e.g., python, javascript)")
    analysis_type: AnalysisType = Field(
        default=AnalysisType.FULL, description="Type of analysis to perform"
    )
    context: Optional[str] = Field(None, description="Additional context for analysis")

    class Config:
        json_schema_extra = {
            "example": {
                "code": "def add(a, b):\n    return a + b",
                "language": "python",
                "analysis_type": "full",
                "context": "Simple utility function",
            }
        }


class GenerateRequest(BaseModel):
    """Request model for test generation."""

    code: str = Field(..., description="Source code to generate tests for")
    language: str = Field(..., description="Programming language")
    framework: TestFramework = Field(..., description="Test framework to use")
    coverage_targets: Optional[list[str]] = Field(
        None, description="Specific functions/methods to cover"
    )
    test_style: Optional[str] = Field(
        "unit", description="Test style: unit, integration, e2e"
    )
    additional_instructions: Optional[str] = Field(
        None, description="Additional instructions for test generation"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "code": "def add(a, b):\n    return a + b",
                "language": "python",
                "framework": "pytest",
                "test_style": "unit",
            }
        }


class SuggestRequest(BaseModel):
    """Request model for test improvement suggestions."""

    code: str = Field(..., description="Source code")
    existing_tests: str = Field(..., description="Existing test code")
    language: str = Field(..., description="Programming language")
    framework: TestFramework = Field(..., description="Test framework")

    class Config:
        json_schema_extra = {
            "example": {
                "code": "def add(a, b):\n    return a + b",
                "existing_tests": "def test_add():\n    assert add(1, 2) == 3",
                "language": "python",
                "framework": "pytest",
            }
        }


# Response Models
class AnalysisResult(BaseModel):
    """Result of code analysis."""

    summary: str = Field(..., description="Summary of the analysis")
    structure: Optional[dict[str, Any]] = Field(None, description="Code structure breakdown")
    complexity: Optional[dict[str, Any]] = Field(None, description="Complexity metrics")
    dependencies: Optional[list[str]] = Field(None, description="Identified dependencies")
    issues: Optional[list[dict[str, Any]]] = Field(None, description="Identified issues")
    recommendations: list[str] = Field(
        default_factory=list, description="Improvement recommendations"
    )
    testability_score: Optional[float] = Field(
        None, description="Testability score from 0 to 1"
    )


class GeneratedTest(BaseModel):
    """Generated test code."""

    test_code: str = Field(..., description="Generated test code")
    test_file_name: str = Field(..., description="Suggested test file name")
    imports: list[str] = Field(default_factory=list, description="Required imports")
    setup_instructions: Optional[str] = Field(
        None, description="Setup instructions for running tests"
    )
    coverage_estimate: Optional[float] = Field(
        None, description="Estimated code coverage"
    )


class Suggestion(BaseModel):
    """Test improvement suggestion."""

    category: str = Field(..., description="Suggestion category")
    description: str = Field(..., description="Detailed description")
    priority: str = Field(..., description="Priority: high, medium, low")
    code_example: Optional[str] = Field(None, description="Example code if applicable")


class SuggestionsResult(BaseModel):
    """Result of test suggestions analysis."""

    suggestions: list[Suggestion] = Field(
        default_factory=list, description="List of suggestions"
    )
    missing_coverage: list[str] = Field(
        default_factory=list, description="Uncovered code paths"
    )
    overall_assessment: str = Field(..., description="Overall assessment of test quality")


class JobResponse(BaseModel):
    """Response model for async job creation."""

    job_id: str = Field(..., description="Unique job identifier")
    status: JobStatus = Field(..., description="Current job status")
    created_at: datetime = Field(..., description="Job creation timestamp")
    message: str = Field(..., description="Status message")


class JobResult(BaseModel):
    """Result of an async job."""

    job_id: str = Field(..., description="Job identifier")
    status: JobStatus = Field(..., description="Job status")
    created_at: datetime = Field(..., description="Creation timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    result: Optional[dict[str, Any]] = Field(None, description="Job result data")
    error: Optional[str] = Field(None, description="Error message if failed")


class AnalyzeResponse(BaseModel):
    """Response model for synchronous analysis."""

    success: bool = Field(..., description="Whether analysis succeeded")
    result: Optional[AnalysisResult] = Field(None, description="Analysis result")
    error: Optional[str] = Field(None, description="Error message if failed")


class GenerateResponse(BaseModel):
    """Response model for synchronous test generation."""

    success: bool = Field(..., description="Whether generation succeeded")
    result: Optional[GeneratedTest] = Field(None, description="Generated test")
    error: Optional[str] = Field(None, description="Error message if failed")


class SuggestResponse(BaseModel):
    """Response model for synchronous suggestions."""

    success: bool = Field(..., description="Whether suggestion generation succeeded")
    result: Optional[SuggestionsResult] = Field(None, description="Suggestions result")
    error: Optional[str] = Field(None, description="Error message if failed")


# Requirements Parsing Models
class TestStep(BaseModel):
    """A single step in a test scenario."""

    order: int = Field(..., description="Step order/sequence number")
    action: str = Field(..., description="Action to perform")
    target: Optional[str] = Field(None, description="Target element or endpoint")
    selector: Optional[str] = Field(None, description="CSS/XPath selector for UI tests")
    value: Optional[str] = Field(None, description="Input value if applicable")
    assertion: Optional[dict[str, Any]] = Field(None, description="Assertion to verify")


class TestScenario(BaseModel):
    """A complete test scenario extracted from requirements."""

    id: str = Field(..., description="Unique scenario identifier")
    requirement_id: Optional[str] = Field(None, description="Related requirement ID")
    name: str = Field(..., description="Scenario name")
    description: str = Field(..., description="Scenario description")
    steps: list[TestStep] = Field(default_factory=list, description="Test steps")
    tags: list[str] = Field(default_factory=list, description="Tags for categorization")
    test_data: Optional[dict[str, Any]] = Field(None, description="Test data")
    expected_outcome: Optional[str] = Field(None, description="Expected test outcome")
    is_negative: bool = Field(False, description="Whether this is a negative test case")
    preconditions: list[str] = Field(default_factory=list, description="Test preconditions")
    postconditions: list[str] = Field(default_factory=list, description="Expected postconditions")


class ParsedRequirement(BaseModel):
    """A parsed requirement from a document."""

    id: str = Field(..., description="Requirement ID")
    title: str = Field(..., description="Requirement title")
    description: str = Field(..., description="Full requirement description")
    type: RequirementType = Field(..., description="Requirement type")
    priority: Priority = Field(..., description="Requirement priority")
    acceptance_criteria: list[str] = Field(default_factory=list, description="Acceptance criteria")
    source_text: Optional[str] = Field(None, description="Original source text")


class ParseRequirementsRequest(BaseModel):
    """Request model for requirements parsing."""

    content: str = Field(..., description="Requirements document content")
    document_type: str = Field(
        default="requirements",
        description="Document type: requirements, user_stories, brd, prd",
    )
    context: Optional[str] = Field(None, description="Additional project context")
    target_framework: TestFramework = Field(
        default=TestFramework.CYPRESS,
        description="Target test framework for generated scenarios",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "content": "As a user, I want to log in with my email and password...",
                "document_type": "user_stories",
                "target_framework": "cypress",
            }
        }


class ExtractTestCasesRequest(BaseModel):
    """Request model for extracting test cases from requirements."""

    requirements: list[dict[str, Any]] = Field(..., description="Parsed requirements")
    test_framework: TestFramework = Field(
        default=TestFramework.CYPRESS,
        description="Target test framework",
    )
    include_negative_cases: bool = Field(
        default=True,
        description="Whether to include negative test cases",
    )


class CoverageAnalysisRequest(BaseModel):
    """Request model for coverage analysis."""

    requirements: list[dict[str, Any]] = Field(..., description="Parsed requirements")
    existing_tests: Optional[str] = Field(None, description="Existing test code")


class RequirementsParseResponse(BaseModel):
    """Response model for requirements parsing."""

    success: bool = Field(..., description="Whether parsing succeeded")
    requirements: list[dict[str, Any]] = Field(
        default_factory=list, description="Parsed requirements"
    )
    test_scenarios: list[dict[str, Any]] = Field(
        default_factory=list, description="Generated test scenarios"
    )
    summary: Optional[dict[str, Any]] = Field(None, description="Parsing summary")
    error: Optional[str] = Field(None, description="Error message if failed")


class TestScenariosResponse(BaseModel):
    """Response model for test scenario extraction."""

    success: bool = Field(..., description="Whether extraction succeeded")
    scenarios: list[TestScenario] = Field(
        default_factory=list, description="Extracted test scenarios"
    )
    error: Optional[str] = Field(None, description="Error message if failed")


class CoverageAnalysisResponse(BaseModel):
    """Response model for coverage analysis."""

    success: bool = Field(..., description="Whether analysis succeeded")
    overall_coverage: Optional[float] = Field(None, description="Overall coverage percentage")
    covered_requirements: list[str] = Field(
        default_factory=list, description="Covered requirement IDs"
    )
    uncovered_requirements: list[str] = Field(
        default_factory=list, description="Uncovered requirement IDs"
    )
    recommendations: list[dict[str, Any]] = Field(
        default_factory=list, description="Coverage recommendations"
    )
    error: Optional[str] = Field(None, description="Error message if failed")


# Scenario Builder Models
class ScenarioStep(BaseModel):
    """A step in a test scenario for the scenario builder."""

    id: str = Field(..., description="Step ID")
    type: str = Field(..., description="Step type: action, assertion, navigation")
    action: str = Field(..., description="Action name: click, type, navigate, assert")
    target: Optional[str] = Field(None, description="Target description")
    selector: Optional[str] = Field(None, description="Element selector")
    value: Optional[str] = Field(None, description="Input or expected value")
    timeout: Optional[int] = Field(None, description="Step timeout in ms")


class BuildScenarioRequest(BaseModel):
    """Request to build a test scenario from natural language."""

    description: str = Field(..., description="Natural language description of the test")
    base_url: Optional[str] = Field(None, description="Base URL for the application")
    framework: TestFramework = Field(
        default=TestFramework.CYPRESS,
        description="Target test framework",
    )
    include_assertions: bool = Field(True, description="Auto-generate assertions")

    class Config:
        json_schema_extra = {
            "example": {
                "description": "Test user login with valid credentials, verify redirect to dashboard",
                "base_url": "https://example.com",
                "framework": "cypress",
            }
        }


class BuiltScenario(BaseModel):
    """A scenario built from natural language description."""

    id: str = Field(..., description="Generated scenario ID")
    name: str = Field(..., description="Generated scenario name")
    description: str = Field(..., description="Scenario description")
    steps: list[ScenarioStep] = Field(..., description="Scenario steps")
    generated_code: Optional[str] = Field(None, description="Generated test code")
    framework: TestFramework = Field(..., description="Target framework")


class BuildScenarioResponse(BaseModel):
    """Response for scenario building."""

    success: bool = Field(..., description="Whether building succeeded")
    scenario: Optional[BuiltScenario] = Field(None, description="Built scenario")
    error: Optional[str] = Field(None, description="Error message if failed")
