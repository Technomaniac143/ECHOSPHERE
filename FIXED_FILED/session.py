"""Session and interview models — core of the interview lifecycle."""
import enum
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import String, DateTime, Enum as SAEnum, ForeignKey, JSON, Text, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionMode(str, enum.Enum):
    PRACTICE = "practice"
    ASSESSMENT = "assessment"


class SessionStatus(str, enum.Enum):
    LOBBY = "lobby"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    mode: Mapped[SessionMode] = mapped_column(
        SAEnum(SessionMode, name="session_mode_enum"), nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus, name="session_status_enum"),
        default=SessionStatus.LOBBY,
        nullable=False,
    )

    panel_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("panels.id", ondelete="SET NULL"), nullable=True
    )
    candidate_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    assessment_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("assessments.id", ondelete="SET NULL"), nullable=True
    )
    batch_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("batches.id", ondelete="SET NULL"), nullable=True
    )

    target_role: Mapped[str] = mapped_column(String(255), nullable=False)
    target_company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    target_domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    agora_channel_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    agora_agent_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    agora_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Interview configuration snapshot
    persona_list: Mapped[list] = mapped_column(JSON, default=list)
    difficulty_seed: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    interview_duration_minutes: Mapped[int] = mapped_column(default=20)

    # Timing
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_end_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Feedback and flags
    candidate_feedback: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    integrity_flags: Mapped[list] = mapped_column(JSON, default=list)

    # Agora recording reference
    recording_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    recording_duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

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
    panel = relationship("Panel", back_populates="sessions")
    candidate = relationship("User", back_populates="sessions_as_candidate")
    assessment = relationship("Assessment", back_populates="sessions")
    batch = relationship("Batch", back_populates="sessions")
    whiteboard_state = relationship("WhiteboardState", back_populates="session", uselist=False, cascade="all, delete-orphan")
    transcript_turns = relationship("TranscriptTurn", back_populates="session", cascade="all, delete-orphan")
    report = relationship("Report", back_populates="session", uselist=False, cascade="all, delete-orphan")
    whiteboard_events = relationship("WhiteboardEvent", back_populates="session", cascade="all, delete-orphan")
    integrity_events = relationship("IntegrityEvent", back_populates="session", cascade="all, delete-orphan")

    def get_remaining_time(self) -> int:
        """Get remaining interview time in seconds."""
        if not self.started_at or not self.interview_duration_minutes:
            return self.interview_duration_minutes * 60
        
        elapsed = (datetime.now(timezone.utc) - self.started_at).total_seconds()
        remaining = (self.interview_duration_minutes * 60) - elapsed
        return max(0, int(remaining))


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    org_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True
    )
    panel_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("panels.id", ondelete="SET NULL"), nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    organization = relationship("Organization", back_populates="batches")
    panel = relationship("Panel")
    sessions = relationship("Session", back_populates="batch")
    batch_sessions = relationship("BatchSession", back_populates="batch")


class BatchSession(Base):
    __tablename__ = "batch_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    batch_id: Mapped[str] = mapped_column(
        ForeignKey("batches.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    batch = relationship("Batch", back_populates="batch_sessions")
    session = relationship("Session")
