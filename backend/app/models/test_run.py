import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class TestRun(Base):
    """Test run database model"""

    __tablename__ = "test_runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    passed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class TestRunCreate(BaseModel):
    """Schema for creating a test run"""

    project_id: str
    name: str


class TestRunUpdate(BaseModel):
    """Schema for updating a test run"""

    status: Optional[str] = None
    duration_ms: Optional[int] = None
    passed: Optional[int] = None
    failed: Optional[int] = None
    skipped: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class TestRunResponse(BaseModel):
    """Schema for test run response"""

    id: str
    project_id: str
    name: str
    status: str
    duration_ms: Optional[int]
    passed: int
    failed: int
    skipped: int
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class TestRunSummary(BaseModel):
    """Summary statistics for test runs"""

    total_runs: int
    passed_runs: int
    failed_runs: int
    avg_duration_ms: Optional[float]
