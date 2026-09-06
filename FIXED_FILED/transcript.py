"""Transcript and report models — conversation record and final assessment."""
import enum
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import String, DateTime, Enum as SAEnum, ForeignKey, JSON, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Speaker(str, enum.Enum):
    CANDIDATE = "candidate"
    AGENT = "agent"


class TranscriptTurn(Base):
    __tablename__ = "transcript_turns"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ts_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True
    )
    ts_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    speaker: Mapped[Speaker] = mapped_column(
        SAEnum(Speaker, name="transcript_speaker_enum"), nullable=False
    )
    persona: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    audio_ref: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(20), default="en")

    # Relationships
    session = relationship("Session", back_populates="transcript_turns")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )

    competency_scores: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # { "Technical": {"score": 82, "confidence": 0.86, "strengths": [...], "weaknesses": [...], "evidence": [...]}, ... }

    evidence_links: Mapped[list] = mapped_column(JSON, default=list)
    # [{ "competency": "Technical", "transcript_turn_id": "...", "whiteboard_event_id": "...", "timestamp": "08:42", "quote": "..." }, ...]

    panel_disagreement: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # { "detected": true, "pairs": [{ "persona_a": "technical", "persona_b": "product", "area": "...", "summary": "..." }] }

    strengths: Mapped[list] = mapped_column(JSON, default=list)
    weaknesses: Mapped[list] = mapped_column(JSON, default=list)
    recommendations: Mapped[list] = mapped_column(JSON, default=list)
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    overall_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    generation_status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, generating, completed, failed
    generation_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    session = relationship("Session", back_populates="report")


class Roadmap(Base):
    __tablename__ = "roadmaps"

    student_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    competency_ledger: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # { "Technical": {"score": 75, "progress": 0.75, "sessions_count": 3, "last_updated": "..."}, ... }

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    student = relationship("User", back_populates="roadmaps")


class IntegrityEvent(Base):
    __tablename__ = "integrity_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # TAB_SWITCH, FULLSCREEN_EXIT, CAMERA_ABSENCE, MULTIPLE_PERSONS, SCREEN_SHARE_STARTED, SCREEN_SHARE_STOPPED

    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    # { "url": "...", "window_title": "...", "frame_ref": "..." }

    source: Mapped[str] = mapped_column(String(50), default="client")  # client, service, gemini

    # Relationships
    session = relationship("Session", back_populates="integrity_events")
