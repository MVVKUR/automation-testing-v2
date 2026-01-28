import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING

from pydantic import BaseModel
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

if TYPE_CHECKING:
    from .step import StepResponse


class Scenario(Base):
    """Scenario database model"""

    __tablename__ = "scenarios"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    test_case_id: Mapped[str] = mapped_column(String, ForeignKey("test_cases.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    target_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ScenarioCreate(BaseModel):
    """Schema for creating a scenario"""

    test_case_id: str
    name: str
    description: Optional[str] = None
    target_url: Optional[str] = None


class ScenarioUpdate(BaseModel):
    """Schema for updating a scenario"""

    name: Optional[str] = None
    description: Optional[str] = None
    target_url: Optional[str] = None


class ScenarioResponse(BaseModel):
    """Schema for scenario response"""

    id: str
    test_case_id: str
    name: str
    description: Optional[str]
    target_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScenarioWithSteps(ScenarioResponse):
    """Scenario with its steps"""

    steps: List["StepResponse"] = []


# Update forward reference
from .step import StepResponse

ScenarioWithSteps.model_rebuild()
