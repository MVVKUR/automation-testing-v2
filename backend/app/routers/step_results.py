import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import StepResult, StepResultCreate, StepResultResponse

router = APIRouter(prefix="/step-results", tags=["step-results"])


@router.post("", response_model=StepResultResponse)
async def create_step_result(data: StepResultCreate, db: AsyncSession = Depends(get_db)):
    """Create a new step result"""
    step_result = StepResult(
        id=str(uuid.uuid4()),
        test_run_id=data.test_run_id,
        step_id=data.step_id,
        test_case_id=data.test_case_id,
        status=data.status,
        duration_ms=data.duration_ms,
        error_message=data.error_message,
        screenshot_path=data.screenshot_path,
    )
    db.add(step_result)
    await db.commit()
    await db.refresh(step_result)
    return step_result


@router.get("/test-run/{test_run_id}", response_model=List[StepResultResponse])
async def list_step_results(test_run_id: str, db: AsyncSession = Depends(get_db)):
    """List all step results for a test run"""
    result = await db.execute(
        select(StepResult)
        .where(StepResult.test_run_id == test_run_id)
        .order_by(StepResult.created_at)
    )
    return result.scalars().all()
