import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import (
    TestCase,
    TestCaseCreate,
    TestCaseUpdate,
    TestCaseResponse,
    TestCaseStats,
    CategoryCount,
    PriorityCount,
)

router = APIRouter(prefix="/test-cases", tags=["test-cases"])


@router.post("", response_model=TestCaseResponse)
async def create_test_case(data: TestCaseCreate, db: AsyncSession = Depends(get_db)):
    """Create a new test case"""
    test_case = TestCase(
        id=str(uuid.uuid4()),
        project_id=data.project_id,
        name=data.name,
        description=data.description,
        category=data.category,
        priority=data.priority,
        test_type=data.test_type,
    )
    db.add(test_case)
    await db.commit()
    await db.refresh(test_case)
    return test_case


@router.get("", response_model=List[TestCaseResponse])
async def list_test_cases(
    project_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    test_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List test cases with optional filters"""
    query = select(TestCase)

    if project_id:
        query = query.where(TestCase.project_id == project_id)
    if category:
        query = query.where(TestCase.category == category)
    if priority:
        query = query.where(TestCase.priority == priority)
    if status:
        query = query.where(TestCase.status == status)
    if test_type:
        query = query.where(TestCase.test_type == test_type)

    query = query.order_by(TestCase.updated_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/project/{project_id}", response_model=List[TestCaseResponse])
async def list_test_cases_by_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """List all test cases for a project"""
    result = await db.execute(
        select(TestCase)
        .where(TestCase.project_id == project_id)
        .order_by(TestCase.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/stats/{project_id}", response_model=TestCaseStats)
async def get_test_case_stats(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get statistics for test cases in a project"""
    # Total counts by status
    total_result = await db.execute(
        select(func.count()).where(TestCase.project_id == project_id)
    )
    total = total_result.scalar() or 0

    passed_result = await db.execute(
        select(func.count()).where(
            TestCase.project_id == project_id, TestCase.status == "success"
        )
    )
    passed = passed_result.scalar() or 0

    failed_result = await db.execute(
        select(func.count()).where(
            TestCase.project_id == project_id, TestCase.status == "failed"
        )
    )
    failed = failed_result.scalar() or 0

    pending_result = await db.execute(
        select(func.count()).where(
            TestCase.project_id == project_id, TestCase.status == "pending"
        )
    )
    pending = pending_result.scalar() or 0

    # By category
    category_result = await db.execute(
        select(TestCase.category, func.count().label("count"))
        .where(TestCase.project_id == project_id, TestCase.category.isnot(None))
        .group_by(TestCase.category)
    )
    by_category = [
        CategoryCount(category=row[0] or "Uncategorized", count=row[1])
        for row in category_result.all()
    ]

    # By priority
    priority_result = await db.execute(
        select(TestCase.priority, func.count().label("count"))
        .where(TestCase.project_id == project_id)
        .group_by(TestCase.priority)
    )
    by_priority = [
        PriorityCount(priority=row[0], count=row[1]) for row in priority_result.all()
    ]

    return TestCaseStats(
        total=total,
        passed=passed,
        failed=failed,
        pending=pending,
        by_category=by_category,
        by_priority=by_priority,
    )


@router.get("/{test_case_id}", response_model=TestCaseResponse)
async def get_test_case(test_case_id: str, db: AsyncSession = Depends(get_db)):
    """Get a test case by ID"""
    result = await db.execute(select(TestCase).where(TestCase.id == test_case_id))
    test_case = result.scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")
    return test_case


@router.put("/{test_case_id}", response_model=TestCaseResponse)
async def update_test_case(
    test_case_id: str, data: TestCaseUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a test case"""
    result = await db.execute(select(TestCase).where(TestCase.id == test_case_id))
    test_case = result.scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(test_case, key, value)

    await db.commit()
    await db.refresh(test_case)
    return test_case


@router.patch("/{test_case_id}/status")
async def update_test_case_status(
    test_case_id: str, status: str, db: AsyncSession = Depends(get_db)
):
    """Update the status of a test case"""
    result = await db.execute(select(TestCase).where(TestCase.id == test_case_id))
    test_case = result.scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    test_case.status = status
    await db.commit()
    return {"status": "updated"}


@router.delete("/{test_case_id}")
async def delete_test_case(test_case_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a test case"""
    result = await db.execute(select(TestCase).where(TestCase.id == test_case_id))
    test_case = result.scalar_one_or_none()
    if not test_case:
        raise HTTPException(status_code=404, detail="Test case not found")

    await db.delete(test_case)
    await db.commit()
    return {"status": "deleted"}
