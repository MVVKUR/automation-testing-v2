import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import (
    TestRun,
    TestRunCreate,
    TestRunUpdate,
    TestRunResponse,
    TestRunSummary,
)

router = APIRouter(prefix="/test-runs", tags=["test-runs"])


@router.post("", response_model=TestRunResponse)
async def create_test_run(data: TestRunCreate, db: AsyncSession = Depends(get_db)):
    """Create a new test run"""
    test_run = TestRun(
        id=str(uuid.uuid4()),
        project_id=data.project_id,
        name=data.name,
    )
    db.add(test_run)
    await db.commit()
    await db.refresh(test_run)
    return test_run


@router.get("/project/{project_id}", response_model=List[TestRunResponse])
async def list_test_runs(
    project_id: str,
    limit: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List test runs for a project"""
    query = (
        select(TestRun)
        .where(TestRun.project_id == project_id)
        .order_by(TestRun.created_at.desc())
    )
    if limit:
        query = query.limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/summary/{project_id}", response_model=TestRunSummary)
async def get_test_run_summary(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get summary statistics for test runs in a project"""
    total_result = await db.execute(
        select(func.count()).where(TestRun.project_id == project_id)
    )
    total = total_result.scalar() or 0

    passed_result = await db.execute(
        select(func.count()).where(
            TestRun.project_id == project_id, TestRun.status == "passed"
        )
    )
    passed = passed_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count()).where(
            TestRun.project_id == project_id, TestRun.status == "failed"
        )
    )
    failed = failed_result.scalar() or 0

    avg_result = await db.execute(
        select(func.avg(TestRun.duration_ms)).where(
            TestRun.project_id == project_id, TestRun.duration_ms.isnot(None)
        )
    )
    avg_duration = avg_result.scalar()

    return TestRunSummary(
        total_runs=total,
        passed_runs=passed,
        failed_runs=failed,
        avg_duration_ms=avg_duration,
    )


@router.get("/{test_run_id}", response_model=TestRunResponse)
async def get_test_run(test_run_id: str, db: AsyncSession = Depends(get_db)):
    """Get a test run by ID"""
    result = await db.execute(select(TestRun).where(TestRun.id == test_run_id))
    test_run = result.scalar_one_or_none()
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return test_run


@router.put("/{test_run_id}", response_model=TestRunResponse)
async def update_test_run(
    test_run_id: str, data: TestRunUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a test run"""
    result = await db.execute(select(TestRun).where(TestRun.id == test_run_id))
    test_run = result.scalar_one_or_none()
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(test_run, key, value)

    await db.commit()
    await db.refresh(test_run)
    return test_run


@router.post("/{test_run_id}/start", response_model=TestRunResponse)
async def start_test_run(test_run_id: str, db: AsyncSession = Depends(get_db)):
    """Start a test run"""
    result = await db.execute(select(TestRun).where(TestRun.id == test_run_id))
    test_run = result.scalar_one_or_none()
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    test_run.status = "running"
    test_run.started_at = datetime.utcnow()
    await db.commit()
    await db.refresh(test_run)
    return test_run


@router.post("/{test_run_id}/complete", response_model=TestRunResponse)
async def complete_test_run(
    test_run_id: str,
    passed: int,
    failed: int,
    skipped: int,
    db: AsyncSession = Depends(get_db),
):
    """Complete a test run"""
    result = await db.execute(select(TestRun).where(TestRun.id == test_run_id))
    test_run = result.scalar_one_or_none()
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    test_run.status = "passed" if failed == 0 else "failed"
    test_run.passed = passed
    test_run.failed = failed
    test_run.skipped = skipped
    test_run.completed_at = datetime.utcnow()

    if test_run.started_at:
        test_run.duration_ms = int(
            (test_run.completed_at - test_run.started_at).total_seconds() * 1000
        )

    await db.commit()
    await db.refresh(test_run)
    return test_run


@router.delete("/{test_run_id}")
async def delete_test_run(test_run_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a test run"""
    result = await db.execute(select(TestRun).where(TestRun.id == test_run_id))
    test_run = result.scalar_one_or_none()
    if not test_run:
        raise HTTPException(status_code=404, detail="Test run not found")

    await db.delete(test_run)
    await db.commit()
    return {"status": "deleted"}
