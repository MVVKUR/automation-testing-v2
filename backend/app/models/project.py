import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Project(Base):
    """Project database model"""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    app_url: Mapped[str] = mapped_column(String, nullable=False)
    repo_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    project_type: Mapped[str] = mapped_column(String, nullable=False, default="web")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ProjectCreate(BaseModel):
    """Schema for creating a project"""

    name: str
    description: Optional[str] = None
    app_url: str
    repo_url: Optional[str] = None
    project_type: str = "web"


class ProjectUpdate(BaseModel):
    """Schema for updating a project"""

    name: Optional[str] = None
    description: Optional[str] = None
    app_url: Optional[str] = None
    repo_url: Optional[str] = None
    project_type: Optional[str] = None


class ProjectResponse(BaseModel):
    """Schema for project response"""

    id: str
    name: str
    description: Optional[str]
    app_url: str
    repo_url: Optional[str]
    project_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
