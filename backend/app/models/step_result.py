import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class StepResult(Base):
    """Step result database model"""

    __tablename__ = "step_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    test_run_id: Mapped[str] = mapped_column(String, ForeignKey("test_runs.id", ondelete="CASCADE"), nullable=False)
    step_id: Mapped[str] = mapped_column(String, ForeignKey("steps.id", ondelete="CASCADE"), nullable=False)
    test_case_id: Mapped[str] = mapped_column(String, ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    screenshot_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class StepResultCreate(BaseModel):
    """Schema for creating a step result"""

    test_run_id: str
    step_id: str
    test_case_id: str
    status: str
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None


class StepResultResponse(BaseModel):
    """Schema for step result response"""

    id: str
    test_run_id: str
    step_id: str
    test_case_id: str
    status: str
    duration_ms: Optional[int]
    error_message: Optional[str]
    screenshot_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
