import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class TestCase(Base):
    """Test case database model"""

    __tablename__ = "test_cases"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    priority: Mapped[str] = mapped_column(String, nullable=False, default="Medium")
    test_type: Mapped[str] = mapped_column(String, nullable=False, default="Automated")
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TestCaseCreate(BaseModel):
    """Schema for creating a test case"""

    project_id: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority: str = "Medium"
    test_type: str = "Automated"


class TestCaseUpdate(BaseModel):
    """Schema for updating a test case"""

    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    test_type: Optional[str] = None
    status: Optional[str] = None


class TestCaseFilter(BaseModel):
    """Schema for filtering test cases"""

    project_id: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    test_type: Optional[str] = None


class TestCaseResponse(BaseModel):
    """Schema for test case response"""

    id: str
    project_id: str
    name: str
    description: Optional[str]
    category: Optional[str]
    priority: str
    test_type: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CategoryCount(BaseModel):
    category: str
    count: int


class PriorityCount(BaseModel):
    priority: str
    count: int


class TestCaseStats(BaseModel):
    """Statistics for test cases"""

    total: int
    passed: int
    failed: int
    pending: int
    by_category: List[CategoryCount]
    by_priority: List[PriorityCount]
