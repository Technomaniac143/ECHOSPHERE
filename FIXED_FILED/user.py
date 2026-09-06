"""User and authentication models."""
import enum
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import String, DateTime, Enum as SAEnum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    STUDENT = "student"
    HR_ADMIN = "hr_admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role_enum"), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Candidate-specific fields
    target_role: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    experience_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    skills: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    resume_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    github_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    leetcode_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    education: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    certifications: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    system_checks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    sample_video_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    analysis_result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string

    # Organization fields
    organization_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    company_size: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    hr_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    hr_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Clerk integration
    clerk_user_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    clerk_org_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    sessions_as_candidate = relationship(
        "Session", back_populates="candidate"
    )
    roadmaps = relationship("Roadmap", back_populates="student")
    organizations = relationship("Organization", back_populates="created_by_user")
