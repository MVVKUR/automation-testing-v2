import uuid
import json
from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, field_validator
from sqlalchemy import String, DateTime, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Step(Base):
    """Step database model"""

    __tablename__ = "steps"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    scenario_id: Mapped[str] = mapped_column(String, ForeignKey("scenarios.id", ondelete="CASCADE"), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(String, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    config: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StepConfig(BaseModel):
    """Configuration for a step"""

    url: Optional[str] = None
    selector: Optional[str] = None
    value: Optional[str] = None
    timeout: Optional[int] = None
    expected: Optional[str] = None
    operator: Optional[str] = None

    class Config:
        extra = "allow"


class StepCreate(BaseModel):
    """Schema for creating a step"""

    scenario_id: str
    step_order: int
    step_type: str
    label: str
    config: Optional[StepConfig] = None


class StepUpdate(BaseModel):
    """Schema for updating a step"""

    step_order: Optional[int] = None
    step_type: Optional[str] = None
    label: Optional[str] = None
    config: Optional[StepConfig] = None


class StepResponse(BaseModel):
    """Schema for step response"""

    id: str
    scenario_id: str
    step_order: int
    step_type: str
    label: str
    config: StepConfig
    created_at: datetime
    updated_at: datetime

    @field_validator("config", mode="before")
    @classmethod
    def parse_config(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    class Config:
        from_attributes = True
