"""Whiteboard models — shared candidate context and event audit log."""
import enum
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import String, DateTime, Enum as SAEnum, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WhiteboardEventType(str, enum.Enum):
    CLAIM = "claim"
    COMPETENCY_UPDATE = "competency_update"
    OPEN_THREAD_OPENED = "open_thread_opened"
    OPEN_THREAD_RESOLVED = "open_thread_resolved"
    CONTRADICTION_FLAG = "contradiction_flag"
    VAGUENESS_FLAG = "vagueness_flag"
    DIFFICULTY_CHANGE = "difficulty_change"
    INTEGRITY_FLAG = "integrity_flag"
    PERSONA_HANDOFF = "persona_handoff"
    QUESTION_ASKED = "question_asked"
    ANSWER_RECEIVED = "answer_received"


class Session(Base):
    """Placeholder — the real Session is in session.py. SQLAlchemy needs this for FK references across files."""
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)


class WhiteboardEvent(Base):
    __tablename__ = "whiteboard_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    event_type: Mapped[WhiteboardEventType] = mapped_column(
        SAEnum(WhiteboardEventType, name="whiteboard_event_type_enum", create_type=False),
        nullable=False,
    )
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    source_persona: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    session = relationship("Session", back_populates="whiteboard_events")


class WhiteboardState(Base):
    __tablename__ = "whiteboard_state"

    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )

    claims: Mapped[list] = mapped_column(JSON, default=list)
    competency_ledger: Mapped[dict] = mapped_column(JSON, default=dict)
    open_threads: Mapped[list] = mapped_column(JSON, default=list)
    contradiction_flags: Mapped[list] = mapped_column(JSON, default=list)
    vagueness_flags: Mapped[list] = mapped_column(JSON, default=list)
    difficulty_state: Mapped[dict] = mapped_column(JSON, default=dict)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    weaknesses: Mapped[list] = mapped_column(JSON, default=list)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    questions_asked: Mapped[list] = mapped_column(JSON, default=list)
    current_persona: Mapped[str] = mapped_column(String(100), default="technical")
    candidate_context: Mapped[dict] = mapped_column(JSON, default=dict)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    session = relationship("Session", back_populates="whiteboard_state")
