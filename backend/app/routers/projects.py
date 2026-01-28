import uuid
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Project, ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter(prefix="/projects", tags=["projects"])


class ConnectRequest(BaseModel):
    """Schema for connect to running app request"""
    app_url: str
    name: Optional[str] = None
    project_type: str = "web"


class ConnectResponse(BaseModel):
    """Schema for connect response"""
    project: ProjectResponse
    connected: bool
    error: Optional[str] = None


@router.post("", response_model=ProjectResponse)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    """Create a new project"""
    project = Project(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        app_url=data.app_url,
        repo_url=data.repo_url,
        project_type=data.project_type,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.post("/connect", response_model=ConnectResponse)
async def connect_to_app(data: ConnectRequest, db: AsyncSession = Depends(get_db)):
    """Connect to a running app and create a project"""
    # Validate URL is reachable
    connected = False
    error = None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(data.app_url)
            connected = response.status_code < 500
    except httpx.ConnectError:
        error = "Connection refused - is the app running?"
    except httpx.TimeoutException:
        error = "Connection timed out"
    except Exception as e:
        error = str(e)

    # Don't create project if connection failed
    if not connected:
        raise HTTPException(
            status_code=400,
            detail={"connected": False, "error": error or "Failed to connect to app"}
        )

    # Generate project name from URL if not provided
    project_name = data.name
    if not project_name:
        try:
            from urllib.parse import urlparse
            parsed = urlparse(data.app_url)
            project_name = parsed.hostname.replace(".", "-") if parsed.hostname else "my-app"
        except Exception:
            project_name = "my-app"

    # Create project
    project = Project(
        id=str(uuid.uuid4()),
        name=project_name,
        app_url=data.app_url,
        project_type=data.project_type,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return ConnectResponse(project=project, connected=True)


@router.get("", response_model=List[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    """List all projects"""
    result = await db.execute(select(Project).order_by(Project.updated_at.desc()))
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get a project by ID"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str, data: ProjectUpdate, db: AsyncSession = Depends(get_db)
):
    """Update a project"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a project"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    await db.delete(project)
    await db.commit()
    return {"status": "deleted"}


@router.get("/search/{query}", response_model=List[ProjectResponse])
async def search_projects(query: str, db: AsyncSession = Depends(get_db)):
    """Search projects by name or description"""
    result = await db.execute(
        select(Project).where(
            (Project.name.ilike(f"%{query}%")) | (Project.description.ilike(f"%{query}%"))
        )
    )
    return result.scalars().all()
