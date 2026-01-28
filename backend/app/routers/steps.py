import uuid
import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Step, StepCreate, StepUpdate, StepResponse, StepConfig

router = APIRouter(prefix="/steps", tags=["steps"])


@router.post("", response_model=StepResponse)
async def create_step(data: StepCreate, db: AsyncSession = Depends(get_db)):
    """Create a new step"""
    config_json = json.dumps(data.config.model_dump() if data.config else {})
    step = Step(
        id=str(uuid.uuid4()),
        scenario_id=data.scenario_id,
        step_order=data.step_order,
        step_type=data.step_type,
        label=data.label,
        config=config_json,
    )
    db.add(step)
    await db.commit()
    await db.refresh(step)
    return step


@router.get("/scenario/{scenario_id}", response_model=List[StepResponse])
async def list_steps_by_scenario(scenario_id: str, db: AsyncSession = Depends(get_db)):
    """List all steps for a scenario"""
    result = await db.execute(
        select(Step).where(Step.scenario_id == scenario_id).order_by(Step.step_order)
    )
    return result.scalars().all()


@router.get("/{step_id}", response_model=StepResponse)
async def get_step(step_id: str, db: AsyncSession = Depends(get_db)):
    """Get a step by ID"""
    result = await db.execute(select(Step).where(Step.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    return step


@router.put("/{step_id}", response_model=StepResponse)
async def update_step(
    step_id: str, data: StepUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a step"""
    result = await db.execute(select(Step).where(Step.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    update_data = data.model_dump(exclude_unset=True)
    if "config" in update_data and update_data["config"]:
        update_data["config"] = json.dumps(update_data["config"])

    for key, value in update_data.items():
        setattr(step, key, value)

    await db.commit()
    await db.refresh(step)
    return step


@router.put("/{step_id}/config", response_model=StepResponse)
async def update_step_config(
    step_id: str, config: StepConfig, db: AsyncSession = Depends(get_db)
):
    """Update just the config of a step"""
    result = await db.execute(select(Step).where(Step.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    step.config = json.dumps(config.model_dump())
    await db.commit()
    await db.refresh(step)
    return step


@router.delete("/{step_id}")
async def delete_step(step_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a step"""
    result = await db.execute(select(Step).where(Step.id == step_id))
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    await db.delete(step)
    await db.commit()
    return {"status": "deleted"}


@router.post("/reorder")
async def reorder_steps(
    scenario_id: str, step_ids: List[str], db: AsyncSession = Depends(get_db)
):
    """Reorder steps in a scenario"""
    for order, step_id in enumerate(step_ids):
        result = await db.execute(
            select(Step).where(Step.id == step_id, Step.scenario_id == scenario_id)
        )
        step = result.scalar_one_or_none()
        if step:
            step.step_order = order

    await db.commit()
    return {"status": "reordered"}


@router.post("/bulk", response_model=List[StepResponse])
async def bulk_create_steps(steps: List[StepCreate], db: AsyncSession = Depends(get_db)):
    """Create multiple steps at once"""
    created_steps = []
    for data in steps:
        config_json = json.dumps(data.config.model_dump() if data.config else {})
        step = Step(
            id=str(uuid.uuid4()),
            scenario_id=data.scenario_id,
            step_order=data.step_order,
            step_type=data.step_type,
            label=data.label,
            config=config_json,
        )
        db.add(step)
        created_steps.append(step)

    await db.commit()
    for step in created_steps:
        await db.refresh(step)
    return created_steps


@router.delete("/bulk")
async def bulk_delete_steps(step_ids: List[str], db: AsyncSession = Depends(get_db)):
    """Delete multiple steps at once"""
    deleted_count = 0
    for step_id in step_ids:
        result = await db.execute(select(Step).where(Step.id == step_id))
        step = result.scalar_one_or_none()
        if step:
            await db.delete(step)
            deleted_count += 1

    await db.commit()
    return {"deleted": deleted_count}
