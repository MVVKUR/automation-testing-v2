from typing import Optional, List, Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/ai", tags=["ai"])


# ============================================
# Request/Response Models
# ============================================


class AnalyzeCodeRequest(BaseModel):
    code: str
    language: str
    context: Optional[str] = None


class FunctionInfo(BaseModel):
    name: str
    parameters: List[str]
    return_type: Optional[str]
    line_start: int
    line_end: int


class CodeAnalysis(BaseModel):
    functions: List[FunctionInfo]
    complexity: str
    test_coverage_suggestion: str


class AnalyzeCodeResponse(BaseModel):
    analysis: CodeAnalysis
    suggestions: List[str]


class GenerateTestsRequest(BaseModel):
    code: str
    language: str
    framework: str
    test_type: str
    requirements: Optional[List[str]] = None


class GeneratedTest(BaseModel):
    name: str
    description: str
    code: str
    test_type: str


class GenerateTestsResponse(BaseModel):
    tests: List[GeneratedTest]
    coverage_estimate: str


class ParseRequirementsRequest(BaseModel):
    requirements: str
    format: Optional[str] = None


class TestStep(BaseModel):
    order: int
    action: str
    expected: Optional[str]


class ParsedTestCase(BaseModel):
    title: str
    description: str
    preconditions: List[str]
    steps: List[TestStep]
    expected_results: List[str]
    priority: str


class ParseRequirementsResponse(BaseModel):
    test_cases: List[ParsedTestCase]


class AiWebStepConfig(BaseModel):
    selector: Optional[str] = None
    xpath: Optional[str] = None
    url: Optional[str] = None
    value: Optional[str] = None
    timeout: Optional[int] = None
    element_description: Optional[str] = None
    assertion_type: Optional[str] = None
    expected_value: Optional[str] = None


class AiWebSuggestedStep(BaseModel):
    step_type: str
    label: str
    config: AiWebStepConfig
    confidence: float


class DetectedWebElement(BaseModel):
    element_type: str
    description: str
    selector: str
    xpath: Optional[str] = None
    text_content: Optional[str] = None
    attributes: Optional[dict] = None


class AiWebAnalysisResult(BaseModel):
    page_description: str
    page_url: Optional[str] = None
    detected_elements: List[DetectedWebElement]
    suggested_steps: List[AiWebSuggestedStep]
    test_context: str


class AiWebElementLocation(BaseModel):
    found: bool
    selector: str
    xpath: Optional[str] = None
    element_type: str
    confidence: float
    description: str
    alternatives: List[str]


class AnalyzeWebPageRequest(BaseModel):
    screenshot_base64: str
    page_html: Optional[str] = None
    current_url: Optional[str] = None
    current_steps: Optional[List[Any]] = None
    test_context: Optional[str] = None


class FindWebElementRequest(BaseModel):
    screenshot_base64: str
    element_description: str
    page_html: Optional[str] = None


class SuggestWebStepRequest(BaseModel):
    screenshot_base64: str
    last_step_type: Optional[str] = None
    test_goal: Optional[str] = None
    page_html: Optional[str] = None


# ============================================
# AI Agent Endpoints
# ============================================


@router.get("/available")
async def check_ai_available():
    """Check if AI agent service is available"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.ai_agent_url}/health")
            return {"available": response.status_code == 200}
    except Exception:
        return {"available": False}


@router.post("/analyze-code", response_model=AnalyzeCodeResponse)
async def analyze_code(request: AnalyzeCodeRequest):
    """Analyze code using AI"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.ai_agent_url}/analyze-code",
                json=request.model_dump(),
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/generate-tests", response_model=GenerateTestsResponse)
async def generate_tests(request: GenerateTestsRequest):
    """Generate tests using AI"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.ai_agent_url}/generate-tests",
                json=request.model_dump(),
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/parse-requirements", response_model=ParseRequirementsResponse)
async def parse_requirements(request: ParseRequirementsRequest):
    """Parse requirements into test cases using AI"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.ai_agent_url}/parse-requirements",
                json=request.model_dump(),
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


# ============================================
# AI Web Automation Endpoints
# ============================================


@router.post("/web/analyze", response_model=AiWebAnalysisResult)
async def analyze_web_page(request: AnalyzeWebPageRequest):
    """Analyze a web page screenshot using AI"""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.ai_agent_url}/web/analyze",
                json=request.model_dump(),
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/web/find-element", response_model=AiWebElementLocation)
async def find_web_element(request: FindWebElementRequest):
    """Find a web element using AI"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.ai_agent_url}/web/find-element",
                json=request.model_dump(),
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")


@router.post("/web/suggest-step", response_model=AiWebSuggestedStep)
async def suggest_web_step(request: SuggestWebStepRequest):
    """Get AI-suggested next step for web testing"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.ai_agent_url}/web/suggest-step",
                json=request.model_dump(),
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
