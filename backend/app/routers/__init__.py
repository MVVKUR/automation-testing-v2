from .projects import router as projects_router
from .test_cases import router as test_cases_router
from .scenarios import router as scenarios_router
from .steps import router as steps_router
from .test_runs import router as test_runs_router
from .step_results import router as step_results_router
from .services import router as services_router
from .ai import router as ai_router
from .mobile import router as mobile_router
from .integrations import router as integrations_router
from .test_runner import router as test_runner_router

__all__ = [
    "projects_router",
    "test_cases_router",
    "scenarios_router",
    "steps_router",
    "test_runs_router",
    "step_results_router",
    "services_router",
    "ai_router",
    "mobile_router",
    "integrations_router",
    "test_runner_router",
]
