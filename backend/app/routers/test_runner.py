"""
Test Runner API Router - Endpoints for running Cypress and Playwright tests
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from ..services.test_runner import test_runner, TestFramework

router = APIRouter(prefix="/test-runner", tags=["test-runner"])


class TestStep(BaseModel):
    type: str  # navigate, click, type, verify, wait
    selector: Optional[str] = None
    value: Optional[str] = None
    url: Optional[str] = None
    duration: Optional[int] = None


class RunStepsRequest(BaseModel):
    steps: List[TestStep]
    base_url: str
    framework: TestFramework = TestFramework.CYPRESS
    browser: str = "chrome"
    headless: bool = True


class RunSpecRequest(BaseModel):
    spec_content: str
    base_url: str
    framework: TestFramework = TestFramework.CYPRESS
    browser: str = "chrome"
    headless: bool = True
    timeout: int = 60000


class TestResult(BaseModel):
    success: bool
    stdout: str
    stderr: str
    exit_code: int
    error: Optional[str] = None


@router.post("/run-steps", response_model=TestResult)
async def run_test_steps(request: RunStepsRequest):
    """
    Run test steps using Cypress or Playwright

    Converts the provided test steps to a test spec and executes it.
    """
    steps_dict = [step.model_dump() for step in request.steps]

    if request.framework == TestFramework.CYPRESS:
        browser = request.browser if request.browser in ["chrome", "firefox", "electron"] else "chrome"
        result = await test_runner.run_steps_as_cypress(
            steps=steps_dict,
            base_url=request.base_url,
            browser=browser,
            headless=request.headless
        )
    else:
        browser = request.browser if request.browser in ["chromium", "firefox", "webkit"] else "chromium"
        result = await test_runner.run_steps_as_playwright(
            steps=steps_dict,
            base_url=request.base_url,
            browser=browser,
            headless=request.headless
        )

    return TestResult(**result)


@router.post("/run-spec", response_model=TestResult)
async def run_test_spec(request: RunSpecRequest):
    """
    Run a raw test spec using Cypress or Playwright

    Executes the provided spec content directly.
    """
    if request.framework == TestFramework.CYPRESS:
        browser = request.browser if request.browser in ["chrome", "firefox", "electron"] else "chrome"
        result = await test_runner.run_cypress(
            spec_content=request.spec_content,
            base_url=request.base_url,
            browser=browser,
            headless=request.headless,
            timeout=request.timeout
        )
    else:
        browser = request.browser if request.browser in ["chromium", "firefox", "webkit"] else "chromium"
        result = await test_runner.run_playwright(
            spec_content=request.spec_content,
            base_url=request.base_url,
            browser=browser,
            headless=request.headless,
            timeout=request.timeout
        )

    return TestResult(**result)


@router.get("/health")
async def health_check():
    """Check if test runner is available"""
    import shutil

    npx_available = shutil.which("npx") is not None

    return {
        "status": "ok" if npx_available else "degraded",
        "npx_available": npx_available,
        "message": "Ready to run tests" if npx_available else "npx not found - install Node.js"
    }
