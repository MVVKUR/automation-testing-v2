import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import (
    Scenario,
    ScenarioCreate,
    ScenarioUpdate,
    ScenarioResponse,
    ScenarioWithSteps,
    Step,
    StepResponse,
)

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.post("", response_model=ScenarioResponse)
async def create_scenario(data: ScenarioCreate, db: AsyncSession = Depends(get_db)):
    """Create a new scenario"""
    scenario = Scenario(
        id=str(uuid.uuid4()),
        test_case_id=data.test_case_id,
        name=data.name,
        description=data.description,
        target_url=data.target_url,
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.get("/test-case/{test_case_id}", response_model=List[ScenarioResponse])
async def list_scenarios_by_test_case(test_case_id: str, db: AsyncSession = Depends(get_db)):
    """List all scenarios for a test case"""
    result = await db.execute(
        select(Scenario)
        .where(Scenario.test_case_id == test_case_id)
        .order_by(Scenario.created_at)
    )
    return result.scalars().all()


@router.get("/{scenario_id}", response_model=ScenarioResponse)
async def get_scenario(scenario_id: str, db: AsyncSession = Depends(get_db)):
    """Get a scenario by ID"""
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario


@router.get("/{scenario_id}/with-steps", response_model=ScenarioWithSteps)
async def get_scenario_with_steps(scenario_id: str, db: AsyncSession = Depends(get_db)):
    """Get a scenario with all its steps"""
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    steps_result = await db.execute(
        select(Step).where(Step.scenario_id == scenario_id).order_by(Step.step_order)
    )
    steps = steps_result.scalars().all()

    return ScenarioWithSteps(
        id=scenario.id,
        test_case_id=scenario.test_case_id,
        name=scenario.name,
        description=scenario.description,
        target_url=scenario.target_url,
        created_at=scenario.created_at,
        updated_at=scenario.updated_at,
        steps=[StepResponse.model_validate(s) for s in steps],
    )


@router.put("/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(
    scenario_id: str, data: ScenarioUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a scenario"""
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(scenario, key, value)

    await db.commit()
    await db.refresh(scenario)
    return scenario


@router.delete("/{scenario_id}")
async def delete_scenario(scenario_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a scenario"""
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    await db.delete(scenario)
    await db.commit()
    return {"status": "deleted"}


@router.post("/{scenario_id}/duplicate", response_model=ScenarioResponse)
async def duplicate_scenario(
    scenario_id: str, new_name: str = None, db: AsyncSession = Depends(get_db)
):
    """Duplicate a scenario with all its steps"""
    result = await db.execute(select(Scenario).where(Scenario.id == scenario_id))
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Create new scenario
    new_scenario = Scenario(
        id=str(uuid.uuid4()),
        test_case_id=scenario.test_case_id,
        name=new_name or f"{scenario.name} (Copy)",
        description=scenario.description,
        target_url=scenario.target_url,
    )
    db.add(new_scenario)
    await db.flush()

    # Duplicate steps
    steps_result = await db.execute(
        select(Step).where(Step.scenario_id == scenario_id).order_by(Step.step_order)
    )
    steps = steps_result.scalars().all()

    for step in steps:
        new_step = Step(
            id=str(uuid.uuid4()),
            scenario_id=new_scenario.id,
            step_order=step.step_order,
            step_type=step.step_type,
            label=step.label,
            config=step.config,
        )
        db.add(new_step)

    await db.commit()
    await db.refresh(new_scenario)
    return new_scenario
